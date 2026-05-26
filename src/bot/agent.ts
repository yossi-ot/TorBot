/**
 * Conversational agent — Claude with tool use. State-driven (not history
 * driven): each turn the model sees the current selections + the last
 * thing the bot said + the new user message, and uses tools to do the
 * actual work.
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { dayjs } from '../utils/date.js';
import { TOOL_DEFINITIONS, runTool, ToolContext } from './tools.js';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: config.anthropic.apiKey });
  return client;
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MAX_TOOL_ROUNDS = 6;

export interface AgentState {
  selectedServiceName?: string;
  selectedDate?: string;
  selectedTime?: string;
  /** What the bot said last turn — gives Claude context for words like "השלישי" / "כן". */
  lastBotMessage?: string;
}

export interface AgentInput {
  ctx: ToolContext;
  state: AgentState;
  userMessage: string;
}

export interface AgentResult {
  reply: string;
  /** State updates the caller should persist to the session. */
  stateUpdates: Partial<AgentState>;
}

function buildSystemPrompt(ctx: ToolContext): string {
  const today = dayjs().tz(ctx.tenantTimezone);
  const todayIso = today.format('YYYY-MM-DD');
  const todayName = HEBREW_DAYS[today.day()];

  return `אתה הבוט של ${ctx.tenantName} בוואטסאפ. תפקידך לעזור ללקוחות לקבוע, לבטל ולנהל תורים בעברית.

תאריך היום: ${todayIso} (יום ${todayName}, אזור זמן ${ctx.tenantTimezone}).

הנחיות שיחה:
- ענה תמיד **בעברית**, קצר וידידותי, עם אימוג'י מתאים מדי פעם.
- אל תמציא מחירים, שירותים, או שעות פנויות — תמיד תקרא ל-tools המתאים.
- כשמשתמש מבקש תור, תפעל ככה:
  1. אם לא ידוע איזה שירות → קרא ל-get_services והצג רשימה ידידותית עם מספרים.
  2. אם לא ידוע איזה תאריך → אפשר לקרוא ל-get_available_dates ולהציע, או לבקש מהמשתמש לכתוב תאריך.
  3. אם לא ידועה השעה → קרא ל-get_available_slots עם השירות+התאריך. הצג שעות בצורה תמציתית.
  4. כשהמשתמש בוחר שעה ספציפית → קרא ל-lock_slot כדי לנעול אותה לפני שתבקש אישור.
  5. אם הנעילה נכשלה (תפוס ע"י לקוח אחר) → התנצל וקרא שוב ל-get_available_slots להצעות חדשות.
  6. כשהמשתמש מאשר → קרא ל-create_appointment והודע על הצלחה.
- כשמשתמש שואל "מה התורים שלי" → קרא ל-list_my_appointments.
- כשמשתמש רוצה לבטל → השג רשימה עם list_my_appointments, ברר איזה תור, אז קרא ל-cancel_appointment.
- אם המשתמש שואל על שעות פתיחה, כתובת, מדיניות ביטול → קרא ל-get_business_info.
- אל תציג id של appointment ללקוח. אם צריך לזהות תור — תאר אותו לפי השירות+התאריך+השעה.
- שעות פנויות: הצג 4-6 דוגמאות ספציפיות לפי בקשת המשתמש (לדוגמה "מתי בערב?") ולא רשימה ארוכה.
- אם המשתמש מבקש משהו שלא קשור לתורים (שואל איך מגיעים, מבקש המלצה, וכו') — תענה בקצרה ואז תחזיר אותו לעניין.
- היה שיחתי. הימנע מתפריטים מספריים אלא אם הלקוח ביקש.

פרטי הלקוח הנוכחי:
- שם: ${ctx.customerName || '(לא ידוע)'}
- טלפון: ${ctx.customerPhone}`;
}

function buildStateMessage(state: AgentState): string | null {
  const parts: string[] = [];
  if (state.selectedServiceName) parts.push(`שירות שנבחר: ${state.selectedServiceName}`);
  if (state.selectedDate) parts.push(`תאריך שנבחר: ${state.selectedDate}`);
  if (state.selectedTime) parts.push(`שעה שנבחרה: ${state.selectedTime}`);
  if (state.lastBotMessage) parts.push(`הודעת הבוט הקודמת: "${state.lastBotMessage}"`);
  if (parts.length === 0) return null;
  return `[הקשר נוכחי]\n${parts.join('\n')}`;
}

/**
 * Run one user-turn through the agent. Returns the bot reply and any
 * state to persist back to the session.
 */
export async function runAgent(input: AgentInput): Promise<AgentResult> {
  if (!config.anthropic.apiKey) {
    throw new Error('AGENT_NO_API_KEY');
  }

  const messages: Anthropic.MessageParam[] = [];
  const stateMsg = buildStateMessage(input.state);
  if (stateMsg) {
    messages.push({ role: 'user', content: stateMsg });
    messages.push({ role: 'assistant', content: 'הבנתי. ממשיך מכאן.' });
  }
  messages.push({ role: 'user', content: input.userMessage });

  const stateUpdates: Partial<AgentState> = {};
  let reply = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: buildSystemPrompt(input.ctx),
      tools: TOOL_DEFINITIONS as any,
      messages,
    });

    // Collect any text reply chunks for the final user-facing message
    const textParts = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text);
    if (textParts.length > 0) reply = textParts.join('\n').trim();

    if (response.stop_reason !== 'tool_use') {
      // Done — no more tool calls
      break;
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (toolUseBlocks.length === 0) break;

    // Add the assistant's tool_use turn
    messages.push({ role: 'assistant', content: response.content });

    // Run each tool and add the results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const result = await runTool(input.ctx, block.name, block.input as Record<string, unknown>);

      // Track state updates from key tool calls so we can persist them
      if (block.name === 'lock_slot' && result.ok) {
        const args = block.input as { service_id: string; date: string; time: string };
        stateUpdates.selectedDate = args.date;
        stateUpdates.selectedTime = args.time;
      }
      if (block.name === 'create_appointment' && result.ok) {
        // Clear state — booking complete
        stateUpdates.selectedServiceName = undefined;
        stateUpdates.selectedDate = undefined;
        stateUpdates.selectedTime = undefined;
      }
      if (block.name === 'get_services' && result.ok) {
        // No-op — the agent will surface the service in subsequent turns.
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: !result.ok,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (!reply) {
    reply = 'סליחה, לא הצלחתי להבין. אפשר לנסות שוב?';
  }

  stateUpdates.lastBotMessage = reply;
  return { reply, stateUpdates };
}

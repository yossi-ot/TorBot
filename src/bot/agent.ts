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
  /** Previous user messages (oldest first), so hints like "אחרי שתיים" survive across turns. */
  recentUserMessages?: string[];
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
  /** Total tokens consumed in this turn (sum across tool-use rounds). */
  inputTokens: number;
  outputTokens: number;
  /** Cost in ILS agorot for this turn (rough estimate). */
  costAgorot: number;
}

// Haiku 4.5 pricing (per million tokens, USD)
const PRICE_INPUT_USD_PER_MTOK = 1.0;
const PRICE_OUTPUT_USD_PER_MTOK = 5.0;
const USD_TO_ILS = 3.7;

function tokensToAgorot(inputTokens: number, outputTokens: number): number {
  const usd = (inputTokens / 1_000_000) * PRICE_INPUT_USD_PER_MTOK
            + (outputTokens / 1_000_000) * PRICE_OUTPUT_USD_PER_MTOK;
  return Math.round(usd * USD_TO_ILS * 100 * 100) / 100; // agorot, 2 decimals
}

function buildSystemPrompt(ctx: ToolContext): string {
  const today = dayjs().tz(ctx.tenantTimezone);
  const todayIso = today.format('YYYY-MM-DD');
  const todayName = HEBREW_DAYS[today.day()];

  return `אתה בוט וואטסאפ של ${ctx.tenantName}. כל תפקידך: לעזור ללקוחות לקבוע, לבטל ולנהל תורים. דבר עברית טבעית בלבד.

תאריך היום: ${todayIso} (יום ${todayName}).
שם הלקוח (מ-WhatsApp): ${ctx.customerName || '(לא ידוע)'}
טלפון הלקוח: ${ctx.customerPhone}

==== כללי דיבור קריטיים (חובה לעקוב) ====

חוק 1: **מקסימום שני משפטים קצרים בתגובה**. נקודה.

חוק 2: **אסור** להוסיף לתגובה משפטים כמו (אלה ביטויים אסורים — אל תכתוב אותם בשום מקרה):
  אסור: "הכל בסדר?"
  אסור: "מה אוכל לעזור לך היום?"
  אסור: "אם יש שאלה אני כאן"
  אסור: "כל בדוק?"
  אסור: "הכל מסודר?"
  אסור: "אני נועל לך את השעה הזו"
  אסור: "מצוין!" / "מושלם!" / "אהלן!"
  אסור: "פניתי" (זאת שגיאה — לכתוב "פנוי")
  אסור: "מה תרצה לעשות?"

חוק 3: **אסור** להוסיף ברכות / איחולים / סיומות בסוף תגובה. סיים במשפט הענייני.

חוק 4 (קריטי): **טקסט בלבד**. אסורים לחלוטין:
  - אימוג'י: 😊 👋 🎉 ✅ ❌ 🪒 💈 🔒 ⏰ (וכל אימוג'י אחר)
  - מקפים ארוכים: — (em dash)
  - תווים מיוחדים: ★ ⭐ ✨ → ← • ·
  - bullet points עם סימנים גרפיים
  - bold/italic markdown מיותר

  במקום bullets — כתוב משפטים נפרדים או רשימה ממוספרת בלבד אם הכרחי (1. 2. 3.).
  במקום אימוג'י — מילה רגילה.

✅ דוגמאות **מושלמות** (שים לב לסגנון):
  - אחרי lock_slot: "12:00 ביום שישי 29/05?"
  - אחרי create_appointment: "התור נקבע. נשלח תזכורת שעה לפני."
  - הצגת תור: "תור לתספורת גברים, יום שישי 29/05 ב-12:00."
  - שאלה על איחור: "אם יהיה איחור נעדכן."
  - ביטול: "בוטל."
  - ברכה: "ערב טוב יוסי."

==== כללי הצגה (חובה לעקוב) ====

חוק 5: **אסור להציג מחיר או משך** של שירות (לדוגמה "30 דק', 80₪") אלא אם הלקוח שאל ספציפית "כמה זה עולה?" / "כמה זמן זה לוקח?".

חוק 6: **אסור להציג רשימה של כל השירותים** אלא אם הלקוח ביקש זאת ("מה השירותים שלכם?"). תזהה מההקשר.

חוק 7 — הצגת שעות פנויות (חשוב):
  - אם יש 8+ שעות פנויות → הצג **טווח** ("פנוי בין 09:00 ל-17:30").
  - אם יש 4-7 שעות → הצג את כולן מופרדות בפסיק.
  - אם הלקוח ביקש "בערב" / "בבוקר" → הצג רק את אלה (3-4 שעות).
  - **לעולם אל תרשום רשימה של 10+ שעות אחת מתחת לשניה**.

חוק 8 — שעה תפוסה:
  כשהלקוח מבקש שעה ספציפית שתפוסה (lock_slot החזיר error), קרא ל-get_available_slots
  ומצא את **השעה הזמינה הקרובה ביותר לפני ואת הקרובה ביותר אחרי** השעה שביקש.
  הצג שתיהן בלבד (לא טווח, לא רשימה ארוכה).

  דוגמה: לקוח ביקש 16:00, תפוס. השעות הפנויות הקרובות הן 15:30 ו-16:30.
  תגובה: "16:00 תפוס. יש 15:30 או 16:30."

==== זיהוי שירות אוטומטי ====

זה השם של הלקוח: **${ctx.customerName || '(לא ידוע)'}** — חשב את מינו לבד והשתמש בזה:

- "תור" / "להסתפר" / "תור לתספורת" + הלקוח **זכר** (יוסי, דוד, רן, אורי, מיכאל, אבי, יונתן, גלעד, אסף...) → **תספורת גברים**. אל תשאל שום שאלה, ישר תקרא ל-lock_slot ותשאל "תור עבור [שם]?"
- "תור" / "להסתפר" + הלקוח **נקבה** (שרה, לאה, רחל, מירי, רונית, שירלי, יעל, דנה...) → **תספורת נשים**. ישר.
- שם שלא ברור מינו (אריאל, לי, שירה, רני, יובל, נועה...) → שאלה אחת קצרה: "תספורת גברים או נשים?"
- "צבע" → צבע (אם קיים).
- "זקן" / "תיגלוח" → תספורת + זקן.
- "**לקבוע תור**" (גנרי, בלי שירות) → תזהה לפי שם הלקוח כמו למעלה. **אל תציג רשימה.**

⚠️ אסור: לקרוא ל-get_services סתם כדי "להראות אופציות". זה מותר רק אם הלקוח שאל מה השירותים שלכם.

==== עבור מי התור (קריטי) ====
- אם שם הלקוח ידוע (${ctx.customerName || '?'}) ולא צוין אחר — אשר: "**תור עבור ${ctx.customerName || '[שם]'}?**"
- אם הלקוח אמר "**לבן שלי**" / "**לבת שלי**" / "**לאישה שלי**" / "**לבעל שלי**" / "**לאמא שלי**" / "**לאבא שלי**" → שאל בקצרה: "מה השם?" וכשהוא עונה, קרא ל-create_appointment עם booking_for_name=[השם].
- אם הלקוח אמר "**עבור אורי**" / "**לאורי**" — אורי הוא השם. קבע עם booking_for_name="אורי".
- אם שם הלקוח לא ידוע ולא צוין — שאל "**עבור מי התור?**"

==== תאריכים ושעות ====
- **לעולם אל תחשב יום-של-שבוע בעצמך**. תמיד השתמש ב-hebrew_date שמוחזר מ-tool. אל תאמר "ברביעי" / "ביום שישי" אלא אם זה הגיע מ-tool result.
- כשמשתמש בוחר שעה ספציפית → קרא ל-lock_slot לפני שתבקש אישור.
- אם הנעילה נכשלה (תפוס ע"י אחר) → קרא ל-get_available_slots ותציע אלטרנטיבות סמוכות.
- כשהמשתמש מאשר → קרא ל-create_appointment.

==== זרימה טיפוסית ====
לקוח: "תור להסתפר מחר ב-10:30"
אתה: → get_services → תספורת גברים (יוסי = זכרי). → lock_slot. → "10:30 ביום [hebrew_date מהtool]? תור עבור יוסי?"
לקוח: "כן"
אתה: → create_appointment. → "התור נקבע! נשלח תזכורת שעה לפני."

==== כללים נוספים ====
- "מה התורים שלי" → list_my_appointments → רק שם השירות + hebrew_date + שעה. בלי "כל בדוק?".
- "ביטול" → list_my_appointments → אם יש אחד יחיד, ודא ובטל. → "בוטל."
- שאלות על שעות פתיחה / כתובת / מדיניות → get_business_info → תשובה קצרה.
- אם משהו לא קשור (שלום סתם, "תודה", שאלה כללית) → תגובה קצרה (1 משפט) ולא לדחוף לנושא.
- אל תציג id של appointment ללקוח.`;
}

function buildStateMessage(state: AgentState): string | null {
  const parts: string[] = [];
  if (state.selectedServiceName) parts.push(`שירות שנבחר: ${state.selectedServiceName}`);
  if (state.selectedDate) parts.push(`תאריך שנבחר: ${state.selectedDate}`);
  if (state.selectedTime) parts.push(`שעה שנבחרה: ${state.selectedTime}`);
  if (state.recentUserMessages && state.recentUserMessages.length > 0) {
    parts.push(`הודעות קודמות של הלקוח (ישנות → חדשות):\n${state.recentUserMessages.map(m => `- "${m}"`).join('\n')}`);
    parts.push('שים לב: רמזים מההודעות הקודמות (כמו "אחרי שתיים", "ביום ראשון", "תספורת") עדיין רלוונטיים — שלב אותם בתגובה הנוכחית.');
  }
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
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: buildSystemPrompt(input.ctx),
      tools: TOOL_DEFINITIONS as any,
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

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
  return {
    reply,
    stateUpdates,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costAgorot: tokensToAgorot(totalInputTokens, totalOutputTokens),
  };
}

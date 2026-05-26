import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

export interface NormalizedMessage {
  intent: 'book' | 'cancel' | 'list' | 'greeting' | 'unknown';
  /** Exact service name from the tenant's services list, when the user named one. */
  serviceName?: string;
  /** ISO yyyy-mm-dd, or the strings 'today' / 'tomorrow'. */
  date?: string;
  /** HH:mm in 24h, when the user gave a specific time. */
  time?: string;
}

export interface NormalizerContext {
  businessName: string;
  serviceNames: string[];
  /** Tenant timezone for resolving "today"/"tomorrow" if needed. */
  todayIso: string;
}

/**
 * Use a small LLM (Haiku) to convert a natural-language WhatsApp message
 * into a structured intent + entities. Deterministic code downstream
 * decides how to act on the result.
 */
export async function normalizeMessage(
  userMessage: string,
  ctx: NormalizerContext,
): Promise<NormalizedMessage> {
  if (!config.anthropic.apiKey) {
    return { intent: 'unknown' };
  }

  const systemPrompt = `אתה מסווג כוונות בעברית עבור בוט קביעת תורים בוואטסאפ.

תאריך היום: ${ctx.todayIso} (אזור זמן ישראל).
שם העסק: ${ctx.businessName}.
שמות שירותים זמינים (השתמש בשמות בדיוק כמו כאן): ${ctx.serviceNames.join(' | ')}.

מטרה: לחלץ מהודעת הלקוח כוונה (intent) וישויות (entities). החזר JSON בלבד, ללא טקסט נוסף:

{
  "intent": "book" | "cancel" | "list" | "greeting" | "unknown",
  "serviceName": "<שם מהרשימה בדיוק, או השמט אם לא צויין>",
  "date": "<YYYY-MM-DD או 'today' או 'tomorrow', או השמט>",
  "time": "<HH:mm 24h, או השמט>"
}

כללים:
- "תור", "להגיע", "פנוי", "פגישה", "לקבוע", "להזמין" → book
- "ביטול", "לבטל", "מבטל" → cancel
- "התורים שלי", "הזמנות שלי" → list
- "היי", "שלום", "בוקר טוב" וכו' ללא תוכן נוסף → greeting
- אחרת או לא רלוונטי → unknown
- date: "מחר" → tomorrow, "היום" → today, "ראשון הבא" → חשב תאריך בפורמט YYYY-MM-DD
- "בערב" / "בבוקר" → השמט את time (זה לא שעה ספציפית)
- "עשר וחצי" → 10:30, "שמונה בערב" → 20:00
- serviceName: רק אם הלקוח ציין שירות מהרשימה. אל תנחש.
- אם לא בטוח לגבי שדה — השמט אותו. השמטה עדיפה על ניחוש שגוי.`;

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { intent: 'unknown' };

    const parsed = JSON.parse(jsonMatch[0]) as NormalizedMessage;
    if (!parsed.intent) return { intent: 'unknown' };
    return parsed;
  } catch (err) {
    console.error('AI normalizer error:', err);
    return { intent: 'unknown' };
  }
}

/**
 * Mid-flow micro-interpreters. Called only when the deterministic parser
 * fails in a specific state, so the prompts are tiny and the cost is low
 * (~0.06 agorot per call).
 */

async function interpretWithPrompt(systemPrompt: string, userMessage: string): Promise<string> {
  if (!config.anthropic.apiKey) return 'unclear';
  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return text.trim().replace(/[."'`]/g, '');
  } catch (err) {
    console.error('AI interpret error:', err);
    return 'unclear';
  }
}

/** Returns one of the service names from the list, or null. */
export async function interpretService(text: string, serviceNames: string[]): Promise<string | null> {
  const result = await interpretWithPrompt(
    `המשתמש בוחר שירות מהרשימה הבאה: ${serviceNames.join(' | ')}.
החזר את שם השירות בדיוק כמו ברשימה, או "unclear" אם לא ברור.
החזר רק את השם או "unclear", ללא טקסט נוסף.`,
    text,
  );
  if (result === 'unclear') return null;
  return serviceNames.find(n => n === result) || null;
}

/** Returns YYYY-MM-DD, 'today', 'tomorrow', or null. */
export async function interpretDate(text: string, todayIso: string): Promise<string | null> {
  const result = await interpretWithPrompt(
    `תאריך היום: ${todayIso} (אזור זמן ישראל).
המשתמש בוחר תאריך לתור.
החזר את התאריך כ-YYYY-MM-DD או 'today' או 'tomorrow', או "unclear".
החזר רק את הערך, ללא טקסט נוסף.`,
    text,
  );
  if (result === 'unclear') return null;
  if (result === 'today' || result === 'tomorrow') return result;
  if (/^\d{4}-\d{2}-\d{2}$/.test(result)) return result;
  return null;
}

/** Returns HH:mm in 24h, or null. */
export async function interpretTime(text: string, availableTimes: string[]): Promise<string | null> {
  const sample = availableTimes.slice(0, 5).join(', ');
  const result = await interpretWithPrompt(
    `המשתמש בוחר שעה לתור. דוגמאות לשעות פנויות: ${sample}.
החזר את השעה בפורמט HH:mm (24 שעות), או "unclear".
"עשר בערב" = 22:00. "עשר בבוקר" = 10:00. "מאוחר בערב" = 19:00 (השעה האחרונה הסבירה).
החזר רק את השעה או "unclear", ללא טקסט נוסף.`,
    text,
  );
  if (result === 'unclear') return null;
  if (/^\d{1,2}:\d{2}$/.test(result)) {
    const [h, m] = result.split(':').map(Number);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return null;
}

/** Returns 'yes', 'no', or null. */
export async function interpretConfirm(text: string): Promise<'yes' | 'no' | null> {
  const result = await interpretWithPrompt(
    `המשתמש מתבקש לאשר פעולה (כן/לא).
החזר 'yes' אם הוא מאשר, 'no' אם הוא מבטל/דוחה, או 'unclear'.
דוגמאות לכן: "תאשר", "בסדר", "בוא נעשה", "סבבה", "אישור", "אוקיי".
דוגמאות ללא: "לא", "ביטול", "עזוב", "תוותר", "לא כרגע".
החזר רק את הערך, ללא טקסט נוסף.`,
    text,
  );
  if (result === 'yes') return 'yes';
  if (result === 'no') return 'no';
  return null;
}

/**
 * Context-aware rescue for users stuck mid-booking. Unlike normalizeMessage
 * (which treats the input as a fresh first message), this one knows what
 * the user already selected and what step they're on, so it can interpret
 * complaints / re-tries like "לא טוב מה לגבי יום שני" as a date change.
 */
export interface MidFlowContext {
  selectedServiceName?: string;
  selectedDate?: string;       // YYYY-MM-DD
  selectedTime?: string;       // HH:mm
  awaitingFor: 'service' | 'date' | 'time' | 'confirm';
  serviceNames: string[];
  todayIso: string;
}

export type MidFlowDecision =
  | { action: 'value'; value: string }
  | { action: 'change_service'; serviceName: string }
  | { action: 'change_date'; date: string }
  | { action: 'change_time'; time: string }
  | { action: 'restart'; serviceName?: string; date?: string; time?: string }
  | { action: 'cancel' }
  | { action: 'list' }
  | { action: 'greeting' }
  | { action: 'unclear' };

export async function rescueMidFlow(text: string, ctx: MidFlowContext): Promise<MidFlowDecision> {
  if (!config.anthropic.apiKey) return { action: 'unclear' };

  const ask = {
    service: `שם השירות מהרשימה: ${ctx.serviceNames.join(' | ')}`,
    date: 'תאריך (YYYY-MM-DD או today/tomorrow)',
    time: 'שעה בפורמט HH:mm',
    confirm: 'אישור (yes/no)',
  }[ctx.awaitingFor];

  const systemPrompt = `אתה מסייע לבוט קביעת תורים בעברית.

מצב נוכחי של המשתמש:
- שירות שנבחר: ${ctx.selectedServiceName || '(טרם נבחר)'}
- תאריך שנבחר: ${ctx.selectedDate || '(טרם נבחר)'}
- שעה שנבחרה: ${ctx.selectedTime || '(טרם נבחרה)'}
- בשלב הנוכחי מצפים מהמשתמש לתת: ${ask}

המשתמש כתב טקסט שלא ניתן לפרש כקלט הצפוי. נסה להבין מה הוא רוצה.
תאריך היום: ${ctx.todayIso}.
שירותים זמינים: ${ctx.serviceNames.join(' | ')}.

החזר JSON בלבד, ללא טקסט נוסף. אחד מהפורמטים הבאים:

{ "action": "value", "value": "<ערך בפורמט המתאים לשלב הנוכחי>" }
  כשהמשתמש נתן את הערך הצפוי בשלב הנוכחי.

{ "action": "change_service", "serviceName": "<שם מהרשימה>" }
  שינוי קל — רק שירות אחר, התאריך/שעה נשארים אם הם תקפים.

{ "action": "change_date", "date": "<YYYY-MM-DD או today/tomorrow>" }
  שינוי קל — רק תאריך אחר.

{ "action": "change_time", "time": "<HH:mm>" }
  שינוי קל — רק שעה אחרת.

{ "action": "restart", "serviceName": "<אופציונלי>", "date": "<אופציונלי>", "time": "<אופציונלי>" }
  ★ השתמש בזה אם המשתמש מגיש בקשה חדשה לחלוטין (מזכיר שירות וגם תאריך, או שנראה
  שהוא מתחיל הכל מחדש). אל תשתמש בזה בשינוי קל של שדה אחד.

{ "action": "cancel" }
  המשתמש רוצה לבטל את התהליך הנוכחי.

{ "action": "list" }
  המשתמש שואל על התורים שלו.

{ "action": "greeting" }
  ברכה ידידותית באמצע השיחה (היי, בוקר טוב, מה נשמע). לא מבקש כלום ספציפי.

{ "action": "unclear" }
  באמת לא ברור.

דוגמאות:
- "לא טוב מה לגבי יום שני" → { "action":"change_date", "date":"<יום שני הבא>" }
- "אני בעצם רוצה צבע" → { "action":"change_service", "serviceName":"צבע" }
- "יש לכם זמן ביום ראשון בערב לתספורת" → { "action":"restart", "serviceName":"תספורת גברים", "date":"<ראשון הבא>" }
- "תור לצבע מחר ב-14:00" → { "action":"restart", "serviceName":"צבע", "date":"tomorrow", "time":"14:00" }
- "בוקר טוב" / "מה קורה" → { "action":"greeting" }
- "בוא נעשה" → { "action":"value", "value":"yes" }
- "מאוחר בערב" → { "action":"value", "value":"19:00" }
- "תוותר" → { "action":"cancel" }`;

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    });
    const out = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = out.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { action: 'unclear' };
    const parsed = JSON.parse(jsonMatch[0]) as MidFlowDecision;
    return parsed;
  } catch (err) {
    console.error('rescueMidFlow error:', err);
    return { action: 'unclear' };
  }
}

/** Free-form chat for cases the normalizer can't resolve. Kept for backwards compat. */
export async function generateResponse(userMessage: string, systemPrompt: string): Promise<string> {
  if (!config.anthropic.apiKey) {
    return 'סליחה, לא הבנתי. אפשר לנסות:\n1️⃣ קביעת תור\n2️⃣ ביטול תור\n3️⃣ התורים שלי';
  }

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (err) {
    console.error('AI response error:', err);
    return 'סליחה, לא הבנתי. אפשר לנסות:\n1️⃣ קביעת תור\n2️⃣ ביטול תור\n3️⃣ התורים שלי';
  }
}

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

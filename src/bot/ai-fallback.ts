import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

export interface AiIntent {
  intent: 'book' | 'cancel' | 'list' | 'greeting' | 'unknown';
  date?: string;
  time?: string;
  serviceName?: string;
}

export async function detectIntent(userMessage: string, businessContext: string): Promise<AiIntent> {
  if (!config.anthropic.apiKey) {
    return { intent: 'unknown' };
  }

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `אתה מנתח הודעות עבור בוט קביעת תורים. ${businessContext}
תחזיר JSON בלבד עם השדות:
- intent: "book" | "cancel" | "list" | "greeting" | "unknown"
- date: תאריך אם הוזכר (YYYY-MM-DD או "today"/"tomorrow")
- time: שעה אם הוזכרה (HH:mm)
- serviceName: שם השירות אם הוזכר
אל תוסיף טקסט, רק JSON.`,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AiIntent;
    }
  } catch (err) {
    console.error('AI fallback error:', err);
  }

  return { intent: 'unknown' };
}

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

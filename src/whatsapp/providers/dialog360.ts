import { postWithRetry } from '../http.js';
import type {
  WhatsAppProvider,
  SendTextOptions,
  SendTemplateOptions,
  IncomingMessage,
} from '../provider.js';

/**
 * 360dialog Cloud API (https://docs.360dialog.com/docs/waba-messaging/cloud-api).
 * Endpoint format mirrors Meta's Graph API but auth is via D360-API-KEY header
 * and the URL has no phone_number_id (the API key is bound to one number).
 */
const BASE_URL = 'https://waba-v2.360dialog.io';

function requireDialog360Creds(creds: SendTextOptions['credentials']) {
  if (creds.kind !== 'dialog360') {
    throw new Error(`Dialog360Provider expected dialog360 credentials, got ${creds.kind}`);
  }
  return creds;
}

interface Dialog360WebhookBody {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from: string;
          id: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}

export const dialog360Provider: WhatsAppProvider = {
  name: 'dialog360',

  async sendText(opts: SendTextOptions) {
    const c = requireDialog360Creds(opts.credentials);
    await postWithRetry({
      url: `${BASE_URL}/messages`,
      headers: { 'D360-API-KEY': c.apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: opts.to,
        type: 'text',
        text: { body: opts.text },
      }),
      label: '360dialog text',
    });
  },

  async sendTemplate(opts: SendTemplateOptions) {
    const c = requireDialog360Creds(opts.credentials);
    await postWithRetry({
      url: `${BASE_URL}/messages`,
      headers: { 'D360-API-KEY': c.apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: opts.to,
        type: 'template',
        template: {
          name: opts.templateName,
          language: { code: opts.languageCode },
          components: opts.parameters.length > 0 ? [{
            type: 'body',
            parameters: opts.parameters.map(p => ({ type: 'text', text: p })),
          }] : undefined,
        },
      }),
      label: '360dialog template',
    });
  },

  parseIncoming(body: unknown): IncomingMessage[] {
    // 360dialog passes Meta's payload through unchanged.
    const b = body as Dialog360WebhookBody;
    if (!b?.entry) return [];

    const out: IncomingMessage[] = [];
    for (const entry of b.entry) {
      for (const change of entry.changes || []) {
        const value = change.value;
        const channelId = value.metadata?.phone_number_id;
        if (!channelId || !value.messages) continue;

        const contactName = value.contacts?.[0]?.profile?.name || '';

        for (const m of value.messages) {
          if (m.type !== 'text' || !m.text) continue;
          out.push({
            channelId,
            from: m.from,
            text: m.text.body,
            contactName,
            messageId: m.id,
          });
        }
      }
    }
    return out;
  },
};

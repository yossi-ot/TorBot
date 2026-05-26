import { postWithRetry } from '../http.js';
import type {
  WhatsAppProvider,
  SendTextOptions,
  SendTemplateOptions,
  SendTypingIndicatorOptions,
  IncomingMessage,
} from '../provider.js';

const BASE_URL = 'https://graph.facebook.com/v21.0';

function requireMetaCreds(creds: SendTextOptions['credentials']) {
  if (creds.kind !== 'meta') {
    throw new Error(`MetaProvider expected meta credentials, got ${creds.kind}`);
  }
  return creds;
}

interface MetaWebhookBody {
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

export const metaProvider: WhatsAppProvider = {
  name: 'meta',

  async sendText(opts: SendTextOptions) {
    const c = requireMetaCreds(opts.credentials);
    await postWithRetry({
      url: `${BASE_URL}/${c.phoneNumberId}/messages`,
      headers: { Authorization: `Bearer ${c.accessToken}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: opts.to,
        type: 'text',
        text: { body: opts.text },
      }),
      label: 'Meta text',
    });
  },

  async sendTemplate(opts: SendTemplateOptions) {
    const c = requireMetaCreds(opts.credentials);
    await postWithRetry({
      url: `${BASE_URL}/${c.phoneNumberId}/messages`,
      headers: { Authorization: `Bearer ${c.accessToken}` },
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
      label: 'Meta template',
    });
  },

  async sendTypingIndicator(opts: SendTypingIndicatorOptions) {
    const c = opts.credentials;
    if (c.kind !== 'meta') return;
    await postWithRetry({
      url: `${BASE_URL}/${c.phoneNumberId}/messages`,
      headers: { Authorization: `Bearer ${c.accessToken}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: opts.messageId,
        typing_indicator: { type: 'text' },
      }),
      label: 'Meta typing',
    });
  },

  parseIncoming(body: unknown): IncomingMessage[] {
    const b = body as MetaWebhookBody;
    if (b?.object !== 'whatsapp_business_account' || !b.entry) return [];

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

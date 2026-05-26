import type {
  WhatsAppProvider,
  SendTextOptions,
  SendTemplateOptions,
  IncomingMessage,
} from '../provider.js';

/**
 * 360dialog Cloud API (https://docs.360dialog.com/docs/waba-messaging/cloud-api).
 * Endpoint format mirrors Meta's Graph API but auth is via D360-API-KEY header.
 *
 * Sandbox vs Production use different hosts/paths, and 360dialog does not
 * publish a way to detect which one a key belongs to. We try them in order
 * and use whichever the key authenticates against.
 */
const SEND_ENDPOINTS = [
  'https://waba-sandbox.360dialog.io/v1/messages',
  'https://waba-v2.360dialog.io/messages',
  'https://waba.360dialog.io/v1/messages',
];

function requireDialog360Creds(creds: SendTextOptions['credentials']) {
  if (creds.kind !== 'dialog360') {
    throw new Error(`Dialog360Provider expected dialog360 credentials, got ${creds.kind}`);
  }
  return creds;
}

async function sendToFirstAcceptingHost(apiKey: string, payload: string, label: string): Promise<void> {
  const errors: string[] = [];
  for (const url of SEND_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'D360-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: payload,
      });
      if (res.ok) {
        console.log(`[${label}] sent via ${url}`);
        return;
      }
      const text = await res.text();
      errors.push(`${url} → ${res.status}: ${text.slice(0, 120)}`);
      // 401/403 means wrong host/key; try next. Other 4xx means key is right but request is bad - stop.
      if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
        throw new Error(`${label} failed: ${url} ${res.status}: ${text}`);
      }
    } catch (err: any) {
      if (err.message?.startsWith(`${label} failed:`)) throw err;
      errors.push(`${url} → network: ${err.message}`);
    }
  }
  throw new Error(`${label} failed on all hosts: ${errors.join(' | ')}`);
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
    await sendToFirstAcceptingHost(c.apiKey, JSON.stringify({
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'text',
      text: { body: opts.text },
    }), '360dialog text');
  },

  async sendTemplate(opts: SendTemplateOptions) {
    const c = requireDialog360Creds(opts.credentials);
    await sendToFirstAcceptingHost(c.apiKey, JSON.stringify({
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
    }), '360dialog template');
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

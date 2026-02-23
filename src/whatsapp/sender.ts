import { config } from '../config.js';

const BASE_URL = 'https://graph.facebook.com/v21.0';

interface SendMessageOptions {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}

export async function sendWhatsAppMessage(opts: SendMessageOptions): Promise<void> {
  const url = `${BASE_URL}/${opts.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: opts.to,
      type: 'text',
      text: { body: opts.text },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('WhatsApp send error:', error);
  }
}

/** Send a template message (for reminders - must be pre-approved by Meta) */
export async function sendTemplateMessage(opts: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
}): Promise<void> {
  const url = `${BASE_URL}/${opts.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
    },
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
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('WhatsApp template send error:', error);
  }
}

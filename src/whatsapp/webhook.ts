import { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { handleIncomingMessage } from '../bot/router.js';

export interface WhatsAppMessage {
  from: string;       // sender phone number
  id: string;         // message id
  timestamp: string;
  type: string;
  text?: { body: string };
}

export interface WhatsAppWebhookBody {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: WhatsAppMessage[];
        statuses?: unknown[];
      };
      field: string;
    }>;
  }>;
}

export function registerWebhookRoutes(app: FastifyInstance) {
  // Meta verification endpoint
  app.get('/webhook', async (request, reply) => {
    const query = request.query as any;
    // Fastify may parse hub.mode as nested { hub: { mode } } or flat { 'hub.mode' }
    const mode = query['hub.mode'] || query?.hub?.mode;
    const token = query['hub.verify_token'] || query?.hub?.verify_token;
    const challenge = query['hub.challenge'] || query?.hub?.challenge;

    console.log('Webhook verify attempt:', { mode, token: token ? '***' : 'empty', challenge, configToken: config.whatsapp.verifyToken ? '***' : 'empty' });

    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      console.log('Webhook verified successfully');
      return reply.code(200).send(challenge);
    }

    console.log('Webhook verification FAILED');
    return reply.code(403).send('Forbidden');
  });

  // Receive messages
  app.post('/webhook', async (request, reply) => {
    const body = request.body as WhatsAppWebhookBody;

    if (body.object !== 'whatsapp_business_account') {
      return reply.code(404).send();
    }

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        const phoneNumberId = value.metadata.phone_number_id;

        if (!value.messages) continue;

        for (const message of value.messages) {
          if (message.type !== 'text' || !message.text) continue;

          const contactName = value.contacts?.[0]?.profile?.name || '';

          // Handle message asynchronously - don't block webhook response
          handleIncomingMessage({
            phoneNumberId,
            from: message.from,
            text: message.text.body,
            contactName,
          }).catch(err => console.error('Error handling message:', err));
        }
      }
    }

    // Always return 200 quickly to WhatsApp
    return reply.code(200).send('OK');
  });
}

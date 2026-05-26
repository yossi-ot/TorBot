import { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { handleIncomingMessage } from '../bot/router.js';
import { metaProvider } from './providers/meta.js';
import { dialog360Provider } from './providers/dialog360.js';
import type { IncomingMessage } from './provider.js';

export function registerWebhookRoutes(app: FastifyInstance) {
  // Meta verification handshake (only needed for Meta-direct tenants; harmless for 360dialog).
  app.get('/webhook', async (request, reply) => {
    const query = request.query as any;
    const mode = query['hub.mode'] || query?.hub?.mode;
    const token = query['hub.verify_token'] || query?.hub?.verify_token;
    const challenge = query['hub.challenge'] || query?.hub?.challenge;

    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      return reply.code(200).send(challenge);
    }
    return reply.code(403).send('Forbidden');
  });

  // Receive inbound messages from either provider.
  app.post('/webhook', async (request, reply) => {
    const body = request.body;
    const messages = detectAndParse(body);

    for (const msg of messages) {
      handleIncomingMessage({
        phoneNumberId: msg.channelId,
        from: msg.from,
        text: msg.text,
        contactName: msg.contactName,
      }).catch(err => console.error('Error handling message:', err));
    }

    return reply.code(200).send('OK');
  });
}

/**
 * Both Meta and 360dialog send Meta-format payloads, so either parser works.
 * We try Meta first (strict object check) then fall back to 360dialog (loose).
 */
function detectAndParse(body: unknown): IncomingMessage[] {
  const metaParsed = metaProvider.parseIncoming(body);
  if (metaParsed.length > 0) return metaParsed;
  return dialog360Provider.parseIncoming(body);
}

import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from './db/index.js';
import { config } from './config.js';

/**
 * Public short link a tenant shares with their customers, e.g.
 * torbot.co.il/w/SARAH4821 -> wa.me/<shared number>?text=SARAH4821
 * The code in the pre-filled text is how the bot later tells tenants apart
 * on the shared platform number (see bot/shared-routing.ts).
 */
export function registerEntryLinkRoute(app: FastifyInstance) {
  app.get('/w/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    const [tenant] = await db.select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.entryCode, code));

    if (!tenant || !config.whatsapp.sharedNumber) {
      return reply.code(404).send('Link not found');
    }

    const url = `https://wa.me/${config.whatsapp.sharedNumber}?text=${encodeURIComponent(code)}`;
    return reply.redirect(url, 302);
  });
}

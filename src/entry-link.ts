import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from './db/index.js';
import { config } from './config.js';

const DEFAULT_LINK_MESSAGE = 'היי! 👋 אני רוצה לקבוע תור';

/**
 * Builds the pre-filled WhatsApp text for a tenant's entry link: a
 * customizable, human-friendly greeting with the entry code appended in a
 * fixed, parseable form - see extractEntryCode() in bot/shared-routing.ts,
 * which is how the bot tells tenants apart on the shared platform number.
 */
export function buildEntryLinkMessage(tenant: { linkMessage?: string | null; entryCode: string | null }): string {
  const greeting = (tenant.linkMessage || DEFAULT_LINK_MESSAGE).trim();
  return `${greeting}\n\n(קוד: ${tenant.entryCode})`;
}

/**
 * Public short link a tenant shares with their customers, e.g.
 * torbot.co.il/w/SARAH4821 -> wa.me/<shared number>?text=<greeting + code>
 */
export function registerEntryLinkRoute(app: FastifyInstance) {
  app.get('/w/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    const [tenant] = await db.select({ entryCode: schema.tenants.entryCode, linkMessage: schema.tenants.linkMessage })
      .from(schema.tenants)
      .where(eq(schema.tenants.entryCode, code));

    if (!tenant || !config.whatsapp.sharedNumber) {
      return reply.code(404).send('Link not found');
    }

    const text = buildEntryLinkMessage(tenant);
    const url = `https://wa.me/${config.whatsapp.sharedNumber}?text=${encodeURIComponent(text)}`;
    return reply.redirect(url, 302);
  });
}

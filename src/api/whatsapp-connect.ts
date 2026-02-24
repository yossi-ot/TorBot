import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';

export function registerWhatsAppConnectRoutes(app: FastifyInstance) {
  // Return Meta app config for frontend SDK initialization
  app.get('/api/whatsapp/config', async () => {
    return {
      appId: config.meta.appId,
      configId: config.meta.configId,
    };
  });

  // Exchange Embedded Signup code for token and save credentials
  app.post('/api/whatsapp/connect', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const { code, wabaId, phoneNumberId } = request.body as {
      code: string;
      wabaId: string;
      phoneNumberId: string;
    };

    if (!code || !wabaId || !phoneNumberId) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    try {
      // 1. Exchange code for short-lived token
      const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token` +
        `?client_id=${config.meta.appId}` +
        `&client_secret=${config.meta.appSecret}` +
        `&code=${code}`;

      const tokenRes = await fetch(tokenUrl);
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error('Token exchange failed:', err);
        return reply.code(400).send({ error: 'Failed to exchange code for token' });
      }
      const { access_token: shortLivedToken } = await tokenRes.json() as { access_token: string };

      // 2. Exchange for long-lived token (60 days)
      const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${config.meta.appId}` +
        `&client_secret=${config.meta.appSecret}` +
        `&fb_exchange_token=${shortLivedToken}`;

      const longLivedRes = await fetch(longLivedUrl);
      if (!longLivedRes.ok) {
        const err = await longLivedRes.text();
        console.error('Long-lived token exchange failed:', err);
        return reply.code(400).send({ error: 'Failed to get long-lived token' });
      }
      const { access_token: longLivedToken } = await longLivedRes.json() as { access_token: string };

      // 3. Subscribe WABA to app webhook
      const subscribeRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${longLivedToken}` },
        }
      );
      if (!subscribeRes.ok) {
        console.error('Webhook subscription failed:', await subscribeRes.text());
        // Non-fatal: might already be subscribed
      }

      // 4. Register phone number for Cloud API
      const registerRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/register`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${longLivedToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messaging_product: 'whatsapp', pin: '000000' }),
        }
      );
      if (!registerRes.ok) {
        console.error('Phone registration:', await registerRes.text());
        // Non-fatal: phone may already be registered
      }

      // 5. Save credentials to tenant
      await db.update(schema.tenants)
        .set({
          wabaId,
          whatsappPhoneNumberId: phoneNumberId,
          whatsappAccessToken: longLivedToken,
        })
        .where(eq(schema.tenants.id, tenantId));

      return { ok: true };
    } catch (err: any) {
      console.error('WhatsApp connect error:', err);
      return reply.code(500).send({ error: err.message || 'Connection failed' });
    }
  });

  // Get WhatsApp connection status
  app.get('/api/whatsapp/status', async (request) => {
    const tenantId = (request as any).tenantId;
    const [tenant] = await db.select({
      phoneNumberId: schema.tenants.whatsappPhoneNumberId,
      wabaId: schema.tenants.wabaId,
    }).from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId));

    if (!tenant) return { connected: false };

    return {
      connected: !!(tenant.phoneNumberId && tenant.phoneNumberId.length > 0),
      phoneNumberId: tenant.phoneNumberId || null,
      wabaId: tenant.wabaId || null,
    };
  });

  // Disconnect WhatsApp
  app.post('/api/whatsapp/disconnect', async (request) => {
    const tenantId = (request as any).tenantId;
    await db.update(schema.tenants)
      .set({
        wabaId: null,
        whatsappPhoneNumberId: '',
        whatsappAccessToken: '',
      })
      .where(eq(schema.tenants.id, tenantId));
    return { ok: true };
  });
}

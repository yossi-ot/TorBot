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
    const body = request.body as {
      code: string;
      wabaId?: string;
      phoneNumberId?: string;
    };

    if (!body.code) {
      return reply.code(400).send({ error: 'Missing code' });
    }

    try {
      // 1. Exchange code for short-lived token
      const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token` +
        `?client_id=${config.meta.appId}` +
        `&client_secret=${config.meta.appSecret}` +
        `&code=${body.code}`;

      console.log('Token exchange URL (without secret):', tokenUrl.replace(config.meta.appSecret, '***'));
      const tokenRes = await fetch(tokenUrl);
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error('Token exchange failed:', err);
        return reply.code(400).send({ error: `Token exchange failed: ${err}` });
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

      // 3. Discover WABA and phone number if not provided by frontend
      let wabaId = body.wabaId || '';
      let phoneNumberId = body.phoneNumberId || '';

      if (!wabaId || !phoneNumberId) {
        console.log('WABA data not provided, discovering from token...');

        // Get shared WABA accounts via the token
        const sharedWabaRes = await fetch(
          `https://graph.facebook.com/v21.0/me/businesses?fields=id,name`,
          { headers: { 'Authorization': `Bearer ${longLivedToken}` } }
        );

        if (sharedWabaRes.ok) {
          const businesses = await sharedWabaRes.json() as { data: { id: string; name: string }[] };
          console.log('Businesses found:', businesses.data?.length || 0);

          for (const biz of (businesses.data || [])) {
            // Get WABA accounts for this business
            const wabaRes = await fetch(
              `https://graph.facebook.com/v21.0/${biz.id}/owned_whatsapp_business_accounts?fields=id,name`,
              { headers: { 'Authorization': `Bearer ${longLivedToken}` } }
            );
            if (!wabaRes.ok) continue;

            const wabas = await wabaRes.json() as { data: { id: string; name: string }[] };
            if (!wabas.data?.length) continue;

            wabaId = wabas.data[0].id;
            console.log(`Found WABA: ${wabaId} (${wabas.data[0].name})`);

            // Get phone numbers for this WABA
            const phonesRes = await fetch(
              `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number`,
              { headers: { 'Authorization': `Bearer ${longLivedToken}` } }
            );
            if (!phonesRes.ok) continue;

            const phones = await phonesRes.json() as { data: { id: string; display_phone_number: string }[] };
            if (phones.data?.length) {
              phoneNumberId = phones.data[0].id;
              console.log(`Found phone: ${phoneNumberId} (${phones.data[0].display_phone_number})`);
              break;
            }
          }
        }

        if (!wabaId || !phoneNumberId) {
          console.error('Could not discover WABA/phone from token');
          return reply.code(400).send({ error: 'Could not find WhatsApp Business Account' });
        }
      }

      // 4. Subscribe WABA to app webhook
      const subscribeRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${longLivedToken}` },
        }
      );
      if (!subscribeRes.ok) {
        console.error('Webhook subscription failed:', await subscribeRes.text());
      }

      // 5. Register phone number for Cloud API
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
      }

      // 6. Save credentials to tenant
      await db.update(schema.tenants)
        .set({
          wabaId,
          whatsappPhoneNumberId: phoneNumberId,
          whatsappAccessToken: longLivedToken,
        })
        .where(eq(schema.tenants.id, tenantId));

      return { ok: true, wabaId, phoneNumberId };
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

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

  // Accept short-lived token from Embedded Signup and save credentials
  app.post('/api/whatsapp/connect', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as {
      accessToken: string;
      wabaId?: string;
      phoneNumberId?: string;
    };

    if (!body.accessToken) {
      return reply.code(400).send({ error: 'Missing access token' });
    }

    try {
      // 1. Exchange short-lived token for long-lived token (60 days)
      const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${config.meta.appId}` +
        `&client_secret=${config.meta.appSecret}` +
        `&fb_exchange_token=${body.accessToken}`;

      console.log('Exchanging for long-lived token...');
      const longLivedRes = await fetch(longLivedUrl);
      if (!longLivedRes.ok) {
        const err = await longLivedRes.text();
        console.error('Long-lived token exchange failed:', err);
        return reply.code(400).send({ error: `Long-lived token exchange failed: ${err}` });
      }
      const { access_token: longLivedToken } = await longLivedRes.json() as { access_token: string };
      console.log('Got long-lived token');

      // 2. Discover WABA and phone number if not provided by frontend
      let wabaId = body.wabaId || '';
      let phoneNumberId = body.phoneNumberId || '';

      if (!wabaId || !phoneNumberId) {
        console.log('WABA data not provided, discovering from token...');

        // Method 1: Debug token to find WABA in granular scopes
        const appToken = `${config.meta.appId}|${config.meta.appSecret}`;
        const debugRes = await fetch(
          `https://graph.facebook.com/v21.0/debug_token?input_token=${longLivedToken}&access_token=${encodeURIComponent(appToken)}`
        );
        if (debugRes.ok) {
          const debugData = await debugRes.json() as any;
          console.log('Debug token scopes:', JSON.stringify(debugData.data?.granular_scopes || []));
          const wabaScope = debugData.data?.granular_scopes?.find(
            (s: any) => s.scope === 'whatsapp_business_management'
          );
          if (wabaScope?.target_ids?.length) {
            wabaId = wabaScope.target_ids[0];
            console.log(`Found WABA from debug_token: ${wabaId}`);
          }
        } else {
          console.log('Debug token failed:', await debugRes.text());
        }

        // Method 2: If we have WABA but no phone, or need both - try businesses
        if (!wabaId) {
          const bizRes = await fetch(
            `https://graph.facebook.com/v21.0/me/businesses?fields=id,name`,
            { headers: { 'Authorization': `Bearer ${longLivedToken}` } }
          );
          if (bizRes.ok) {
            const businesses = await bizRes.json() as { data: { id: string; name: string }[] };
            console.log('Businesses found:', businesses.data?.length || 0);

            for (const biz of (businesses.data || [])) {
              console.log(`Checking business: ${biz.id} (${biz.name})`);

              // Try owned WABAs
              for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
                const wabaRes = await fetch(
                  `https://graph.facebook.com/v21.0/${biz.id}/${edge}?fields=id,name`,
                  { headers: { 'Authorization': `Bearer ${longLivedToken}` } }
                );
                if (!wabaRes.ok) {
                  console.log(`  ${edge}: error ${wabaRes.status}`);
                  continue;
                }
                const wabas = await wabaRes.json() as { data: { id: string; name: string }[] };
                console.log(`  ${edge}: found ${wabas.data?.length || 0}`);
                if (wabas.data?.length) {
                  wabaId = wabas.data[0].id;
                  console.log(`Found WABA via ${edge}: ${wabaId} (${wabas.data[0].name})`);
                  break;
                }
              }
              if (wabaId) break;
            }
          } else {
            console.log('Businesses query failed:', await bizRes.text());
          }
        }

        // Get phone numbers for the discovered WABA
        if (wabaId && !phoneNumberId) {
          const phonesRes = await fetch(
            `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number`,
            { headers: { 'Authorization': `Bearer ${longLivedToken}` } }
          );
          if (phonesRes.ok) {
            const phones = await phonesRes.json() as { data: { id: string; display_phone_number: string }[] };
            console.log(`Phone numbers found: ${phones.data?.length || 0}`);
            if (phones.data?.length) {
              phoneNumberId = phones.data[0].id;
              console.log(`Found phone: ${phoneNumberId} (${phones.data[0].display_phone_number})`);
            }
          } else {
            console.log('Phone numbers query failed:', await phonesRes.text());
          }
        }

        if (!wabaId || !phoneNumberId) {
          console.error(`Discovery failed: wabaId=${wabaId}, phoneNumberId=${phoneNumberId}`);
          return reply.code(400).send({ error: 'Could not find WhatsApp Business Account. Check server logs.' });
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

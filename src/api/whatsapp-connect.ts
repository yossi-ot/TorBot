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
        const diag: string[] = [];
        const dlog = (msg: string) => { console.log(msg); diag.push(msg); };
        dlog('WABA discovery starting...');

        // Method 1: Debug token to find WABA in granular scopes
        const appToken = `${config.meta.appId}|${config.meta.appSecret}`;
        const debugRes = await fetch(
          `https://graph.facebook.com/v21.0/debug_token?input_token=${longLivedToken}&access_token=${encodeURIComponent(appToken)}`
        );
        if (debugRes.ok) {
          const debugData = await debugRes.json() as any;
          const scopes = debugData.data?.granular_scopes || [];
          dlog(`Scopes: ${JSON.stringify(scopes)}`);
          const wabaScope = scopes.find(
            (s: any) => s.scope === 'whatsapp_business_management'
          );
          if (wabaScope?.target_ids?.length) {
            wabaId = wabaScope.target_ids[0];
            dlog(`WABA from scopes: ${wabaId}`);
          } else {
            dlog('No WABA in scopes');
          }
        } else {
          dlog(`debug_token failed: ${await debugRes.text()}`);
        }

        // Method 2: Try businesses
        if (!wabaId) {
          const bizRes = await fetch(
            `https://graph.facebook.com/v21.0/me/businesses?fields=id,name`,
            { headers: { 'Authorization': `Bearer ${longLivedToken}` } }
          );
          if (bizRes.ok) {
            const businesses = await bizRes.json() as { data: { id: string; name: string }[] };
            dlog(`Businesses: ${JSON.stringify(businesses.data?.map(b => `${b.id}:${b.name}`) || [])}`);

            for (const biz of (businesses.data || [])) {
              for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
                const wabaRes = await fetch(
                  `https://graph.facebook.com/v21.0/${biz.id}/${edge}?fields=id,name`,
                  { headers: { 'Authorization': `Bearer ${longLivedToken}` } }
                );
                if (!wabaRes.ok) {
                  dlog(`${edge}: err ${wabaRes.status}`);
                  continue;
                }
                const wabas = await wabaRes.json() as { data: { id: string; name: string }[] };
                dlog(`${edge}: ${JSON.stringify(wabas.data || [])}`);
                if (wabas.data?.length) {
                  wabaId = wabas.data[0].id;
                  break;
                }
              }
              if (wabaId) break;
            }
          } else {
            dlog(`businesses failed: ${await bizRes.text()}`);
          }
        }

        // Get phone numbers - retry a few times as provisioning can take a moment
        if (wabaId && !phoneNumberId) {
          for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
            const phonesRes = await fetch(
              `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number`,
              { headers: { 'Authorization': `Bearer ${longLivedToken}` } }
            );
            if (phonesRes.ok) {
              const phones = await phonesRes.json() as { data: { id: string; display_phone_number: string }[] };
              dlog(`Phones attempt ${attempt + 1}: ${JSON.stringify(phones.data || [])}`);
              if (phones.data?.length) {
                phoneNumberId = phones.data[0].id;
                break;
              }
            } else {
              dlog(`phones attempt ${attempt + 1} failed: ${await phonesRes.text()}`);
            }
          }
        }

        if (!wabaId) {
          return reply.code(400).send({ error: `Discovery failed | ${diag.join(' | ')}` });
        }
      }

      // Subscribe WABA to app webhook
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

      // Register phone number for Cloud API (if we found one)
      if (phoneNumberId) {
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
      }

      // Save credentials to tenant (even without phone - can be completed later)
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 60);

      await db.update(schema.tenants)
        .set({
          wabaId,
          whatsappPhoneNumberId: phoneNumberId || '',
          whatsappAccessToken: longLivedToken,
          tokenExpiresAt: tokenExpiresAt.toISOString(),
        })
        .where(eq(schema.tenants.id, tenantId));

      return { ok: true, wabaId, phoneNumberId, phonePending: !phoneNumberId };
    } catch (err: any) {
      console.error('WhatsApp connect error:', err);
      return reply.code(500).send({ error: err.message || 'Connection failed' });
    }
  });

  // Get WhatsApp connection status
  app.get('/api/whatsapp/status', async (request) => {
    const tenantId = (request as any).tenantId;
    const [tenant] = await db.select({
      provider: schema.tenants.whatsappProvider,
      phoneNumberId: schema.tenants.whatsappPhoneNumberId,
      wabaId: schema.tenants.wabaId,
      accessToken: schema.tenants.whatsappAccessToken,
      tokenExpiresAt: schema.tenants.tokenExpiresAt,
      dialog360ApiKey: schema.tenants.dialog360ApiKey,
    }).from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId));

    if (!tenant) return { connected: false };

    // 360dialog short-circuit: no WABA discovery, no token expiry.
    if (tenant.provider === 'dialog360') {
      const hasPhone = !!(tenant.phoneNumberId && tenant.phoneNumberId.length > 0);
      return {
        connected: hasPhone && !!tenant.dialog360ApiKey,
        provider: 'dialog360',
        phoneNumberId: tenant.phoneNumberId || null,
      };
    }

    const hasWaba = !!(tenant.wabaId && tenant.wabaId.length > 0);
    const hasPhone = !!(tenant.phoneNumberId && tenant.phoneNumberId.length > 0);

    // Calculate token expiry info
    let daysUntilExpiry: number | null = null;
    let tokenExpiring = false;
    if (tenant.tokenExpiresAt) {
      const expiresAt = new Date(tenant.tokenExpiresAt);
      daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      tokenExpiring = daysUntilExpiry <= 7;
    }

    // If we have WABA but no phone, try to discover it now
    if (hasWaba && !hasPhone && tenant.accessToken) {
      const phonesRes = await fetch(
        `https://graph.facebook.com/v21.0/${tenant.wabaId}/phone_numbers?fields=id,display_phone_number`,
        { headers: { 'Authorization': `Bearer ${tenant.accessToken}` } }
      );
      if (phonesRes.ok) {
        const phones = await phonesRes.json() as { data: { id: string; display_phone_number: string }[] };
        if (phones.data?.length) {
          const phoneId = phones.data[0].id;
          await db.update(schema.tenants)
            .set({ whatsappPhoneNumberId: phoneId })
            .where(eq(schema.tenants.id, tenantId));
          return { connected: true, phoneNumberId: phoneId, wabaId: tenant.wabaId, phonePending: false, daysUntilExpiry, tokenExpiring };
        }
      }
      return { connected: false, phoneNumberId: null, wabaId: tenant.wabaId, phonePending: true, daysUntilExpiry, tokenExpiring };
    }

    return {
      connected: hasPhone,
      phoneNumberId: tenant.phoneNumberId || null,
      wabaId: tenant.wabaId || null,
      phonePending: hasWaba && !hasPhone,
      daysUntilExpiry,
      tokenExpiring,
    };
  });

  // Disconnect WhatsApp
  app.post('/api/whatsapp/disconnect', async (request) => {
    const tenantId = (request as any).tenantId;
    await db.update(schema.tenants)
      .set({
        whatsappProvider: 'meta',
        wabaId: '',
        whatsappPhoneNumberId: '',
        whatsappAccessToken: '',
        tokenExpiresAt: null,
        dialog360ApiKey: null,
      })
      .where(eq(schema.tenants.id, tenantId));
    return { ok: true };
  });

  // ---- 360dialog onboarding ----
  // Tenant pastes the D360 API key. We try multiple 360dialog endpoints
  // (sandbox V1 + cloud V2) to discover the phone_number_id. If none work,
  // we still save the key — phone_number_id will be auto-assigned from the
  // first incoming webhook.
  app.post('/api/whatsapp/dialog360/connect', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as { apiKey?: string };

    if (!body.apiKey || body.apiKey.length < 10) {
      return reply.code(400).send({ error: 'Missing or invalid 360dialog API key' });
    }

    const attempts: { url: string; status: number; body: string }[] = [];
    let phoneNumberId = '';
    let displayPhone = '';

    const endpoints = [
      'https://waba-v2.360dialog.io/v1/configs/phone_numbers',
      'https://waba-sandbox.360dialog.io/v1/configs/phone_numbers',
      'https://waba.360dialog.io/v1/configs/phone_numbers',
      'https://waba-v2.360dialog.io/phone_numbers',
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { headers: { 'D360-API-KEY': body.apiKey } });
        const text = await res.text();
        attempts.push({ url, status: res.status, body: text.slice(0, 200) });
        if (!res.ok) continue;
        const parsed = JSON.parse(text);
        const candidate = parsed?.data?.[0] || parsed?.phone_numbers?.[0] || parsed;
        const id = candidate?.id || candidate?.phone_number_id || '';
        const disp = candidate?.display_phone_number || candidate?.phone || '';
        if (id) {
          phoneNumberId = String(id);
          displayPhone = String(disp);
          break;
        }
      } catch (err: any) {
        attempts.push({ url, status: 0, body: err.message || 'fetch failed' });
      }
    }

    // Save the key even if we couldn't auto-discover phone_number_id —
    // webhook handler will fill it in on the first incoming message.
    await db.update(schema.tenants)
      .set({
        whatsappProvider: 'dialog360',
        whatsappPhoneNumberId: phoneNumberId,
        dialog360ApiKey: body.apiKey,
        whatsappAccessToken: '',
        tokenExpiresAt: null,
      })
      .where(eq(schema.tenants.id, tenantId));

    if (phoneNumberId) {
      return { ok: true, provider: 'dialog360', phoneNumberId, displayPhone };
    }

    return {
      ok: true,
      provider: 'dialog360',
      phoneNumberId: null,
      displayPhone: '',
      note: 'API key saved. Phone number ID will be auto-assigned from the first incoming WhatsApp message.',
      diagnostics: attempts,
    };
  });
}

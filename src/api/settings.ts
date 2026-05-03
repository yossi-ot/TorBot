import { FastifyInstance } from 'fastify';
import { v4 as uuid } from 'uuid';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

export function registerSettingsRoutes(app: FastifyInstance) {
  // Get tenant settings
  app.get('/api/settings', async (request) => {
    const tenantId = (request as any).tenantId;

    const [tenant] = await db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId));

    if (!tenant) return { error: 'Tenant not found' };

    return {
      name: tenant.name,
      phone: tenant.phone,
      address: tenant.address || '',
      timezone: tenant.timezone,
      aiSystemPrompt: tenant.aiSystemPrompt || '',
      cancellationPolicy: tenant.cancellationPolicy || '',
    };
  });

  // Update tenant settings
  app.put('/api/settings', async (request) => {
    const tenantId = (request as any).tenantId;
    const body = request.body as {
      name?: string;
      phone?: string;
      address?: string;
      timezone?: string;
      aiSystemPrompt?: string;
      cancellationPolicy?: string;
    };

    const updateData: Record<string, string> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.aiSystemPrompt !== undefined) updateData.aiSystemPrompt = body.aiSystemPrompt;
    if (body.cancellationPolicy !== undefined) updateData.cancellationPolicy = body.cancellationPolicy;

    await db.update(schema.tenants)
      .set(updateData)
      .where(eq(schema.tenants.id, tenantId));

    return { ok: true };
  });

  // Get iCal subscription URL (creates token on first call if missing)
  app.get('/api/settings/ical-url', async (request) => {
    const tenantId = (request as any).tenantId;
    const [tenant] = await db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId));
    if (!tenant) return { error: 'Tenant not found' };

    let token = tenant.icalToken;
    if (!token) {
      token = uuid();
      await db.update(schema.tenants).set({ icalToken: token }).where(eq(schema.tenants.id, tenantId));
    }

    const proto = (request.headers['x-forwarded-proto'] as string) || 'https';
    const host = request.headers.host;
    return { url: `${proto}://${host}/calendar/${tenantId}/${token}.ics` };
  });

  // Regenerate iCal token (invalidates the old URL)
  app.post('/api/settings/ical-token/regenerate', async (request) => {
    const tenantId = (request as any).tenantId;
    const token = uuid();
    await db.update(schema.tenants).set({ icalToken: token }).where(eq(schema.tenants.id, tenantId));
    const proto = (request.headers['x-forwarded-proto'] as string) || 'https';
    const host = request.headers.host;
    return { url: `${proto}://${host}/calendar/${tenantId}/${token}.ics` };
  });
}

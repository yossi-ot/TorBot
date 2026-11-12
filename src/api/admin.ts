import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, sql } from 'drizzle-orm';
import { signJwt } from './middleware.js';

/** platform_admin is the real cross-tenant role; the demo-salon owner check
 *  is kept only for backwards compatibility with how this worked before. */
function isPlatformAdmin(request: any): boolean {
  return request.role === 'platform_admin' || (request.tenantId === 'demo-salon' && request.role === 'owner');
}

export function registerAdminRoutes(app: FastifyInstance) {
  // Get all tenants with stats
  app.get('/api/admin/tenants', async (request, reply) => {
    if (!isPlatformAdmin(request)) {
      return reply.code(403).send({ error: 'אין הרשאה' });
    }

    const tenants = await db.select({
      id: schema.tenants.id,
      name: schema.tenants.name,
      phone: schema.tenants.phone,
      createdAt: schema.tenants.createdAt,
    }).from(schema.tenants);

    // Get user count and appointment count per tenant
    const results = [];
    for (const tenant of tenants) {
      const [userCount] = await db.select({
        count: sql<number>`count(*)`,
      }).from(schema.users).where(eq(schema.users.tenantId, tenant.id));

      const [serviceCount] = await db.select({
        count: sql<number>`count(*)`,
      }).from(schema.services).where(eq(schema.services.tenantId, tenant.id));

      const [appointmentCount] = await db.select({
        count: sql<number>`count(*)`,
      }).from(schema.appointments).where(eq(schema.appointments.tenantId, tenant.id));

      results.push({
        ...tenant,
        users: Number(userCount.count),
        services: Number(serviceCount.count),
        appointments: Number(appointmentCount.count),
      });
    }

    return results;
  });

  // Issue a short-lived token scoped to another tenant, so the platform
  // admin can view/edit it through the exact same dashboard screens any
  // business owner uses - no separate admin UI to build or keep in sync.
  app.post('/api/admin/impersonate/:tenantId', async (request, reply) => {
    if (!isPlatformAdmin(request)) {
      return reply.code(403).send({ error: 'אין הרשאה' });
    }

    const { tenantId } = request.params as { tenantId: string };
    const [tenant] = await db.select({ id: schema.tenants.id, name: schema.tenants.name }).from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId));
    if (!tenant) {
      return reply.code(404).send({ error: 'עסק לא נמצא' });
    }

    const [owner] = await db.select().from(schema.users)
      .where(eq(schema.users.tenantId, tenantId));
    if (!owner) {
      return reply.code(404).send({ error: 'לעסק הזה אין משתמש' });
    }

    const token = signJwt({ userId: owner.id, tenantId, role: 'owner' });
    return { token, tenantName: tenant.name };
  });
}

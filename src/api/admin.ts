import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, sql } from 'drizzle-orm';

export function registerAdminRoutes(app: FastifyInstance) {
  // Get all tenants with stats (owner only for demo-salon, or super-admin later)
  app.get('/api/admin/tenants', async (request, reply) => {
    const role = (request as any).role;
    const tenantId = (request as any).tenantId;

    // Only allow the demo tenant owner to see all tenants (acts as super-admin)
    if (tenantId !== 'demo-salon' || role !== 'owner') {
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
}

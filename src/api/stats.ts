import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export function registerStatsRoutes(app: FastifyInstance) {
  app.get('/api/stats', async (request) => {
    const tenantId = (request as any).tenantId;
    const { from, to } = request.query as { from?: string; to?: string };

    const conditions = [eq(schema.appointments.tenantId, tenantId)];
    if (from) conditions.push(gte(schema.appointments.startTime, from));
    if (to) conditions.push(lte(schema.appointments.startTime, to + 'T23:59:59'));

    const where = and(...conditions);

    // Status counts
    const statusCounts = db.select({
      status: schema.appointments.status,
      count: sql<number>`count(*)`,
    }).from(schema.appointments).where(where).groupBy(schema.appointments.status).all();

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of statusCounts) {
      counts[row.status] = row.count;
      total += row.count;
    }

    // Revenue (completed + confirmed appointments)
    const revenueResult = db.select({
      total: sql<number>`coalesce(sum(${schema.services.price}), 0)`,
    }).from(schema.appointments)
      .leftJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .where(and(...conditions, sql`${schema.appointments.status} IN ('confirmed', 'completed')`))
      .get();

    // Popular services
    const popularServices = db.select({
      name: schema.services.name,
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${schema.services.price}), 0)`,
    }).from(schema.appointments)
      .leftJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .where(where)
      .groupBy(schema.services.name)
      .orderBy(sql`count(*) DESC`)
      .all();

    // Daily counts
    const dailyCounts = db.select({
      date: sql<string>`substr(${schema.appointments.startTime}, 1, 10)`,
      count: sql<number>`count(*)`,
    }).from(schema.appointments)
      .where(where)
      .groupBy(sql`substr(${schema.appointments.startTime}, 1, 10)`)
      .orderBy(sql`substr(${schema.appointments.startTime}, 1, 10)`)
      .all();

    // New customers in range
    const customerConditions = [eq(schema.customers.tenantId, tenantId)];
    if (from) customerConditions.push(gte(schema.customers.createdAt, from));
    if (to) customerConditions.push(lte(schema.customers.createdAt, to + 'T23:59:59'));

    const newCustomersResult = db.select({
      count: sql<number>`count(*)`,
    }).from(schema.customers).where(and(...customerConditions)).get();

    return {
      totalAppointments: total,
      confirmedCount: counts['confirmed'] || 0,
      cancelledCount: counts['cancelled'] || 0,
      completedCount: counts['completed'] || 0,
      noShowCount: counts['no_show'] || 0,
      totalRevenue: revenueResult?.total || 0,
      popularServices,
      dailyCounts,
      newCustomers: newCustomersResult?.count || 0,
    };
  });
}

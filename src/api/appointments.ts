import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export function registerAppointmentRoutes(app: FastifyInstance) {
  // List appointments with filters
  app.get('/api/appointments', async (request) => {
    const tenantId = (request as any).tenantId;
    const { status, from, to } = request.query as { status?: string; from?: string; to?: string };

    const conditions = [eq(schema.appointments.tenantId, tenantId)];
    if (status) conditions.push(eq(schema.appointments.status, status));
    if (from) conditions.push(gte(schema.appointments.startTime, from));
    if (to) conditions.push(lte(schema.appointments.startTime, to + 'T23:59:59'));

    const rows = db.select({
      id: schema.appointments.id,
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
      status: schema.appointments.status,
      source: schema.appointments.source,
      notes: schema.appointments.notes,
      createdAt: schema.appointments.createdAt,
      customerName: schema.customers.name,
      customerPhone: schema.customers.phone,
      customerId: schema.customers.id,
      serviceName: schema.services.name,
      servicePrice: schema.services.price,
      serviceDuration: schema.services.durationMinutes,
      serviceId: schema.services.id,
    })
      .from(schema.appointments)
      .leftJoin(schema.customers, eq(schema.appointments.customerId, schema.customers.id))
      .leftJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .where(and(...conditions))
      .orderBy(schema.appointments.startTime)
      .all();

    return rows.map(r => ({
      id: r.id,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      source: r.source,
      notes: r.notes,
      createdAt: r.createdAt,
      customer: { id: r.customerId, name: r.customerName, phone: r.customerPhone },
      service: { id: r.serviceId, name: r.serviceName, price: r.servicePrice, durationMinutes: r.serviceDuration },
    }));
  });

  // Update appointment status/notes
  app.patch('/api/appointments/:id', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params as { id: string };
    const { status, notes } = request.body as { status?: string; notes?: string };

    const existing = db.select().from(schema.appointments)
      .where(and(eq(schema.appointments.id, id), eq(schema.appointments.tenantId, tenantId)))
      .get();

    if (!existing) return reply.code(404).send({ error: 'Not found' });

    const updates: any = {};
    if (status) {
      updates.status = status;
      if (status === 'cancelled') {
        updates.cancelledAt = new Date().toISOString();
      }
    }
    if (notes !== undefined) updates.notes = notes;

    db.update(schema.appointments).set(updates)
      .where(eq(schema.appointments.id, id)).run();

    return { ok: true };
  });
}

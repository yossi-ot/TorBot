import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export function registerServiceRoutes(app: FastifyInstance) {
  // List all services
  app.get('/api/services', async (request) => {
    const tenantId = (request as any).tenantId;
    return await db.select().from(schema.services)
      .where(eq(schema.services.tenantId, tenantId))
      .orderBy(schema.services.sortOrder);
  });

  // Create service
  app.post('/api/services', async (request) => {
    const tenantId = (request as any).tenantId;
    const { name, durationMinutes, price, isActive, sortOrder } = request.body as any;

    const id = uuid();
    await db.insert(schema.services).values({
      id, tenantId, name, durationMinutes, price,
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    });

    const [created] = await db.select().from(schema.services).where(eq(schema.services.id, id));
    return created;
  });

  // Update service
  app.put('/api/services/:id', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const [existing] = await db.select().from(schema.services)
      .where(and(eq(schema.services.id, id), eq(schema.services.tenantId, tenantId)));

    if (!existing) return reply.code(404).send({ error: 'Not found' });

    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes;
    if (body.price !== undefined) updates.price = body.price;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    await db.update(schema.services).set(updates).where(eq(schema.services.id, id));

    const [updated] = await db.select().from(schema.services).where(eq(schema.services.id, id));
    return updated;
  });

  // Delete service (soft delete)
  app.delete('/api/services/:id', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params as { id: string };

    const [existing] = await db.select().from(schema.services)
      .where(and(eq(schema.services.id, id), eq(schema.services.tenantId, tenantId)));

    if (!existing) return reply.code(404).send({ error: 'Not found' });

    await db.update(schema.services).set({ isActive: false }).where(eq(schema.services.id, id));
    return { ok: true };
  });
}

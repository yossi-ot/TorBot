import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export function registerBlockedSlotRoutes(app: FastifyInstance) {
  // List blocked slots
  app.get('/api/blocked-slots', async (request) => {
    const tenantId = (request as any).tenantId;
    return await db.select().from(schema.blockedSlots)
      .where(eq(schema.blockedSlots.tenantId, tenantId))
      .orderBy(schema.blockedSlots.startDatetime);
  });

  // Create blocked slot
  app.post('/api/blocked-slots', async (request) => {
    const tenantId = (request as any).tenantId;
    const { startDatetime, endDatetime, reason } = request.body as {
      startDatetime: string;
      endDatetime: string;
      reason?: string;
    };

    const id = uuid();
    await db.insert(schema.blockedSlots).values({
      id, tenantId, staffId: null, startDatetime, endDatetime, reason: reason || null,
    });

    const [created] = await db.select().from(schema.blockedSlots).where(eq(schema.blockedSlots.id, id));
    return created;
  });

  // Delete blocked slot
  app.delete('/api/blocked-slots/:id', async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const { id } = request.params as { id: string };

    const [existing] = await db.select().from(schema.blockedSlots)
      .where(and(eq(schema.blockedSlots.id, id), eq(schema.blockedSlots.tenantId, tenantId)));

    if (!existing) return reply.code(404).send({ error: 'Not found' });

    await db.delete(schema.blockedSlots).where(eq(schema.blockedSlots.id, id));
    return { ok: true };
  });
}

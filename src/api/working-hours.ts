import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export function registerWorkingHoursRoutes(app: FastifyInstance) {
  // Get all working hours
  app.get('/api/working-hours', async (request) => {
    const tenantId = (request as any).tenantId;
    return db.select().from(schema.workingHours)
      .where(eq(schema.workingHours.tenantId, tenantId))
      .orderBy(schema.workingHours.dayOfWeek)
      .all();
  });

  // Bulk replace working hours
  app.put('/api/working-hours', async (request) => {
    const tenantId = (request as any).tenantId;
    const hours = request.body as Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isActive: boolean;
      staffId?: string | null;
    }>;

    // Delete existing and insert new in one go
    db.delete(schema.workingHours)
      .where(eq(schema.workingHours.tenantId, tenantId))
      .run();

    for (const h of hours) {
      db.insert(schema.workingHours).values({
        id: uuid(),
        tenantId,
        staffId: h.staffId || null,
        dayOfWeek: h.dayOfWeek,
        startTime: h.startTime,
        endTime: h.endTime,
        isActive: h.isActive,
      }).run();
    }

    return db.select().from(schema.workingHours)
      .where(eq(schema.workingHours.tenantId, tenantId))
      .orderBy(schema.workingHours.dayOfWeek)
      .all();
  });
}

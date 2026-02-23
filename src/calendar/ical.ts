import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import ical, { ICalCalendar } from 'ical-generator';

export function registerCalendarRoutes(app: FastifyInstance) {
  app.get('/calendar/:tenantId/:token.ics', async (request, reply) => {
    const { tenantId, token } = request.params as { tenantId: string; token: string };

    // Validate tenant exists (token = tenantId for simplicity in MVP)
    const tenant = db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .get();

    if (!tenant) {
      return reply.code(404).send('Not found');
    }

    // Get all confirmed appointments
    const appointments = db.select({
      id: schema.appointments.id,
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
      serviceName: schema.services.name,
      customerName: schema.customers.name,
      customerPhone: schema.customers.phone,
    })
      .from(schema.appointments)
      .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .innerJoin(schema.customers, eq(schema.appointments.customerId, schema.customers.id))
      .where(and(
        eq(schema.appointments.tenantId, tenantId),
        eq(schema.appointments.status, 'confirmed'),
      ))
      .all();

    // Generate iCal
    const calendar: ICalCalendar = ical({
      name: `${tenant.name} - תורים`,
      timezone: tenant.timezone,
    });

    for (const appt of appointments) {
      calendar.createEvent({
        id: appt.id,
        start: new Date(appt.startTime),
        end: new Date(appt.endTime),
        summary: `${appt.serviceName} - ${appt.customerName || appt.customerPhone}`,
        description: `לקוח: ${appt.customerName || 'ללא שם'}\nטלפון: ${appt.customerPhone}`,
      });
    }

    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${tenantId}.ics"`)
      .send(calendar.toString());
  });
}

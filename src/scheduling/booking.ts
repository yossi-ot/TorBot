import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { dayjs } from '../utils/date.js';
import { getAvailableSlots } from './availability.js';

export interface BookingResult {
  success: boolean;
  appointmentId?: string;
  error?: string;
}

/**
 * Create a new appointment with conflict checking.
 */
export function createBooking(
  tenantId: string,
  customerId: string,
  serviceId: string,
  date: string,      // YYYY-MM-DD
  time: string,      // HH:mm
  staffId?: string,
): BookingResult {
  // Get service to know duration
  const service = db.select().from(schema.services)
    .where(and(
      eq(schema.services.id, serviceId),
      eq(schema.services.tenantId, tenantId),
    ))
    .get();

  if (!service) {
    return { success: false, error: 'שירות לא נמצא' };
  }

  // Double-check availability (optimistic locking)
  const slots = getAvailableSlots(tenantId, date, service.durationMinutes, staffId || undefined);
  const slotExists = slots.some(s => s.time === time);

  if (!slotExists) {
    return { success: false, error: 'סליחה, התור הזה כבר לא פנוי. אפשר לבחור שעה אחרת?' };
  }

  const [h, m] = time.split(':').map(Number);
  const startTime = dayjs(date).hour(h).minute(m).second(0);
  const endTime = startTime.add(service.durationMinutes, 'minute');

  const appointmentId = uuid();

  db.insert(schema.appointments).values({
    id: appointmentId,
    tenantId,
    customerId,
    serviceId,
    staffId: staffId || null,
    startTime: startTime.format('YYYY-MM-DDTHH:mm:ss'),
    endTime: endTime.format('YYYY-MM-DDTHH:mm:ss'),
    status: 'confirmed',
    source: 'whatsapp_bot',
  }).run();

  return { success: true, appointmentId };
}

/**
 * Cancel an appointment.
 */
export function cancelBooking(appointmentId: string, reason?: string): boolean {
  const result = db.update(schema.appointments)
    .set({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason || 'ביטול ע"י הלקוח',
    })
    .where(eq(schema.appointments.id, appointmentId))
    .run();

  return result.changes > 0;
}

/**
 * Get upcoming appointments for a customer.
 */
export function getCustomerAppointments(tenantId: string, customerId: string) {
  const now = new Date().toISOString();

  return db.select({
    id: schema.appointments.id,
    startTime: schema.appointments.startTime,
    endTime: schema.appointments.endTime,
    status: schema.appointments.status,
    serviceName: schema.services.name,
  })
    .from(schema.appointments)
    .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
    .where(and(
      eq(schema.appointments.tenantId, tenantId),
      eq(schema.appointments.customerId, customerId),
      eq(schema.appointments.status, 'confirmed'),
    ))
    .all()
    .filter(a => a.startTime > now);
}

/**
 * Find or create a customer by phone number.
 */
export function findOrCreateCustomer(tenantId: string, phone: string, name?: string): string {
  const existing = db.select().from(schema.customers)
    .where(and(
      eq(schema.customers.tenantId, tenantId),
      eq(schema.customers.phone, phone),
    ))
    .get();

  if (existing) {
    // Update name if provided and not set
    if (name && !existing.name) {
      db.update(schema.customers)
        .set({ name })
        .where(eq(schema.customers.id, existing.id))
        .run();
    }
    return existing.id;
  }

  const id = uuid();
  db.insert(schema.customers).values({
    id,
    tenantId,
    phone,
    name: name || null,
  }).run();

  return id;
}

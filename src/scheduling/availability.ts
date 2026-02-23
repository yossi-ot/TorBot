import { db, schema } from '../db/index.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { dayjs } from '../utils/date.js';

export interface TimeSlot {
  time: string;    // "09:00"
  staffId?: string;
}

/**
 * Get available time slots for a given tenant, date, and service duration.
 * Computes: working_hours - existing_appointments - blocked_slots
 */
export async function getAvailableSlots(
  tenantId: string,
  date: string,          // YYYY-MM-DD
  durationMinutes: number,
  staffId?: string,
): Promise<TimeSlot[]> {
  const dayOfWeek = dayjs(date).day(); // 0=Sunday

  // 1. Get working hours for this day
  const hoursQuery: any[] = [
    eq(schema.workingHours.tenantId, tenantId),
    eq(schema.workingHours.dayOfWeek, dayOfWeek),
    eq(schema.workingHours.isActive, true),
  ];
  if (staffId) {
    hoursQuery.push(eq(schema.workingHours.staffId, staffId));
  }

  const hours = await db.select().from(schema.workingHours)
    .where(and(...hoursQuery));

  if (hours.length === 0) return [];

  // 2. Get existing appointments for this date
  const dateStart = `${date}T00:00:00`;
  const dateEnd = `${date}T23:59:59`;

  const existingAppointments = await db.select().from(schema.appointments)
    .where(and(
      eq(schema.appointments.tenantId, tenantId),
      eq(schema.appointments.status, 'confirmed'),
      gte(schema.appointments.startTime, dateStart),
      lte(schema.appointments.startTime, dateEnd),
    ));

  // 3. Get blocked slots for this date
  const blockedSlots = await db.select().from(schema.blockedSlots)
    .where(and(
      eq(schema.blockedSlots.tenantId, tenantId),
      lte(schema.blockedSlots.startDatetime, dateEnd),
      gte(schema.blockedSlots.endDatetime, dateStart),
    ));

  // 4. Generate all possible slots in 30-minute intervals
  const available: TimeSlot[] = [];
  const slotInterval = 30; // minutes

  for (const wh of hours) {
    const [startH, startM] = wh.startTime.split(':').map(Number);
    const [endH, endM] = wh.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let m = startMinutes; m + durationMinutes <= endMinutes; m += slotInterval) {
      const slotStart = dayjs(date)
        .hour(Math.floor(m / 60))
        .minute(m % 60)
        .second(0);
      const slotEnd = slotStart.add(durationMinutes, 'minute');
      const slotStartISO = slotStart.format('YYYY-MM-DDTHH:mm:ss');
      const slotEndISO = slotEnd.format('YYYY-MM-DDTHH:mm:ss');

      // Check if slot overlaps with any appointment
      const hasConflict = existingAppointments.some(appt => {
        return slotStartISO < appt.endTime && slotEndISO > appt.startTime;
      });

      // Check if slot overlaps with any blocked slot
      const isBlocked = blockedSlots.some(bs => {
        return slotStartISO < bs.endDatetime && slotEndISO > bs.startDatetime;
      });

      // Don't show past slots for today
      if (dayjs(date).isSame(dayjs(), 'day') && slotStart.isBefore(dayjs())) {
        continue;
      }

      if (!hasConflict && !isBlocked) {
        available.push({
          time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
          staffId: wh.staffId || undefined,
        });
      }
    }
  }

  return available;
}

/**
 * Get available dates for the next N days that have at least one free slot.
 */
export async function getAvailableDates(
  tenantId: string,
  durationMinutes: number,
  daysAhead: number = 7,
): Promise<string[]> {
  const dates: string[] = [];
  const today = dayjs();

  for (let i = 0; i < daysAhead; i++) {
    const date = today.add(i, 'day').format('YYYY-MM-DD');
    const slots = await getAvailableSlots(tenantId, date, durationMinutes);
    if (slots.length > 0) {
      dates.push(date);
    }
  }

  return dates;
}

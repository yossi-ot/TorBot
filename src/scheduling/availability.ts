import { db, schema } from '../db/index.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { dayjs } from '../utils/date.js';
import { getActiveLocksOnDate } from './slot-locks.js';

export interface TimeSlot {
  time: string;    // "09:00"
  staffId?: string;
}

interface MinuteInterval {
  start: number; // minutes from midnight of the target date
  end: number;
}

/** Subtracts busy intervals from a window, returning the remaining free sub-windows. */
function subtractIntervals(window: MinuteInterval, busy: MinuteInterval[]): MinuteInterval[] {
  let free = [window];
  for (const b of busy) {
    const next: MinuteInterval[] = [];
    for (const f of free) {
      if (b.end <= f.start || b.start >= f.end) {
        next.push(f);
        continue;
      }
      if (b.start > f.start) next.push({ start: f.start, end: Math.min(b.start, f.end) });
      if (b.end < f.end) next.push({ start: Math.max(b.end, f.start), end: f.end });
    }
    free = next;
  }
  return free.filter(f => f.end > f.start);
}

/**
 * Get available time slots for a given tenant, date, and service duration.
 * Computes: working_hours - existing_appointments (each padded by the
 * tenant's buffer minutes on both sides) - blocked_slots - active locks.
 */
export async function getAvailableSlots(
  tenantId: string,
  date: string,          // YYYY-MM-DD
  durationMinutes: number,
  staffId?: string,
  /** When set, hides slots locked by OTHER customers but still shows ones locked by this one. */
  excludeLocksByCustomerPhone: string = '__unknown__',
): Promise<TimeSlot[]> {
  const dayOfWeek = dayjs(date).day(); // 0=Sunday
  const dayStart = dayjs(date).startOf('day');
  const toMinutes = (iso: string) => dayjs(iso).diff(dayStart, 'minute');

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

  // 1b. Tenant's required gap between one appointment and the next
  const [tenant] = await db.select({ bufferMinutes: schema.tenants.bufferMinutes })
    .from(schema.tenants).where(eq(schema.tenants.id, tenantId));
  const bufferMinutes = tenant?.bufferMinutes ?? 0;

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

  // 3b. Get active slot locks held by other customers for this date
  const activeLocks = await getActiveLocksOnDate(tenantId, date, excludeLocksByCustomerPhone);

  // Busy intervals: appointments and pending locks are padded with the
  // buffer on both sides, so the next slot only opens up once the gap has
  // passed; blocked slots (owner-set breaks/days off) are used as-is.
  const busy: MinuteInterval[] = [
    ...existingAppointments.map(a => ({
      start: toMinutes(a.startTime) - bufferMinutes,
      end: toMinutes(a.endTime) + bufferMinutes,
    })),
    ...activeLocks.map(lk => ({
      start: toMinutes(lk.startTime) - bufferMinutes,
      end: toMinutes(lk.endTime) + bufferMinutes,
    })),
    ...blockedSlots.map(bs => ({
      start: toMinutes(bs.startDatetime),
      end: toMinutes(bs.endDatetime),
    })),
  ];

  // 4. Generate slots: the regular 30-minute grid, plus (when a buffer
  // shifts it off-grid) the exact moment each free window opens up - so a
  // 45-min treatment at 08:00 with a 10-min buffer still offers 08:55, not
  // just the next grid line at 09:00/09:30.
  const available: TimeSlot[] = [];
  const slotInterval = 30; // minutes
  const seenTimes = new Set<string>();
  const now = dayjs();
  const isToday = dayjs(date).isSame(now, 'day');
  const nowMinutes = now.diff(dayStart, 'minute');

  for (const wh of hours) {
    const [startH, startM] = wh.startTime.split(':').map(Number);
    const [endH, endM] = wh.endTime.split(':').map(Number);
    const whWindow: MinuteInterval = { start: startH * 60 + startM, end: endH * 60 + endM };

    const freeWindows = subtractIntervals(whWindow, busy);

    const candidates = new Set<number>();
    for (let m = whWindow.start; m + durationMinutes <= whWindow.end; m += slotInterval) {
      candidates.add(m);
    }
    for (const free of freeWindows) {
      if (free.start + durationMinutes <= free.end) candidates.add(free.start);
    }

    for (const m of candidates) {
      if (isToday && m <= nowMinutes) continue;
      const fits = freeWindows.some(f => f.start <= m && m + durationMinutes <= f.end);
      if (!fits) continue;

      const key = `${m}:${wh.staffId || ''}`;
      if (seenTimes.has(key)) continue;
      seenTimes.add(key);

      available.push({
        time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
        staffId: wh.staffId || undefined,
      });
    }
  }

  available.sort((a, b) => a.time.localeCompare(b.time));
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

import { Session, updateSession } from '../session.js';
import { db, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { getAvailableSlots, getAvailableDates } from '../../scheduling/availability.js';
import { createBooking, findOrCreateCustomer } from '../../scheduling/booking.js';
import { dayjs, formatDateHebrew, parseHebrewDate, parseHebrewTime } from '../../utils/date.js';

/** Show list of services to choose from */
export async function startBooking(session: Session): Promise<string> {
  const services = (await db.select().from(schema.services)
    .where(and(
      eq(schema.services.tenantId, session.tenantId),
      eq(schema.services.isActive, true),
    )))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (services.length === 0) {
    return 'סליחה, אין שירותים זמינים כרגע.';
  }

  updateSession(session, { state: 'SELECT_SERVICE' });

  const lines = services.map((s, i) =>
    `${i + 1}️⃣ ${s.name} (${s.durationMinutes} דק') - ₪${s.price}`
  );

  return `איזה שירות מעניין אותך?\n\n${lines.join('\n')}`;
}

/** Handle service selection, show available dates */
export async function handleServiceSelection(session: Session, input: string): Promise<string> {
  const services = (await db.select().from(schema.services)
    .where(and(
      eq(schema.services.tenantId, session.tenantId),
      eq(schema.services.isActive, true),
    )))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Match by number or name
  const num = parseInt(input);
  let service = num > 0 && num <= services.length ? services[num - 1] : null;

  if (!service) {
    service = services.find(s =>
      s.name.includes(input) || input.includes(s.name)
    ) || null;
  }

  if (!service) {
    return `לא הבנתי. בחר מספר בין 1 ל-${services.length}:`;
  }

  updateSession(session, {
    state: 'SELECT_DATE',
    selectedServiceId: service.id,
    selectedServiceName: service.name,
  });

  // Show available dates
  const dates = await getAvailableDates(session.tenantId, service.durationMinutes, 7);

  if (dates.length === 0) {
    updateSession(session, { state: 'IDLE' });
    return 'סליחה, אין תורים פנויים בשבוע הקרוב. נסה שוב מאוחר יותר.';
  }

  const lines = dates.map((d, i) => {
    const date = dayjs(d);
    return `${i + 1}️⃣ ${formatDateHebrew(date)}`;
  });

  return `בחרת: *${service.name}*\n\nמתי נוח לך?\n${lines.join('\n')}\n\nאפשר גם לכתוב "מחר" או תאריך (25/02)`;
}

/** Handle date selection, show available time slots */
export async function handleDateSelection(session: Session, input: string): Promise<string> {
  const dates = await getAvailableDates(session.tenantId,
    await getServiceDuration(session) || 30, 7);

  let selectedDate: string | null = null;

  // Try number selection
  const num = parseInt(input);
  if (num > 0 && num <= dates.length) {
    selectedDate = dates[num - 1];
  }

  // Try Hebrew date parsing
  if (!selectedDate) {
    const [tenant] = await db.select().from(schema.tenants)
      .where(eq(schema.tenants.id, session.tenantId));
    const parsed = parseHebrewDate(input, tenant?.timezone || 'Asia/Jerusalem');
    if (parsed) {
      selectedDate = parsed.format('YYYY-MM-DD');
    }
  }

  if (!selectedDate) {
    return 'לא הבנתי את התאריך. בחר מספר מהרשימה או כתוב "מחר", "היום", או תאריך כמו 25/02:';
  }

  const duration = await getServiceDuration(session) || 30;
  const slots = await getAvailableSlots(session.tenantId, selectedDate, duration);

  if (slots.length === 0) {
    return `אין תורים פנויים ב-${formatDateHebrew(dayjs(selectedDate))}. בחר תאריך אחר:`;
  }

  updateSession(session, {
    state: 'SELECT_TIME',
    selectedDate,
    availableSlots: slots.map(s => s.time),
  });

  const lines = slots.map((s, i) => `${i + 1}️⃣ ${s.time}`);

  return `📅 ${formatDateHebrew(dayjs(selectedDate))}\n\nבחר שעה:\n${lines.join('\n')}`;
}

/** Handle time selection, show confirmation */
export async function handleTimeSelection(session: Session, input: string): Promise<string> {
  const slots = session.availableSlots || [];

  let selectedTime: string | null = null;

  // Try number selection
  const num = parseInt(input);
  if (num > 0 && num <= slots.length) {
    selectedTime = slots[num - 1];
  }

  // Try time parsing
  if (!selectedTime) {
    selectedTime = parseHebrewTime(input);
    if (selectedTime && !slots.includes(selectedTime)) {
      return `השעה ${selectedTime} לא פנויה. בחר מהרשימה:\n${slots.map((s, i) => `${i + 1}️⃣ ${s}`).join('\n')}`;
    }
  }

  if (!selectedTime) {
    return 'לא הבנתי. בחר מספר מהרשימה או כתוב שעה כמו 10:30:';
  }

  updateSession(session, {
    state: 'CONFIRM_BOOKING',
    selectedTime,
  });

  return `*אישור תור:*

📋 שירות: ${session.selectedServiceName}
📅 תאריך: ${formatDateHebrew(dayjs(session.selectedDate!))}
🕐 שעה: ${selectedTime}

לאשר? (כן/לא)`;
}

/** Handle booking confirmation */
export async function handleConfirmation(session: Session, input: string): Promise<string> {
  const positive = /^(כן|אישור|בטח|yes|1|אשר|מאשר)$/i.test(input.trim());
  const negative = /^(לא|ביטול|no|2|cancel)$/i.test(input.trim());

  if (negative) {
    updateSession(session, { state: 'IDLE' });
    return 'התור בוטל. אם תרצה לקבוע תור חדש, פשוט כתוב "תור".';
  }

  if (!positive) {
    return 'כתוב *כן* לאישור או *לא* לביטול:';
  }

  // Create the booking
  const customerId = await findOrCreateCustomer(
    session.tenantId,
    session.customerPhone,
    session.customerName || undefined,
  );

  const result = await createBooking(
    session.tenantId,
    customerId,
    session.selectedServiceId!,
    session.selectedDate!,
    session.selectedTime!,
    session.selectedStaffId,
  );

  updateSession(session, { state: 'IDLE' });

  if (!result.success) {
    return result.error || 'שגיאה בקביעת התור. נסה שוב.';
  }

  return `✅ *התור נקבע בהצלחה!*

📋 ${session.selectedServiceName}
📅 ${formatDateHebrew(dayjs(session.selectedDate!))}
🕐 ${session.selectedTime}

תקבל תזכורת לפני התור.
להתראות! 😊`;
}

async function getServiceDuration(session: Session): Promise<number | null> {
  if (!session.selectedServiceId) return null;
  const [service] = await db.select().from(schema.services)
    .where(eq(schema.services.id, session.selectedServiceId));
  return service?.durationMinutes || null;
}

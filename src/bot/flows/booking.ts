import { Session, updateSession } from '../session.js';
import { db, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { getAvailableSlots, getAvailableDates } from '../../scheduling/availability.js';
import { createBooking, findOrCreateCustomer } from '../../scheduling/booking.js';
import { dayjs, formatDateHebrew, parseHebrewDate, parseHebrewTime } from '../../utils/date.js';
import type { NormalizedMessage } from '../ai-fallback.js';
import { interpretService, interpretDate, interpretTime, interpretConfirm, normalizeMessage } from '../ai-fallback.js';
import { handleMyAppointments } from './my-appointments.js';

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

  await updateSession(session, { state: 'SELECT_SERVICE' });

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

  // AI fallback for natural phrasings like "תספורת רגילה" or "בא לי צבע"
  if (!service) {
    const aiName = await interpretService(input, services.map(s => s.name));
    if (aiName) service = services.find(s => s.name === aiName) || null;
  }

  if (!service) {
    const rescue = await rescueWithNormalizer(session, input);
    if (rescue) return rescue;
    return `לא הבנתי. בחר מספר בין 1 ל-${services.length}:`;
  }

  await updateSession(session, {
    selectedServiceId: service.id,
    selectedServiceName: service.name,
  });

  // If an earlier message already gave us a date (e.g. "תור ביום ראשון"),
  // skip the date prompt and continue from there.
  if (session.selectedDate) {
    return continueAfterService(session, service);
  }

  await updateSession(session, { state: 'SELECT_DATE' });
  return askDatePrompt(session.tenantId, service.durationMinutes, service.name);
}

/**
 * After we know the service, advance through any pre-saved date/time
 * entities that survived from the initial AI normalization.
 */
async function continueAfterService(
  session: Session,
  service: { id: string; durationMinutes: number; name: string },
): Promise<string> {
  const dateIso = session.selectedDate!;
  const slots = await getAvailableSlots(session.tenantId, dateIso, service.durationMinutes);

  if (slots.length === 0) {
    await updateSession(session, { state: 'SELECT_DATE', selectedDate: undefined });
    return `אין תורים פנויים ב-${formatDateHebrew(dayjs(dateIso))} ל-${service.name}.\nבחר תאריך אחר:`;
  }

  await updateSession(session, {
    state: 'SELECT_TIME',
    availableSlots: slots.map(s => s.time),
  });

  const slotTimes = slots.map(s => s.time);
  const preTime = session.selectedTime;

  if (preTime && slotTimes.includes(preTime)) {
    await updateSession(session, { state: 'CONFIRM_BOOKING' });
    return `*אישור תור:*\n\n📋 שירות: ${service.name}\n📅 תאריך: ${formatDateHebrew(dayjs(dateIso))}\n🕐 שעה: ${preTime}\n\nלאשר? (כן/לא)`;
  }

  if (preTime) {
    const suggestions = findNearestSlots(preTime, slotTimes, 3);
    return `השעה ${preTime} תפוסה 😕\nהזמנים הקרובים: *${suggestions.join('* / *')}*\nאיזו שעה מתאימה?`;
  }

  const first = slots[0].time;
  const last = slots[slots.length - 1].time;
  return `📅 ${formatDateHebrew(dayjs(dateIso))} (${service.name})\n\nבאיזו שעה נוח לך?\nכתוב שעה, למשל *10:30*\n(שעות פנויות בין ${first} ל-${last})`;
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
  const [tenant] = await db.select().from(schema.tenants)
    .where(eq(schema.tenants.id, session.tenantId));
  const tz = tenant?.timezone || 'Asia/Jerusalem';

  if (!selectedDate) {
    const parsed = parseHebrewDate(input, tz);
    if (parsed) {
      selectedDate = parsed.format('YYYY-MM-DD');
    }
  }

  // AI fallback for "בעוד שלושה ימים" / "סוף השבוע" / etc.
  if (!selectedDate) {
    const aiDate = await interpretDate(input, dayjs().tz(tz).format('YYYY-MM-DD'));
    if (aiDate === 'today') selectedDate = dayjs().tz(tz).format('YYYY-MM-DD');
    else if (aiDate === 'tomorrow') selectedDate = dayjs().tz(tz).add(1, 'day').format('YYYY-MM-DD');
    else if (aiDate) selectedDate = aiDate;
  }

  if (!selectedDate) {
    const rescue = await rescueWithNormalizer(session, input);
    if (rescue) return rescue;
    return 'לא הבנתי את התאריך. בחר מספר מהרשימה או כתוב "מחר", "היום", או תאריך כמו 25/02:';
  }

  const duration = await getServiceDuration(session) || 30;
  const slots = await getAvailableSlots(session.tenantId, selectedDate, duration);

  if (slots.length === 0) {
    return `אין תורים פנויים ב-${formatDateHebrew(dayjs(selectedDate))}. בחר תאריך אחר:`;
  }

  await updateSession(session, {
    state: 'SELECT_TIME',
    selectedDate,
    availableSlots: slots.map(s => s.time),
  });

  const firstSlot = slots[0].time;
  const lastSlot = slots[slots.length - 1].time;

  return `📅 ${formatDateHebrew(dayjs(selectedDate))}\n\nבאיזו שעה נוח לך?\nכתוב שעה, למשל *10:30*\n(שעות פנויות בין ${firstSlot} ל-${lastSlot})`;
}

/** Handle time selection, show confirmation */
export async function handleTimeSelection(session: Session, input: string): Promise<string> {
  const slots = session.availableSlots || [];

  let selectedTime: string | null = null;

  // Parse the time the user typed
  const parsed = parseHebrewTime(input);
  if (parsed) {
    if (slots.includes(parsed)) {
      selectedTime = parsed;
    } else {
      // Suggest 3 nearest available times
      const suggestions = findNearestSlots(parsed, slots, 3);
      return `השעה ${parsed} תפוסה 😕\nהזמנים הקרובים: *${suggestions.join('* / *')}*\nאיזו שעה מתאימה?`;
    }
  }

  // Fall back to number selection for users who insist on a list
  if (!selectedTime) {
    const num = parseInt(input);
    if (num > 0 && num <= slots.length) {
      selectedTime = slots[num - 1];
    }
  }

  // AI fallback for "מאוחר בערב" / "סביבות עשר"
  if (!selectedTime) {
    const aiTime = await interpretTime(input, slots);
    if (aiTime && slots.includes(aiTime)) {
      selectedTime = aiTime;
    } else if (aiTime) {
      // Time understood but not exactly available — suggest nearest
      const suggestions = findNearestSlots(aiTime, slots, 3);
      return `${aiTime} לא פנוי 😕\nהזמנים הקרובים: *${suggestions.join('* / *')}*\nאיזו שעה מתאימה?`;
    }
  }

  if (!selectedTime) {
    const rescue = await rescueWithNormalizer(session, input);
    if (rescue) return rescue;
    const samples = slots.slice(0, 3).join(', ');
    return `לא הבנתי. כתוב שעה כמו *10:30* או *14:00*\n(לדוגמה זמנים פנויים: ${samples})`;
  }

  await updateSession(session, {
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
  const trimmed = input.trim();
  let positive = /^(כן|אישור|בטח|yes|1|אשר|מאשר|אוקיי|אוקי|סבבה|בסדר|טוב)$/i.test(trimmed);
  let negative = /^(לא|ביטול|no|2|cancel|עזוב|תוותר)$/i.test(trimmed);

  // AI fallback for less common phrasings like "תאשר בבקשה" or "בוא נעשה"
  if (!positive && !negative) {
    const ai = await interpretConfirm(input);
    if (ai === 'yes') positive = true;
    if (ai === 'no') negative = true;
  }

  if (negative) {
    await updateSession(session, {
      state: 'IDLE',
      selectedServiceId: undefined,
      selectedServiceName: undefined,
      selectedDate: undefined,
      selectedTime: undefined,
      availableSlots: undefined,
    });
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

  await updateSession(session, {
    state: 'IDLE',
    selectedServiceId: undefined,
    selectedServiceName: undefined,
    selectedDate: undefined,
    selectedTime: undefined,
    availableSlots: undefined,
  });

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

/**
 * Entity-aware booking entry point. Used when the AI normalizer extracted
 * any combination of {service, date, time} from a single natural-language
 * message. We skip flow steps for the entities we already have.
 */
export async function startBookingWithEntities(
  session: Session,
  n: NormalizedMessage,
): Promise<string> {
  const services = (await db.select().from(schema.services)
    .where(and(
      eq(schema.services.tenantId, session.tenantId),
      eq(schema.services.isActive, true),
    )))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (services.length === 0) return 'סליחה, אין שירותים זמינים כרגע.';

  // Match service: exact, then includes
  let service = n.serviceName ? services.find(s => s.name === n.serviceName) : undefined;
  if (!service && n.serviceName) {
    service = services.find(s => s.name.includes(n.serviceName!) || n.serviceName!.includes(s.name));
  }
  if (!service) {
    // No service yet — but remember the date/time so we can use them after
    // the user picks a service.
    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, session.tenantId));
    const tz = tenant?.timezone || 'Asia/Jerusalem';
    const preDate = resolveAiDate(n.date, tz);
    if (preDate || n.time) {
      await updateSession(session, {
        ...(preDate ? { selectedDate: preDate } : {}),
        ...(n.time ? { selectedTime: n.time } : {}),
      });
    }
    return startBooking(session);
  }

  await updateSession(session, {
    state: 'SELECT_DATE',
    selectedServiceId: service.id,
    selectedServiceName: service.name,
  });

  // Resolve date
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, session.tenantId));
  const tz = tenant?.timezone || 'Asia/Jerusalem';
  const dateIso = resolveAiDate(n.date, tz);
  if (!dateIso) {
    return askDatePrompt(session.tenantId, service.durationMinutes, service.name);
  }

  const slots = await getAvailableSlots(session.tenantId, dateIso, service.durationMinutes);
  if (slots.length === 0) {
    return `אין תורים פנויים ב-${formatDateHebrew(dayjs(dateIso))} ל-${service.name}. בחר תאריך אחר:`;
  }

  await updateSession(session, {
    state: 'SELECT_TIME',
    selectedDate: dateIso,
    availableSlots: slots.map(s => s.time),
  });

  // Resolve time
  if (!n.time) {
    const first = slots[0].time;
    const last = slots[slots.length - 1].time;
    return `📅 ${formatDateHebrew(dayjs(dateIso))}\n\nבאיזו שעה נוח לך ל-${service.name}?\nכתוב שעה, למשל *10:30*\n(שעות פנויות בין ${first} ל-${last})`;
  }

  const slotTimes = slots.map(s => s.time);
  if (!slotTimes.includes(n.time)) {
    const suggestions = findNearestSlots(n.time, slotTimes, 3);
    return `השעה ${n.time} תפוסה 😕\nהזמנים הקרובים: *${suggestions.join('* / *')}*\nאיזו שעה מתאימה?`;
  }

  await updateSession(session, {
    state: 'CONFIRM_BOOKING',
    selectedTime: n.time,
  });

  return `*אישור תור:*

📋 שירות: ${service.name}
📅 תאריך: ${formatDateHebrew(dayjs(dateIso))}
🕐 שעה: ${n.time}

לאשר? (כן/לא)`;
}

async function askDatePrompt(tenantId: string, durationMinutes: number, serviceName: string): Promise<string> {
  const dates = await getAvailableDates(tenantId, durationMinutes, 7);
  if (dates.length === 0) {
    return 'סליחה, אין תורים פנויים בשבוע הקרוב. נסה שוב מאוחר יותר.';
  }
  const lines = dates.map((d, i) => `${i + 1}️⃣ ${formatDateHebrew(dayjs(d))}`);
  return `בחרת: *${serviceName}*\n\nמתי נוח לך?\n${lines.join('\n')}\n\nאפשר גם לכתוב "מחר" או תאריך (25/02)`;
}

/**
 * Last-resort rescue when none of the in-context parsers / interpreters
 * could make sense of mid-flow input. Runs the full normalizer to detect
 * if the user is changing date, switching service, cancelling, etc.
 * Returns a response string if it rerouted, or null to fall through.
 */
async function rescueWithNormalizer(session: Session, input: string): Promise<string | null> {
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, session.tenantId));
  const services = (await db.select().from(schema.services)
    .where(and(
      eq(schema.services.tenantId, session.tenantId),
      eq(schema.services.isActive, true),
    )));

  const tz = tenant?.timezone || 'Asia/Jerusalem';
  const n = await normalizeMessage(input, {
    businessName: tenant?.name || '',
    serviceNames: services.map(s => s.name),
    todayIso: dayjs().tz(tz).format('YYYY-MM-DD'),
  });

  if (n.intent === 'book') {
    // Only reroute if AI actually picked up something new — otherwise the
    // user is just repeating themselves and the calling handler will give
    // a help message.
    if (!n.serviceName && !n.date && !n.time) return null;

    // Keep prior selections that the new message didn't override.
    if (!n.serviceName && session.selectedServiceName) n.serviceName = session.selectedServiceName;
    return startBookingWithEntities(session, n);
  }

  if (n.intent === 'cancel') {
    await updateSession(session, {
      state: 'IDLE',
      selectedServiceId: undefined,
      selectedServiceName: undefined,
      selectedDate: undefined,
      selectedTime: undefined,
      availableSlots: undefined,
    });
    return 'אוקיי, ביטלתי את התהליך. כתוב "תור" כשתרצה להתחיל מחדש.';
  }

  if (n.intent === 'list') {
    return handleMyAppointments(session);
  }

  return null;
}

function resolveAiDate(input: string | undefined, tz: string): string | null {
  if (!input) return null;
  const now = dayjs().tz(tz);
  if (input === 'today') return now.format('YYYY-MM-DD');
  if (input === 'tomorrow') return now.add(1, 'day').format('YYYY-MM-DD');
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const d = dayjs(input);
    if (d.isValid() && !d.isBefore(now, 'day')) return input;
  }
  return null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Return the `count` slots closest to `target` (sorted chronologically). */
function findNearestSlots(target: string, slots: string[], count: number): string[] {
  const targetMin = timeToMinutes(target);
  return slots
    .map(s => ({ time: s, diff: Math.abs(timeToMinutes(s) - targetMin) }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, count)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    .map(x => x.time);
}

/**
 * Tools exposed to the conversational AI agent. Each tool is a pure
 * function over the DB; the agent decides when to call them. Side effects
 * (booking, cancelling, locking) all go through here so the AI can never
 * "hallucinate" an action.
 */
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { dayjs, formatDateHebrew } from '../utils/date.js';
import { getAvailableSlots, getAvailableDates } from '../scheduling/availability.js';
import { createBooking, cancelBooking, findOrCreateCustomer, getCustomerAppointments } from '../scheduling/booking.js';
import { lockSlot, releaseLocksForCustomer } from '../scheduling/slot-locks.js';

export interface ToolContext {
  tenantId: string;
  tenantName: string;
  tenantTimezone: string;
  cancellationPolicy: string | null;
  address: string | null;
  customerPhone: string;
  customerName: string;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

/** Anthropic-format tool definitions, sent to Claude in the API call. */
export const TOOL_DEFINITIONS = [
  {
    name: 'get_services',
    description: 'List the active services this business offers, including duration and price.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_available_dates',
    description: 'Get the dates within the next N days that have at least one open slot for the given service. Returns ISO YYYY-MM-DD strings.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_id: { type: 'string', description: 'Service id from get_services' },
        days_ahead: { type: 'integer', description: 'How many days forward to scan (default 14)', default: 14 },
      },
      required: ['service_id'],
    },
  },
  {
    name: 'get_available_slots',
    description: 'Get the open time slots (HH:mm) for a specific service on a specific date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_id: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['service_id', 'date'],
    },
  },
  {
    name: 'lock_slot',
    description: 'Reserve a slot for THIS customer for ~5 minutes so other concurrent bookings cannot grab it while you confirm. Call this BEFORE asking the user to confirm a specific time. Returns hebrew_date you should quote verbatim to the user; never compute day-of-week yourself.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_id: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:mm 24h' },
      },
      required: ['service_id', 'date', 'time'],
    },
  },
  {
    name: 'create_appointment',
    description: 'Finalize the booking. Call this only after the user confirmed. Returns hebrew_date you can quote. Pass booking_for_name when the appointment is for someone else (e.g. the customer\'s child or spouse).',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_id: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:mm 24h' },
        booking_for_name: {
          type: 'string',
          description: 'Optional. Name of the person the appointment is FOR, if different from the WhatsApp customer (e.g. their child). Stored in appointment notes and used in reminders.',
        },
      },
      required: ['service_id', 'date', 'time'],
    },
  },
  {
    name: 'list_my_appointments',
    description: 'List the upcoming appointments belonging to the current customer.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel one of the current customer\'s upcoming appointments.',
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: { type: 'string' },
      },
      required: ['appointment_id'],
    },
  },
  {
    name: 'get_business_info',
    description: 'Get the business name, address, timezone, and cancellation policy.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

/** Dispatch a tool call from the model to its implementation. */
export async function runTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_services':
        return await toolGetServices(ctx);
      case 'get_available_dates':
        return await toolGetAvailableDates(ctx, args);
      case 'get_available_slots':
        return await toolGetAvailableSlots(ctx, args);
      case 'lock_slot':
        return await toolLockSlot(ctx, args);
      case 'create_appointment':
        return await toolCreateAppointment(ctx, args);
      case 'list_my_appointments':
        return await toolListAppointments(ctx);
      case 'cancel_appointment':
        return await toolCancelAppointment(ctx, args);
      case 'get_business_info':
        return toolGetBusinessInfo(ctx);
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    console.error(`Tool ${name} error:`, err);
    return { ok: false, error: err.message || 'Internal error' };
  }
}

async function toolGetServices(ctx: ToolContext): Promise<ToolResult> {
  const services = (await db.select().from(schema.services)
    .where(and(
      eq(schema.services.tenantId, ctx.tenantId),
      eq(schema.services.isActive, true),
    )))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    ok: true,
    data: services.map(s => ({
      id: s.id,
      name: s.name,
      duration_minutes: s.durationMinutes,
      price: s.price,
      currency: s.currency,
    })),
  };
}

async function toolGetAvailableDates(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const serviceId = String(args.service_id);
  const daysAhead = typeof args.days_ahead === 'number' ? args.days_ahead : 14;

  const [service] = await db.select().from(schema.services)
    .where(and(eq(schema.services.id, serviceId), eq(schema.services.tenantId, ctx.tenantId)));
  if (!service) return { ok: false, error: 'Unknown service_id' };

  const dates = await getAvailableDates(ctx.tenantId, service.durationMinutes, daysAhead);
  return {
    ok: true,
    data: dates.map(d => ({ date: d, hebrew: formatDateHebrew(dayjs(d)) })),
  };
}

async function toolGetAvailableSlots(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const serviceId = String(args.service_id);
  const date = String(args.date);

  const [service] = await db.select().from(schema.services)
    .where(and(eq(schema.services.id, serviceId), eq(schema.services.tenantId, ctx.tenantId)));
  if (!service) return { ok: false, error: 'Unknown service_id' };

  const slots = await getAvailableSlots(ctx.tenantId, date, service.durationMinutes, undefined, ctx.customerPhone);
  return {
    ok: true,
    data: {
      date,
      hebrew_date: formatDateHebrew(dayjs(date)),
      times: slots.map(s => s.time),
    },
  };
}

async function toolLockSlot(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const serviceId = String(args.service_id);
  const date = String(args.date);
  const time = String(args.time);

  const [service] = await db.select().from(schema.services)
    .where(and(eq(schema.services.id, serviceId), eq(schema.services.tenantId, ctx.tenantId)));
  if (!service) return { ok: false, error: 'Unknown service_id' };

  // Verify the slot is actually free (appointments + blocks + other locks all considered).
  // get_available_slots excludes existing appointments and blocked times.
  const free = await getAvailableSlots(ctx.tenantId, date, service.durationMinutes, undefined, ctx.customerPhone);
  if (!free.some(s => s.time === time)) {
    return {
      ok: false,
      error: 'Slot not available (taken, blocked, or outside working hours)',
      data: { available_alternatives: free.slice(0, 5).map(s => s.time) },
    };
  }

  const [h, m] = time.split(':').map(Number);
  const start = dayjs(date).hour(h).minute(m).second(0);
  const end = start.add(service.durationMinutes, 'minute');

  // Release any other slot this customer was holding (changing their mind).
  await releaseLocksForCustomer(ctx.tenantId, ctx.customerPhone);

  const lock = await lockSlot(
    ctx.tenantId,
    serviceId,
    ctx.customerPhone,
    start.format('YYYY-MM-DDTHH:mm:ss'),
    end.format('YYYY-MM-DDTHH:mm:ss'),
  );
  if (!lock) return { ok: false, error: 'Slot taken by another customer' };
  return {
    ok: true,
    data: {
      lock_id: lock.id,
      hebrew_date: formatDateHebrew(dayjs(date)),
      time,
      service_name: service.name,
    },
  };
}

async function toolCreateAppointment(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const serviceId = String(args.service_id);
  const date = String(args.date);
  const time = String(args.time);
  const bookingForName = typeof args.booking_for_name === 'string' ? args.booking_for_name.trim() : '';
  const notes = bookingForName ? `עבור ${bookingForName}` : undefined;

  const customerId = await findOrCreateCustomer(ctx.tenantId, ctx.customerPhone, ctx.customerName || undefined);
  const result = await createBooking(ctx.tenantId, customerId, serviceId, date, time, undefined, notes);

  // Whether it succeeded or not, drop the lock — same slot will be reflected via appointments table.
  await releaseLocksForCustomer(ctx.tenantId, ctx.customerPhone);

  if (!result.success) return { ok: false, error: result.error || 'Booking failed' };
  return {
    ok: true,
    data: {
      appointment_id: result.appointmentId,
      hebrew_date: formatDateHebrew(dayjs(date)),
      time,
      booking_for: bookingForName || null,
    },
  };
}

async function toolListAppointments(ctx: ToolContext): Promise<ToolResult> {
  const customerId = await findOrCreateCustomer(ctx.tenantId, ctx.customerPhone, ctx.customerName || undefined);
  const appts = await getCustomerAppointments(ctx.tenantId, customerId);
  return {
    ok: true,
    data: appts.map(a => {
      const forMatch = a.notes?.match(/^עבור\s+(.+)$/);
      return {
        appointment_id: a.id,
        service_name: a.serviceName,
        start_time: a.startTime,
        hebrew_date: formatDateHebrew(dayjs(a.startTime)),
        time: dayjs(a.startTime).format('HH:mm'),
        booking_for: forMatch ? forMatch[1].trim() : null,
      };
    }),
  };
}

async function toolCancelAppointment(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const appointmentId = String(args.appointment_id);
  const customerId = await findOrCreateCustomer(ctx.tenantId, ctx.customerPhone, ctx.customerName || undefined);

  // Verify this appointment belongs to the current customer
  const [appt] = await db.select().from(schema.appointments).where(and(
    eq(schema.appointments.id, appointmentId),
    eq(schema.appointments.tenantId, ctx.tenantId),
    eq(schema.appointments.customerId, customerId),
  ));
  if (!appt) return { ok: false, error: 'Appointment not found for this customer' };

  const success = await cancelBooking(appointmentId, 'בוטל ע"י הלקוח דרך הבוט');
  return success ? { ok: true } : { ok: false, error: 'Cancel failed' };
}

function toolGetBusinessInfo(ctx: ToolContext): ToolResult {
  return {
    ok: true,
    data: {
      name: ctx.tenantName,
      address: ctx.address,
      timezone: ctx.tenantTimezone,
      cancellation_policy: ctx.cancellationPolicy,
    },
  };
}

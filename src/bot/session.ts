import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

export type FlowState =
  | 'IDLE'
  | 'SELECT_SERVICE'
  | 'SELECT_DATE'
  | 'SELECT_TIME'
  | 'CONFIRM_BOOKING'
  | 'CANCEL_SELECT';

export interface Session {
  tenantId: string;
  customerPhone: string;
  customerName: string;
  state: FlowState;
  selectedServiceId?: string;
  selectedServiceName?: string;
  selectedDate?: string;       // YYYY-MM-DD
  selectedTime?: string;       // HH:mm
  selectedStaffId?: string;
  availableSlots?: string[];   // list of HH:mm
  appointmentIdToCancel?: string;
  /** The last response the bot sent — used as conversational context for the agent. */
  lastBotMessage?: string;
  /** The user's previous messages this session (oldest first, capped to keep context light). */
  recentUserMessages?: string[];
  lastActivity: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function sessionKey(tenantId: string, phone: string): string {
  return `${tenantId}:${phone}`;
}

/** Extract dynamic data fields from session into a JSON-safe object */
function sessionToData(session: Partial<Session>): string {
  const data: Record<string, unknown> = {};
  if (session.selectedServiceId !== undefined) data.selectedServiceId = session.selectedServiceId;
  if (session.selectedServiceName !== undefined) data.selectedServiceName = session.selectedServiceName;
  if (session.selectedDate !== undefined) data.selectedDate = session.selectedDate;
  if (session.selectedTime !== undefined) data.selectedTime = session.selectedTime;
  if (session.selectedStaffId !== undefined) data.selectedStaffId = session.selectedStaffId;
  if (session.availableSlots !== undefined) data.availableSlots = session.availableSlots;
  if (session.appointmentIdToCancel !== undefined) data.appointmentIdToCancel = session.appointmentIdToCancel;
  if (session.lastBotMessage !== undefined) data.lastBotMessage = session.lastBotMessage;
  if (session.recentUserMessages !== undefined) data.recentUserMessages = session.recentUserMessages;
  return JSON.stringify(data);
}

/** Reconstruct a full Session object from a DB row */
function rowToSession(row: typeof schema.sessions.$inferSelect): Session {
  const data = JSON.parse(row.data) as Record<string, unknown>;
  return {
    tenantId: row.tenantId,
    customerPhone: row.customerPhone,
    customerName: row.customerName,
    state: row.state as FlowState,
    lastActivity: new Date(row.lastActivity).getTime(),
    ...(data.selectedServiceId !== undefined && { selectedServiceId: data.selectedServiceId as string }),
    ...(data.selectedServiceName !== undefined && { selectedServiceName: data.selectedServiceName as string }),
    ...(data.selectedDate !== undefined && { selectedDate: data.selectedDate as string }),
    ...(data.selectedTime !== undefined && { selectedTime: data.selectedTime as string }),
    ...(data.selectedStaffId !== undefined && { selectedStaffId: data.selectedStaffId as string }),
    ...(data.availableSlots !== undefined && { availableSlots: data.availableSlots as string[] }),
    ...(data.appointmentIdToCancel !== undefined && { appointmentIdToCancel: data.appointmentIdToCancel as string }),
    ...(data.lastBotMessage !== undefined && { lastBotMessage: data.lastBotMessage as string }),
    ...(data.recentUserMessages !== undefined && { recentUserMessages: data.recentUserMessages as string[] }),
  };
}

export async function getSession(tenantId: string, phone: string): Promise<Session | null> {
  const key = sessionKey(tenantId, phone);
  const [row] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, key));

  if (!row) return null;

  // Check TTL
  const lastActivity = new Date(row.lastActivity).getTime();
  if (Date.now() - lastActivity > SESSION_TTL_MS) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, key));
    return null;
  }

  // Update last activity
  const now = new Date().toISOString();
  await db.update(schema.sessions).set({ lastActivity: now }).where(eq(schema.sessions.id, key));

  const session = rowToSession(row);
  session.lastActivity = Date.now();
  return session;
}

export async function createSession(tenantId: string, phone: string, name: string): Promise<Session> {
  const key = sessionKey(tenantId, phone);
  const now = new Date().toISOString();

  await db.insert(schema.sessions).values({
    id: key,
    tenantId,
    customerPhone: phone,
    customerName: name,
    state: 'IDLE',
    data: '{}',
    lastActivity: now,
  }).onConflictDoUpdate({
    target: schema.sessions.id,
    set: {
      customerName: name,
      state: 'IDLE',
      data: '{}',
      lastActivity: now,
    },
  });

  return {
    tenantId,
    customerPhone: phone,
    customerName: name,
    state: 'IDLE',
    lastActivity: Date.now(),
  };
}

export async function updateSession(session: Session, updates: Partial<Session>): Promise<Session> {
  Object.assign(session, updates, { lastActivity: Date.now() });

  const key = sessionKey(session.tenantId, session.customerPhone);
  await db.update(schema.sessions).set({
    state: session.state,
    customerName: session.customerName,
    data: sessionToData(session),
    lastActivity: new Date().toISOString(),
  }).where(eq(schema.sessions.id, key));

  return session;
}

export async function clearSession(tenantId: string, phone: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionKey(tenantId, phone)));
}

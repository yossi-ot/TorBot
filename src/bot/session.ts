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
  lastActivity: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const sessions = new Map<string, Session>();

function sessionKey(tenantId: string, phone: string): string {
  return `${tenantId}:${phone}`;
}

export function getSession(tenantId: string, phone: string): Session | null {
  const key = sessionKey(tenantId, phone);
  const session = sessions.get(key);

  if (!session) return null;

  // Check TTL
  if (Date.now() - session.lastActivity > SESSION_TTL_MS) {
    sessions.delete(key);
    return null;
  }

  session.lastActivity = Date.now();
  return session;
}

export function createSession(tenantId: string, phone: string, name: string): Session {
  const key = sessionKey(tenantId, phone);
  const session: Session = {
    tenantId,
    customerPhone: phone,
    customerName: name,
    state: 'IDLE',
    lastActivity: Date.now(),
  };
  sessions.set(key, session);
  return session;
}

export function updateSession(session: Session, updates: Partial<Session>): Session {
  Object.assign(session, updates, { lastActivity: Date.now() });
  return session;
}

export function clearSession(tenantId: string, phone: string): void {
  sessions.delete(sessionKey(tenantId, phone));
}

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
}, 5 * 60 * 1000);

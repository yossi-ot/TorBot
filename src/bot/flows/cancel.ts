import { Session, updateSession } from '../session.js';
import { getCustomerAppointments, cancelBooking, findOrCreateCustomer } from '../../scheduling/booking.js';
import { dayjs, formatDateHebrew } from '../../utils/date.js';

/** Start cancel flow - show upcoming appointments */
export async function startCancel(session: Session): Promise<string> {
  const customerId = await findOrCreateCustomer(
    session.tenantId,
    session.customerPhone,
    session.customerName || undefined,
  );

  const appointments = await getCustomerAppointments(session.tenantId, customerId);

  if (appointments.length === 0) {
    return 'אין לך תורים קרובים.';
  }

  updateSession(session, { state: 'CANCEL_SELECT' });

  const lines = appointments.map((a, i) =>
    `${i + 1}️⃣ ${a.serviceName} - ${formatDateHebrew(dayjs(a.startTime))} ב-${dayjs(a.startTime).format('HH:mm')}`
  );

  return `אלו התורים שלך:\n\n${lines.join('\n')}\n\nאיזה תור לבטל? (בחר מספר)`;
}

/** Handle cancel selection */
export async function handleCancelSelection(session: Session, input: string): Promise<string> {
  const customerId = await findOrCreateCustomer(
    session.tenantId,
    session.customerPhone,
    session.customerName || undefined,
  );

  const appointments = await getCustomerAppointments(session.tenantId, customerId);
  const num = parseInt(input);

  if (num < 1 || num > appointments.length || isNaN(num)) {
    return `בחר מספר בין 1 ל-${appointments.length}:`;
  }

  const appointment = appointments[num - 1];
  const success = await cancelBooking(appointment.id);

  updateSession(session, { state: 'IDLE' });

  if (success) {
    return `✅ התור בוטל:\n${appointment.serviceName} - ${formatDateHebrew(dayjs(appointment.startTime))} ב-${dayjs(appointment.startTime).format('HH:mm')}\n\nרוצה לקבוע תור חדש? כתוב "תור".`;
  }

  return 'שגיאה בביטול התור. נסה שוב.';
}

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

  await updateSession(session, { state: 'CANCEL_SELECT' });

  const lines = appointments.map((a, i) =>
    `${i + 1}. ${a.serviceName}, ${formatDateHebrew(dayjs(a.startTime))} ב-${dayjs(a.startTime).format('HH:mm')}`
  );

  return `התורים שלך:\n${lines.join('\n')}\nאיזה תור לבטל?`;
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

  await updateSession(session, { state: 'IDLE' });

  if (success) {
    return `בוטל. ${appointment.serviceName}, ${formatDateHebrew(dayjs(appointment.startTime))} ב-${dayjs(appointment.startTime).format('HH:mm')}.`;
  }

  return 'שגיאה בביטול. נסה שוב.';
}

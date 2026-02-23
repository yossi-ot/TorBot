import { Session } from '../session.js';
import { getCustomerAppointments, findOrCreateCustomer } from '../../scheduling/booking.js';
import { dayjs, formatDateHebrew } from '../../utils/date.js';

export function handleMyAppointments(session: Session): string {
  const customerId = findOrCreateCustomer(
    session.tenantId,
    session.customerPhone,
    session.customerName || undefined,
  );

  const appointments = getCustomerAppointments(session.tenantId, customerId);

  if (appointments.length === 0) {
    return 'אין לך תורים קרובים.\nרוצה לקבוע? כתוב "תור".';
  }

  const lines = appointments.map(a =>
    `📋 ${a.serviceName}\n📅 ${formatDateHebrew(dayjs(a.startTime))} ב-${dayjs(a.startTime).format('HH:mm')}`
  );

  return `*התורים שלך:*\n\n${lines.join('\n\n')}`;
}

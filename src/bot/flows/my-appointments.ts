import { Session } from '../session.js';
import { getCustomerAppointments, findOrCreateCustomer } from '../../scheduling/booking.js';
import { dayjs, formatDateHebrew } from '../../utils/date.js';

export async function handleMyAppointments(session: Session): Promise<string> {
  const customerId = await findOrCreateCustomer(
    session.tenantId,
    session.customerPhone,
    session.customerName || undefined,
  );

  const appointments = await getCustomerAppointments(session.tenantId, customerId);

  if (appointments.length === 0) {
    return 'אין לך תורים קרובים.';
  }

  const lines = appointments.map(a =>
    `${a.serviceName}, ${formatDateHebrew(dayjs(a.startTime))} ב-${dayjs(a.startTime).format('HH:mm')}`
  );

  return `התורים שלך:\n${lines.join('\n')}`;
}

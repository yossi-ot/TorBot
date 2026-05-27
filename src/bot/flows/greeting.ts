import { Session } from '../session.js';

/** Greeting back at the customer — time-aware, no menu push. */
export async function handleGreeting(session: Session): Promise<string> {
  const hour = new Date().getHours();
  let back: string;
  if (hour < 11) back = 'בוקר טוב';
  else if (hour < 16) back = 'צהריים טובים';
  else if (hour < 20) back = 'ערב טוב';
  else back = 'לילה טוב';

  return session.customerName ? `${back} ${session.customerName}.` : `${back}.`;
}

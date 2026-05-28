import { Session } from '../session.js';

/** Greeting back at the customer — time-aware. Every greeting includes the
 *  short usage hint so customers always see what they can ask for. */
export async function handleGreeting(session: Session): Promise<string> {
  const hour = new Date().getHours();
  let back: string;
  if (hour < 11) back = 'בוקר טוב';
  else if (hour < 16) back = 'צהריים טובים';
  else if (hour < 20) back = 'ערב טוב';
  else back = 'לילה טוב';

  const greetingLine = session.customerName ? `${back} ${session.customerName}.` : `${back}.`;

  return `${greetingLine}\nאפשר לכתוב: "תור" כדי לקבוע, "ביטול" כדי לבטל, או "התורים שלי".`;
}

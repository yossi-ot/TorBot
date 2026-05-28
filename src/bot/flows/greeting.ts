import { Session } from '../session.js';

/** Greeting back at the customer — time-aware. First-time customers also get
 *  a short explanation of what they can ask for; returning customers just get
 *  the greeting. */
export async function handleGreeting(session: Session): Promise<string> {
  const hour = new Date().getHours();
  let back: string;
  if (hour < 11) back = 'בוקר טוב';
  else if (hour < 16) back = 'צהריים טובים';
  else if (hour < 20) back = 'ערב טוב';
  else back = 'לילה טוב';

  const greetingLine = session.customerName ? `${back} ${session.customerName}.` : `${back}.`;

  // First-time customer (no prior bot reply on file) — include a short tip.
  if (!session.lastBotMessage) {
    return `${greetingLine}\nאפשר לכתוב: "תור" כדי לקבוע, "ביטול" כדי לבטל, או "התורים שלי".`;
  }

  return greetingLine;
}

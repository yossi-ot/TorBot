import { Session } from '../session.js';
import { db, schema } from '../../db/index.js';
import { eq } from 'drizzle-orm';

export function handleGreeting(session: Session): string {
  const tenant = db.select().from(schema.tenants)
    .where(eq(schema.tenants.id, session.tenantId))
    .get();

  const businessName = tenant?.name || 'העסק';

  return `שלום${session.customerName ? ' ' + session.customerName : ''}! 👋
אני הבוט של *${businessName}*.

מה תרצה לעשות?
1️⃣ קביעת תור חדש
2️⃣ ביטול תור
3️⃣ התורים שלי`;
}

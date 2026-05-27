import { Session } from '../session.js';
import { db, schema } from '../../db/index.js';
import { eq } from 'drizzle-orm';

export async function handleGreeting(session: Session): Promise<string> {
  const [tenant] = await db.select().from(schema.tenants)
    .where(eq(schema.tenants.id, session.tenantId));

  const businessName = tenant?.name || 'העסק';

  return `שלום${session.customerName ? ' ' + session.customerName : ''}. אני הבוט של ${businessName}.
מה תרצה לעשות? קביעת תור, ביטול, או "התורים שלי".`;
}

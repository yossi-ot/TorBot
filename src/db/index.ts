import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { config } from '../config.js';

// Production (and any normal run) uses node-postgres against Neon.
// Local isolated testing: set USE_PGLITE=1 to use an in-process PGlite
// database (no system Postgres, no admin, no network) persisted to
// PGLITE_DIR. The flag is never set in prod, so that path is untouched.
let db: NodePgDatabase<typeof schema>;

if (process.env.USE_PGLITE === '1') {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const dir = process.env.PGLITE_DIR || './.pglite-data';
  const client = new PGlite(dir);
  db = drizzle(client, { schema }) as unknown as NodePgDatabase<typeof schema>;
  console.log(`[db] Using local PGlite (${dir})`);
} else {
  const { default: pg } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  db = drizzle(pool, { schema });
}

export { db, schema };

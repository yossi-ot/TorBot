import { defineConfig } from 'drizzle-kit';

// Local-only: pushes the schema into the in-process PGlite data dir used by
// `USE_PGLITE=1`. Run with: npm run local:push
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  driver: 'pglite',
  dbCredentials: {
    url: process.env.PGLITE_DIR || './.pglite-data',
  },
});

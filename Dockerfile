FROM node:20-slim

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm ci

# Install dashboard dependencies and build
COPY dashboard/package*.json dashboard/
RUN cd dashboard && npm ci

COPY . .

# Pre-build dashboard (will be rebuilt at startup with env vars)
RUN cd dashboard && npm run build

EXPOSE 3000

# Build dashboard with env vars, push schema, seed, then start server
CMD ["sh", "-c", "printf 'VITE_META_APP_ID=%s\\nVITE_META_CONFIG_ID=%s\\n' \"$VITE_META_APP_ID\" \"$VITE_META_CONFIG_ID\" > dashboard/.env && cd dashboard && npm run build && cd /app && npx drizzle-kit push && npx tsx src/db/seed.ts && npx tsx src/index.ts"]

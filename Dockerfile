FROM node:20-slim

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm ci

# Install dashboard dependencies and build
COPY dashboard/package*.json dashboard/
RUN cd dashboard && npm ci

COPY . .

# Build dashboard (VITE_ vars must be available at build time)
ARG VITE_META_APP_ID
ARG VITE_META_CONFIG_ID
RUN cd dashboard && npm run build

EXPOSE 3000

# Push schema to DB, seed demo data, then start server
CMD ["sh", "-c", "npx drizzle-kit push && npx tsx src/db/seed.ts && npx tsx src/index.ts"]

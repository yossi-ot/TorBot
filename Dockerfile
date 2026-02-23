FROM node:20-slim

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm ci

# Install dashboard dependencies and build
COPY dashboard/package*.json dashboard/
RUN cd dashboard && npm ci

COPY . .

# Build dashboard
RUN cd dashboard && npm run build

# Create data directory for SQLite
RUN mkdir -p data

EXPOSE 3000

# Seed at runtime (so env vars are available), then start server
CMD ["sh", "-c", "npx tsx src/db/seed.ts && npx tsx src/index.ts"]

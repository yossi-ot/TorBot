FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Create data directory for SQLite
RUN mkdir -p data

EXPOSE 3000

# Seed at runtime (so env vars are available), then start server
CMD ["sh", "-c", "npx tsx src/db/seed.ts && npx tsx src/index.ts"]

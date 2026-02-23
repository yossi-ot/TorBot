FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Create data directory for SQLite
RUN mkdir -p data

# Seed the database
RUN npx tsx src/db/seed.ts

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]

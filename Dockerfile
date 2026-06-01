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

EXPOSE 3000

# Schema push + seed now run as the Fly release_command (see fly.toml).
# The start command only binds the port, so health checks pass immediately.
CMD ["npx", "tsx", "src/index.ts"]

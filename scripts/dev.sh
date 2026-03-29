#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[dev]${NC} $1"; }
warn()  { echo -e "${YELLOW}[dev]${NC} $1"; }
error() { echo -e "${RED}[dev]${NC} $1"; }

# ──────────────────────────────────────────────
# 1. Check prerequisites
# ──────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
  error "Docker is not installed. Install it from https://docker.com"
  exit 1
fi

if ! docker info &>/dev/null; then
  error "Docker daemon is not running. Start Docker Desktop and try again."
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  error "pnpm is not installed. Run: npm install -g pnpm"
  exit 1
fi

# ──────────────────────────────────────────────
# 2. Start PostgreSQL + Redis via Docker Compose
# ──────────────────────────────────────────────

pg_ready() {
  docker compose exec -T postgres pg_isready -U contexta -d contexta_bot &>/dev/null
}

redis_ready() {
  docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG
}

# Check if containers are already running and healthy
PG_UP=false
REDIS_UP=false

if docker compose ps --status running 2>/dev/null | grep -q postgres && pg_ready; then
  PG_UP=true
fi

if docker compose ps --status running 2>/dev/null | grep -q redis && redis_ready; then
  REDIS_UP=true
fi

port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN -t &>/dev/null
}

port_owner() {
  lsof -iTCP:"$1" -sTCP:LISTEN -n -P 2>/dev/null | tail -1 | awk '{print $1 " (PID " $2 ")"}'
}

if $PG_UP && $REDIS_UP; then
  info "PostgreSQL and Redis are already running."
else
  # Kill anything occupying required ports
  for PORT in 5432 6379; do
    if port_in_use "$PORT"; then
      OWNER=$(port_owner "$PORT")
      warn "Port $PORT in use by $OWNER — killing it..."
      kill $(lsof -iTCP:"$PORT" -sTCP:LISTEN -t) 2>/dev/null || true
      sleep 1
    fi
  done

  info "Starting PostgreSQL and Redis..."
  docker compose up -d --wait
  info "Services started."
fi

# ──────────────────────────────────────────────
# 3. Ensure .env exists
# ──────────────────────────────────────────────

if [ ! -f .env ]; then
  warn ".env not found — copying from .env.example"
  cp .env.example .env
  # Fill in Docker Compose defaults
  sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://contexta:contexta@localhost:5432/contexta_bot|' .env
  sed -i '' 's|^REDIS_URL=.*|REDIS_URL=redis://localhost:6379|' .env
  sed -i '' 's|^DISABLE_DB_SSL=.*|DISABLE_DB_SSL=true|' .env
  # Generate a NEXTAUTH_SECRET if empty
  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  sed -i '' "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEXTAUTH_SECRET}|" .env
  # Generate a BOT_API_KEY if empty
  BOT_API_KEY=$(openssl rand -hex 16)
  sed -i '' "s|^BOT_API_KEY=.*|BOT_API_KEY=${BOT_API_KEY}|" .env
  # Generate a CRON_SECRET if empty
  CRON_SECRET=$(openssl rand -hex 16)
  sed -i '' "s|^CRON_SECRET=.*|CRON_SECRET=${CRON_SECRET}|" .env
  info ".env created with Docker defaults. Fill in DISCORD_TOKEN and API keys."
fi

# ──────────────────────────────────────────────
# 4. Install dependencies
# ──────────────────────────────────────────────

if [ ! -d node_modules ] || [ ! -d apps/bot/node_modules ]; then
  info "Installing dependencies..."
  pnpm install
else
  info "Dependencies already installed."
fi

# ──────────────────────────────────────────────
# 5. Apply database schema (pgvector + tables)
# ──────────────────────────────────────────────

info "Applying database schema..."

# Source DATABASE_URL from .env
export $(grep -E '^DATABASE_URL=' .env | xargs)
export DISABLE_DB_SSL=true

# Apply schema via psql in the postgres container
docker compose exec -T postgres psql -U contexta -d contexta_bot <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS server_settings (
    server_id VARCHAR(255) PRIMARY KEY,
    active_model VARCHAR(50) DEFAULT 'gemini-2.5-flash',
    server_lore TEXT,
    context_cache_id VARCHAR(255),
    cache_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_users (
    user_id VARCHAR(255) PRIMARY KEY,
    global_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_interaction TIMESTAMP
);

CREATE TABLE IF NOT EXISTS server_members (
    server_id VARCHAR(255) REFERENCES server_settings(server_id),
    user_id VARCHAR(255) REFERENCES global_users(user_id),
    inferred_context TEXT,
    preferences JSONB DEFAULT '{}',
    interaction_count INT DEFAULT 0,
    PRIMARY KEY (server_id, user_id)
);

CREATE TABLE IF NOT EXISTS channel_memory_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255) NOT NULL,
    summary_text TEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    time_start TIMESTAMP NOT NULL,
    time_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS channel_memory_meta_idx ON channel_memory_vectors (server_id, channel_id);
CREATE INDEX IF NOT EXISTS channel_memory_vector_idx ON channel_memory_vectors USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_servers (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id  TEXT NOT NULL,
  is_admin   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, server_id)
);

CREATE INDEX IF NOT EXISTS idx_user_servers_server ON user_servers(server_id);
SQL

info "Database schema applied."

# ──────────────────────────────────────────────
# 6. Summary
# ──────────────────────────────────────────────

echo ""
info "Development environment ready!"
echo ""
echo "  PostgreSQL: postgresql://contexta:contexta@localhost:5432/contexta_bot"
echo "  Redis:      redis://localhost:6379"
echo ""
echo "  Start apps:"
echo "    pnpm dev:backend    # API server on :4000"
echo "    pnpm dev:bot        # Discord bot"
echo "    pnpm dev:dashboard  # Dashboard on :3000"
echo "    pnpm dev:website    # Website on :3001"
echo ""
echo "  Stop services:"
echo "    docker compose down"
echo ""

# Auth & Dashboard Design

**Date:** 2026-03-24
**Scope:** Discord OAuth web dashboard for server administration and user views
**Sub-project:** 1 of 2 (Monetization is Sub-project 2, depends on this)

---

## Overview

A standalone Next.js 15 web dashboard that lets Discord users log in via OAuth and manage their bot-enabled servers. Server admins configure bot settings and lore through the dashboard (replacing slash commands). Regular members browse conversation history. The dashboard shares the bot's PostgreSQL and Redis databases but runs as a separate Railway service.

---

## Architecture

### Deployment Topology

```
[Discord OAuth] <---> [Next.js Dashboard (Railway)] <---> [PostgreSQL (shared)]
                                                     <---> [Redis (shared)]
                      [Discord Bot (Railway)] <-----------> [PostgreSQL (shared)]
                                              <-----------> [Redis (shared)]
```

The bot and dashboard are independent services with no direct communication. They share state through the database. The bot continues operating exactly as before — no modifications to the bot service.

### Project Structure

The Next.js app lives in `dashboard/` at the repo root. The repo becomes a monorepo with two independent packages:

```
contexta-bot/
  src/                  # Existing bot code (unchanged)
  package.json          # Bot dependencies
  dashboard/
    src/
      app/              # Next.js App Router pages
      lib/              # Auth config, DB queries, authorization helpers
      tests/            # Vitest tests
    package.json        # Dashboard dependencies
    tsconfig.json
    next.config.ts
    tailwind.config.ts
```

Each service has its own `package.json`, `tsconfig.json`, and build command. No shared build step.

### Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15, App Router |
| Auth | Auth.js v5 (NextAuth v5), Discord provider |
| Styling | Tailwind CSS |
| Database | Shared PostgreSQL via `pg` pool |
| Cache/History | Shared Redis via `ioredis` |
| Session | JWT strategy (stateless, no session table) |
| Deployment | Railway (separate service, same project) |

---

## Auth Flow

1. User clicks "Sign in with Discord" on the landing page
2. Redirected to Discord OAuth2 authorization — grants `identify` and `guilds` scopes
3. Discord redirects back with authorization code
4. Auth.js exchanges code for access token, fetches user profile and guild list from Discord API
5. On first login, inserts row into `users` table; on subsequent logins, updates `updated_at`
6. Guild list is synced to `user_servers` table — each guild the user is in gets a row with `is_admin` derived from the `MANAGE_GUILD` permission flag
7. JWT session created containing Discord user ID — used to look up everything else from DB

**Access token handling:** The Discord access token is used only during the `signIn` callback to fetch the guild list. It is **not** stored in the JWT or database — the guild sync happens at login time and the token is discarded. If future features require calling the Discord API on behalf of the user outside of login, the token would need to be persisted (deferred).

**Guild sync staleness:** The `user_servers` table reflects the user's guild memberships as of their last login. A user who leaves a server will retain their row until they log in again. This is acceptable — no polling or webhook-based sync is needed for MVP.

### OAuth Scopes

| Scope | Purpose |
|-------|---------|
| `identify` | User ID, username, avatar |
| `guilds` | List of servers + per-server permissions (determines admin status) |

---

## Database Schema Changes

Two new tables. No changes to existing tables.

### `users`

Discord users who have logged into the dashboard.

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,       -- Discord user ID
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `user_servers`

Junction table linking users to servers they can manage. Refreshed on each login from the Discord guilds response.

```sql
CREATE TABLE user_servers (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id  TEXT NOT NULL,
  is_admin   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, server_id)
);

CREATE INDEX idx_user_servers_server ON user_servers(server_id);
```

### Guild Sync Logic

On each login (in the Auth.js `signIn` callback):
1. Upsert the `users` row
2. Fetch the user's guild list from Discord API using the access token
3. Delete all existing `user_servers` rows for this user
4. Insert new rows for each guild, setting `is_admin = true` if the user's permission bitfield includes `MANAGE_GUILD` (0x20)

This ensures permissions stay current without polling Discord.

---

## Dashboard Pages

### Route Map

| Route | Auth | Authorization | Purpose |
|-------|------|---------------|---------|
| `/` | None | None | Landing page, "Sign in with Discord" |
| `/dashboard` | Required | Authenticated | Server list — shows servers where bot is present |
| `/dashboard/[serverId]` | Required | Server member | Server overview — role-based views |
| `/dashboard/[serverId]/settings` | Required | Server admin | Bot config: active model, cache management |
| `/dashboard/[serverId]/lore` | Required | Server admin | View/edit server lore |
| `/dashboard/[serverId]/history` | Required | Server member | Browse channel conversation history |
| `/api/auth/[...nextauth]` | - | - | Auth.js route handler |

### Authorization Model

Three layers of access control:

1. **Auth middleware** — all `/dashboard/*` routes check for a valid session. Redirects to `/` if unauthenticated.
2. **Server membership** — server-specific pages verify the user has a `user_servers` row for that `server_id`. Returns 403 if not a member.
3. **Admin gating** — admin pages (`/settings`, `/lore`) additionally check `is_admin = true` on the `user_servers` row. Returns 403 if not admin.

### Bot Presence Filter

The dashboard only shows servers where the bot is installed. On the `/dashboard` server list page:
- Query `user_servers` for the logged-in user
- Inner join with `server_settings` — if a row exists there, the bot has been active in that server
- This avoids needing a separate "bot installations" table

### Page Details

**Landing page (`/`):** Minimal — bot name/logo, description, "Sign in with Discord" button. No content for unauthenticated users beyond this.

**Server list (`/dashboard`):** Grid/list of servers with bot present. Each card shows server name, member's role (admin/member), and a "Manage"/"View" button.

**Server detail (`/dashboard/[serverId]`):** Overview page. Admins see links to Settings, Lore, and History. Members see History only.

**Settings (`/dashboard/[serverId]/settings`):** Read/write the `server_settings` row for this server. Fields: active model selection (dropdown). Cache actions: refresh, clear — these operate directly on the shared database and Redis (e.g., deleting the relevant Redis cache keys), not by calling the bot. The bot and dashboard both read from the same DB/Redis state, so a dashboard write is immediately visible to the bot on its next read.

**Lore (`/dashboard/[serverId]/lore`):** Text editor for server lore. Reads/writes lore content for this server. The `/lore` slash command remains functional in Discord — both paths (dashboard and slash command) read/write the same DB row, so they stay in sync automatically.

**History (`/dashboard/[serverId]/history`):** Read-only. Lists channels with conversation history. Pulls recent messages from Redis (`channel:{channelId}:history`) and memory summaries from `channel_memory_vectors`. Paginated.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Shared PostgreSQL connection string |
| `REDIS_URL` | Shared Redis connection string |
| `NEXTAUTH_URL` | Dashboard public URL (e.g., `https://dashboard.contexta.bot`) |
| `NEXTAUTH_SECRET` | JWT signing secret (generate with `openssl rand -base64 32`) |
| `DISCORD_CLIENT_ID` | Discord OAuth2 application client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 application client secret |

---

## Testing Strategy

Tests live in `dashboard/src/tests/` and use Vitest (consistent with the bot's test setup).

### Unit Tests
- Guild sync logic: permission bitfield parsing, `is_admin` derivation
- Authorization helpers: membership check, admin check, edge cases (null permissions, missing rows)

### Component Tests
- Auth callback: mock Discord API responses, verify user/user_servers upsert
- API routes: mock session, verify correct data returned for admin vs member
- Authorization middleware: verify redirects for unauthenticated, 403 for unauthorized

### Not in Scope for Testing
- End-to-end browser tests (deferred)
- Visual/screenshot regression tests (deferred)

---

## Scope Boundaries

### In Scope
- Next.js app scaffold with App Router, Tailwind CSS
- Discord OAuth via Auth.js v5
- `users` and `user_servers` tables with migration SQL
- Auth middleware and authorization helpers
- Landing page, server list, server detail, settings, lore, history pages
- Vitest test suite for auth and authorization logic

### Deferred to Sub-project 2 (Monetization)
- Stripe integration, subscription tables, billing portal
- Tier-gated features (premium models, extended memory)
- Subscription status checks in dashboard and bot

### Deferred to Future Work
- User personal settings or preferences
- Real-time dashboard-to-bot communication (WebSocket/SSE)
- Bot management from dashboard (start/stop/restart)
- Analytics or usage dashboards
- End-to-end browser tests

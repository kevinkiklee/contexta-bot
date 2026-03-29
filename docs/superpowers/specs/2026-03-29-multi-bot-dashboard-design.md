# Multi-Bot Dashboard Support

## Problem

The dashboard and database assume a single bot instance. Both the dev and prod Contexta bots share one database, but `server_settings` is keyed only by `server_id`. The startup guild sync marks servers as inactive if the current bot isn't in them, so whichever bot starts last clobbers the other's data. The dashboard has no way to browse servers for a specific bot.

## Solution

Make the system bot-aware by adding a `bot_id` column to `server_settings` and a bot selector to the dashboard.

## Schema

Change `server_settings` primary key from `server_id` to `(server_id, bot_id)`:

```sql
ALTER TABLE server_settings DROP CONSTRAINT server_settings_pkey;
ALTER TABLE server_settings ADD COLUMN bot_id VARCHAR(255) NOT NULL DEFAULT 'unknown';
ALTER TABLE server_settings ADD PRIMARY KEY (server_id, bot_id);
```

Tables that reference `server_settings.server_id` (`server_members`) will need the FK updated to include `bot_id`, or the FK dropped since it's not enforced at the app level anyway.

## Bot Changes

- **New env var:** `BOT_CLIENT_ID` — the Discord application/client ID for this bot instance.
- **`guildCreate.ts`**: upsert includes `bot_id`.
- **`guildDelete.ts`**: update filters by `bot_id`.
- **Startup sync in `index.ts`**: all queries include `bot_id`. Only deactivates servers for its own `bot_id`.
- **Backend API calls**: bot sends `BOT_CLIENT_ID` via `X-Bot-Id` header so the backend knows which bot is making requests.

## Backend Changes

- Read `X-Bot-Id` header (or fall back to `BOT_CLIENT_ID` env var for backward compat).
- All `server_settings` queries include `bot_id` in WHERE clauses and INSERTs.
- Routes: `GET/PUT /servers/:id/settings`, `GET/PUT /servers/:id/lore`, `POST /api/chat`, cache routes.

## Dashboard Changes

- **New env var:** `BOTS` — comma-separated `label:clientId` pairs, e.g. `Dev:123456,Prod:789012`.
- **Config parser:** `lib/bots.ts` — parses `BOTS` into `{ label: string, botId: string }[]`. First entry is the default.
- **Bot selector:** dropdown in the sidebar header. Selection stored in a cookie (`bot_id`) so it persists across pages and refreshes.
- **Query changes:** `getUserServers` adds `AND ss.bot_id = $2`. All server-detail queries pass `bot_id`.
- **URL structure:** unchanged. The bot context comes from the cookie, not the URL, keeping existing links working.

## Env Vars

| Var | Where | Example |
|-----|-------|---------|
| `BOT_CLIENT_ID` | Bot, Backend | `1234567890` |
| `BOTS` | Dashboard | `Dev:1234567890,Prod:0987654321` |

## Migration Strategy

1. Add `bot_id` column with `DEFAULT 'unknown'` so existing rows don't break.
2. Deploy bot with `BOT_CLIENT_ID` set — startup sync updates its rows to the correct `bot_id`.
3. Any rows still marked `'unknown'` are legacy and can be cleaned up manually or left as-is.

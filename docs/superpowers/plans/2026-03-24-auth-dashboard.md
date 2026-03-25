# Auth & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 15 web dashboard with Discord OAuth that lets server admins manage bot settings/lore and lets members browse conversation history.

**Architecture:** Standalone Next.js app in `dashboard/` sharing the bot's PostgreSQL and Redis. Auth via Auth.js v5 with Discord provider and JWT sessions. Three-layer authorization: session check, server membership, admin gating. No modifications to the bot service.

**Tech Stack:** Next.js 15 (App Router), Auth.js v5, Tailwind CSS, PostgreSQL (`pg`), Redis (`ioredis`), Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-auth-dashboard-design.md`

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `dashboard/package.json` | Create | Dashboard dependencies and scripts |
| `dashboard/tsconfig.json` | Create | TypeScript config for Next.js |
| `dashboard/next.config.ts` | Create | Next.js configuration |
| `dashboard/tailwind.config.ts` | Create | Tailwind CSS configuration |
| `dashboard/postcss.config.mjs` | Create | PostCSS for Tailwind |
| `dashboard/.env.example` | Create | Environment variable template |
| `dashboard/vitest.config.ts` | Create | Test configuration |
| `dashboard/src/lib/db.ts` | Create | PostgreSQL pool and query helpers |
| `dashboard/src/lib/redis.ts` | Create | Redis client connection |
| `dashboard/src/lib/auth.ts` | Create | Auth.js v5 config with Discord provider |
| `dashboard/src/lib/auth-helpers.ts` | Create | Guild sync, permission parsing, authorization checks |
| `dashboard/src/lib/queries.ts` | Create | DB query functions (servers, settings, lore, history) |
| `dashboard/src/middleware.ts` | Create | Next.js middleware for auth redirects |
| `dashboard/src/app/layout.tsx` | Create | Root layout with Tailwind, session provider |
| `dashboard/src/app/page.tsx` | Create | Landing page with Discord sign-in |
| `dashboard/src/app/api/auth/[...nextauth]/route.ts` | Create | Auth.js route handler |
| `dashboard/src/app/dashboard/layout.tsx` | Create | Dashboard layout (authenticated wrapper) |
| `dashboard/src/app/dashboard/page.tsx` | Create | Server list page |
| `dashboard/src/app/dashboard/[serverId]/layout.tsx` | Create | Server-scoped layout with membership check |
| `dashboard/src/app/dashboard/[serverId]/page.tsx` | Create | Server overview page |
| `dashboard/src/app/dashboard/[serverId]/settings/page.tsx` | Create | Settings management page (admin only) |
| `dashboard/src/app/dashboard/[serverId]/lore/page.tsx` | Create | Lore editor page (admin only) |
| `dashboard/src/app/dashboard/[serverId]/history/page.tsx` | Create | Channel history browser |
| `dashboard/src/tests/unit/auth-helpers.test.ts` | Create | Unit tests for permission parsing and authorization |
| `dashboard/src/tests/unit/queries.test.ts` | Create | Unit tests for DB query functions |
| `dashboard/src/tests/helpers/mockDb.ts` | Create | Mock PostgreSQL pool |
| `src/db/schema.sql` | Modify | Add `users` and `user_servers` tables |

---

## Task 1: Scaffold Next.js App

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/next.config.ts`
- Create: `dashboard/tailwind.config.ts`
- Create: `dashboard/postcss.config.mjs`
- Create: `dashboard/.env.example`
- Create: `dashboard/vitest.config.ts`
- Create: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/app/page.tsx`

---

- [ ] **Step 1: Create `dashboard/package.json`**

```json
{
  "name": "contexta-dashboard",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "next-auth": "^5.0.0-beta.28",
    "@auth/core": "^0.38.0",
    "pg": "^8.13.0",
    "ioredis": "^5.6.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@types/pg": "^8.11.0",
    "typescript": "^5.9.0",
    "tailwindcss": "^4.1.0",
    "@tailwindcss/postcss": "^4.1.0",
    "vitest": "^4.1.0",
    "@vitejs/plugin-react": "^4.4.0"
  }
}
```

- [ ] **Step 2: Create `dashboard/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `dashboard/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create `dashboard/tailwind.config.ts` and `dashboard/postcss.config.mjs`**

`dashboard/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
};

export default config;
```

`dashboard/postcss.config.mjs`:
```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

- [ ] **Step 5: Create `dashboard/.env.example`**

```
DATABASE_URL=postgresql://user:pass@localhost:5432/contexta
REDIS_URL=redis://localhost:6379
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

- [ ] **Step 6: Create `dashboard/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 7: Create `dashboard/src/app/globals.css`**

```css
@import 'tailwindcss';
```

- [ ] **Step 8: Create root layout `dashboard/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contexta Dashboard',
  description: 'Manage your Contexta bot servers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create landing page `dashboard/src/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">Contexta</h1>
      <p className="text-gray-400 mb-8">AI co-host for your Discord server</p>
      <a
        href="/api/auth/signin"
        className="rounded-lg bg-indigo-600 px-6 py-3 text-white font-medium hover:bg-indigo-500 transition"
      >
        Sign in with Discord
      </a>
    </main>
  );
}
```

- [ ] **Step 10: Install dependencies and verify build scaffolding**

```bash
cd dashboard && npm install
```

Note: The build will not pass yet — `@/lib/auth` doesn't exist. That's expected; we just need `npm install` to succeed.

- [ ] **Step 11: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): scaffold Next.js 15 app with Tailwind and Vitest"
```

---

## Task 2: Database Migration — `users` and `user_servers` Tables

**Files:**
- Modify: `src/db/schema.sql`

---

- [ ] **Step 1: Add the new tables to `src/db/schema.sql`**

Append after the existing table definitions:

```sql
-- Dashboard: Discord users who have logged in
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard: Links users to their Discord servers
CREATE TABLE IF NOT EXISTS user_servers (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id  TEXT NOT NULL,
  is_admin   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, server_id)
);

CREATE INDEX IF NOT EXISTS idx_user_servers_server ON user_servers(server_id);
```

- [ ] **Step 2: Commit**

```bash
git add src/db/schema.sql
git commit -m "feat(db): add users and user_servers tables for dashboard auth"
```

---

## Task 3: Database and Redis Clients

**Files:**
- Create: `dashboard/src/lib/db.ts`
- Create: `dashboard/src/lib/redis.ts`

---

- [ ] **Step 1: Create `dashboard/src/lib/db.ts`**

This mirrors the bot's `src/db/index.ts` pattern — a singleton pool with SSL auto-detection:

```ts
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const ssl = process.env.DISABLE_DB_SSL === 'true' || isLocal ? false : { rejectUnauthorized: false };

export const pool = new pg.Pool({
  connectionString: connectionString.replace(/[?&]sslmode=[^&]*/g, ''),
  ssl,
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
```

- [ ] **Step 2: Create `dashboard/src/lib/redis.ts`**

```ts
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl);
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/db.ts dashboard/src/lib/redis.ts
git commit -m "feat(dashboard): add PostgreSQL and Redis client modules"
```

---

## Task 4: Auth Helpers — Permission Parsing and Authorization

**Files:**
- Create: `dashboard/src/lib/auth-helpers.ts`
- Create: `dashboard/src/tests/unit/auth-helpers.test.ts`
- Create: `dashboard/src/tests/helpers/mockDb.ts`

**This is the core authorization logic — TDD.**

---

- [ ] **Step 1: Create `dashboard/src/tests/helpers/mockDb.ts`**

```ts
import { vi } from 'vitest';

export function createMockDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}
```

- [ ] **Step 2: Write failing tests for permission parsing**

Create `dashboard/src/tests/unit/auth-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hasManageGuild, parseGuildPermissions } from '@/lib/auth-helpers';

describe('hasManageGuild', () => {
  it('returns true when MANAGE_GUILD (0x20) bit is set', () => {
    // 0x20 = 32 in decimal
    expect(hasManageGuild('32')).toBe(true);
  });

  it('returns true when MANAGE_GUILD is part of a larger bitmask', () => {
    // ADMINISTRATOR (0x8) | MANAGE_GUILD (0x20) = 0x28 = 40
    expect(hasManageGuild('40')).toBe(true);
  });

  it('returns false when MANAGE_GUILD bit is not set', () => {
    // Only SEND_MESSAGES (0x800) = 2048
    expect(hasManageGuild('2048')).toBe(false);
  });

  it('returns false for zero permissions', () => {
    expect(hasManageGuild('0')).toBe(false);
  });

  it('returns true when ADMINISTRATOR (0x8) bit is set', () => {
    // Administrators implicitly have all permissions
    expect(hasManageGuild('8')).toBe(true);
  });
});

describe('parseGuildPermissions', () => {
  it('returns guild entries with is_admin derived from permissions', () => {
    const guilds = [
      { id: 'guild-1', permissions: '40' },  // MANAGE_GUILD set
      { id: 'guild-2', permissions: '2048' }, // no admin
    ];

    const result = parseGuildPermissions(guilds);

    expect(result).toEqual([
      { serverId: 'guild-1', isAdmin: true },
      { serverId: 'guild-2', isAdmin: false },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parseGuildPermissions([])).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to confirm failure**

```bash
cd dashboard && npx vitest run src/tests/unit/auth-helpers.test.ts
```

Expected: FAIL — module `@/lib/auth-helpers` not found.

- [ ] **Step 4: Implement permission parsing in `dashboard/src/lib/auth-helpers.ts`**

```ts
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

export function hasManageGuild(permissionsString: string): boolean {
  const perms = BigInt(permissionsString);
  return (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_GUILD) !== 0n;
}

export interface GuildPermission {
  serverId: string;
  isAdmin: boolean;
}

export function parseGuildPermissions(
  guilds: { id: string; permissions: string }[]
): GuildPermission[] {
  return guilds.map(g => ({
    serverId: g.id,
    isAdmin: hasManageGuild(g.permissions),
  }));
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
cd dashboard && npx vitest run src/tests/unit/auth-helpers.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Write failing tests for guild sync**

Append to `dashboard/src/tests/unit/auth-helpers.test.ts`:

```ts
import { vi } from 'vitest';
import { syncUserGuilds } from '@/lib/auth-helpers';
import { createMockDb } from '../helpers/mockDb';

describe('syncUserGuilds', () => {
  it('upserts user and replaces user_servers rows', async () => {
    const db = createMockDb();
    const user = { id: 'user-1', username: 'Alice', avatar_url: 'https://cdn.example.com/a.png' };
    const guilds = [
      { id: 'guild-1', permissions: '40' },
      { id: 'guild-2', permissions: '2048' },
    ];

    await syncUserGuilds(db, user, guilds);

    // Upsert user
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['user-1', 'Alice', 'https://cdn.example.com/a.png'])
    );

    // Delete old server memberships
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM user_servers'),
      ['user-1']
    );

    // Insert new server memberships
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_servers'),
      expect.arrayContaining(['user-1'])
    );
  });

  it('handles empty guild list', async () => {
    const db = createMockDb();
    const user = { id: 'user-1', username: 'Alice', avatar_url: null };

    await syncUserGuilds(db, user, []);

    // Still upserts user
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.anything()
    );
    // Still deletes old rows
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM user_servers'),
      ['user-1']
    );
    // No insert for empty list (only 2 calls total: upsert + delete)
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 7: Run to confirm failure**

```bash
cd dashboard && npx vitest run src/tests/unit/auth-helpers.test.ts
```

Expected: new tests FAIL — `syncUserGuilds` not exported.

- [ ] **Step 8: Implement `syncUserGuilds`**

Append to `dashboard/src/lib/auth-helpers.ts`:

```ts
interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
}

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
}

export async function syncUserGuilds(
  db: DbClient,
  user: UserProfile,
  guilds: { id: string; permissions: string }[]
): Promise<void> {
  // Upsert user
  await db.query(
    `INSERT INTO users (id, username, avatar_url) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET username = $2, avatar_url = $3, updated_at = NOW()`,
    [user.id, user.username, user.avatar_url]
  );

  // Replace guild memberships
  await db.query('DELETE FROM user_servers WHERE user_id = $1', [user.id]);

  if (guilds.length === 0) return;

  const parsed = parseGuildPermissions(guilds);
  const values = parsed.map((g, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
  const params: unknown[] = [user.id];
  for (const g of parsed) {
    params.push(g.serverId, g.isAdmin);
  }

  await db.query(`INSERT INTO user_servers (user_id, server_id, is_admin) VALUES ${values}`, params);
}
```

- [ ] **Step 9: Run tests**

```bash
cd dashboard && npx vitest run src/tests/unit/auth-helpers.test.ts
```

Expected: all PASS.

- [ ] **Step 10: Write failing tests for authorization helpers**

Append to `dashboard/src/tests/unit/auth-helpers.test.ts`:

```ts
import { checkServerMembership, checkServerAdmin } from '@/lib/auth-helpers';

describe('checkServerMembership', () => {
  it('returns the row when user is a member', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ user_id: 'u1', server_id: 's1', is_admin: false }], rowCount: 1 });

    const result = await checkServerMembership(db, 'u1', 's1');
    expect(result).toEqual({ user_id: 'u1', server_id: 's1', is_admin: false });
  });

  it('returns null when user is not a member', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await checkServerMembership(db, 'u1', 's1');
    expect(result).toBeNull();
  });
});

describe('checkServerAdmin', () => {
  it('returns true when user is admin for server', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ is_admin: true }], rowCount: 1 });

    expect(await checkServerAdmin(db, 'u1', 's1')).toBe(true);
  });

  it('returns false when user is member but not admin', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ is_admin: false }], rowCount: 1 });

    expect(await checkServerAdmin(db, 'u1', 's1')).toBe(false);
  });

  it('returns false when user is not a member at all', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    expect(await checkServerAdmin(db, 'u1', 's1')).toBe(false);
  });
});
```

- [ ] **Step 11: Run to confirm failure**

```bash
cd dashboard && npx vitest run src/tests/unit/auth-helpers.test.ts
```

Expected: new tests FAIL.

- [ ] **Step 12: Implement authorization helpers**

Append to `dashboard/src/lib/auth-helpers.ts`:

```ts
interface UserServerRow {
  user_id: string;
  server_id: string;
  is_admin: boolean;
}

export async function checkServerMembership(
  db: DbClient,
  userId: string,
  serverId: string
): Promise<UserServerRow | null> {
  const result = await db.query(
    'SELECT user_id, server_id, is_admin FROM user_servers WHERE user_id = $1 AND server_id = $2',
    [userId, serverId]
  ) as { rows: UserServerRow[] };
  return result.rows[0] ?? null;
}

export async function checkServerAdmin(
  db: DbClient,
  userId: string,
  serverId: string
): Promise<boolean> {
  const membership = await checkServerMembership(db, userId, serverId);
  return membership?.is_admin ?? false;
}
```

- [ ] **Step 13: Run all auth-helpers tests**

```bash
cd dashboard && npx vitest run src/tests/unit/auth-helpers.test.ts
```

Expected: all PASS.

- [ ] **Step 14: Commit**

```bash
git add dashboard/src/lib/auth-helpers.ts dashboard/src/tests/unit/auth-helpers.test.ts dashboard/src/tests/helpers/mockDb.ts
git commit -m "feat(dashboard): add auth helpers with permission parsing, guild sync, and authorization"
```

---

## Task 5: Auth.js Configuration and Route Handler

**Files:**
- Create: `dashboard/src/lib/auth.ts`
- Create: `dashboard/src/app/api/auth/[...nextauth]/route.ts`

**Prerequisite:** Task 4 (auth-helpers).

---

- [ ] **Step 1: Create `dashboard/src/lib/auth.ts`**

```ts
import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import { syncUserGuilds } from './auth-helpers';
import { pool } from './db';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: { scope: 'identify guilds' },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account?.access_token) return false;

      // Fetch guilds from Discord API
      const res = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${account.access_token}` },
      });

      if (!res.ok) {
        console.error('[Auth] Failed to fetch guilds:', res.status);
        return false;
      }

      const guilds = (await res.json()) as { id: string; permissions: string }[];

      await syncUserGuilds(pool, {
        id: user.id!,
        username: user.name ?? 'Unknown',
        avatar_url: user.image ?? null,
      }, guilds);

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
```

- [ ] **Step 2: Create `dashboard/src/app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/auth.ts dashboard/src/app/api/auth/\[...nextauth\]/route.ts
git commit -m "feat(dashboard): configure Auth.js v5 with Discord provider and guild sync"
```

---

## Task 6: Auth Middleware

**Files:**
- Create: `dashboard/src/middleware.ts`

---

- [ ] **Step 1: Create `dashboard/src/middleware.ts`**

```ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/middleware.ts
git commit -m "feat(dashboard): add auth middleware to protect dashboard routes"
```

---

## Task 7: DB Query Functions

**Files:**
- Create: `dashboard/src/lib/queries.ts`
- Create: `dashboard/src/tests/unit/queries.test.ts`

**TDD for all query functions.**

---

- [ ] **Step 1: Write failing tests for server list query**

Create `dashboard/src/tests/unit/queries.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createMockDb } from '../helpers/mockDb';
import { getUserServers } from '@/lib/queries';

describe('getUserServers', () => {
  it('returns servers where bot is present (inner join with server_settings)', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({
      rows: [
        { server_id: 's1', is_admin: true, active_model: 'gemini-2.5-flash' },
        { server_id: 's2', is_admin: false, active_model: 'gemini-2.0-pro' },
      ],
      rowCount: 2,
    });

    const result = await getUserServers(db, 'user-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ server_id: 's1', is_admin: true, active_model: 'gemini-2.5-flash' });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN server_settings'),
      ['user-1']
    );
  });

  it('returns empty array when user has no servers with bot', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await getUserServers(db, 'user-1');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd dashboard && npx vitest run src/tests/unit/queries.test.ts
```

- [ ] **Step 3: Write failing tests for server settings and lore queries**

Append to `dashboard/src/tests/unit/queries.test.ts`:

```ts
import { getServerSettings, updateServerModel, getServerLore, updateServerLore } from '@/lib/queries';

describe('getServerSettings', () => {
  it('returns server settings row', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({
      rows: [{ server_id: 's1', active_model: 'gemini-2.5-flash', is_active: true }],
      rowCount: 1,
    });

    const result = await getServerSettings(db, 's1');
    expect(result).toEqual({ server_id: 's1', active_model: 'gemini-2.5-flash', is_active: true });
  });

  it('returns null when server not found', async () => {
    const db = createMockDb();
    const result = await getServerSettings(db, 's1');
    expect(result).toBeNull();
  });
});

describe('updateServerModel', () => {
  it('updates active_model for server', async () => {
    const db = createMockDb();
    await updateServerModel(db, 's1', 'gemini-2.0-pro');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE server_settings'),
      ['gemini-2.0-pro', 's1']
    );
  });
});

describe('getServerLore', () => {
  it('returns lore text', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ server_lore: 'Be nice.' }], rowCount: 1 });

    const result = await getServerLore(db, 's1');
    expect(result).toBe('Be nice.');
  });

  it('returns null when no lore set', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ server_lore: null }], rowCount: 1 });

    const result = await getServerLore(db, 's1');
    expect(result).toBeNull();
  });
});

describe('updateServerLore', () => {
  it('updates server_lore column', async () => {
    const db = createMockDb();
    await updateServerLore(db, 's1', 'New lore text');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE server_settings'),
      ['New lore text', 's1']
    );
  });
});
```

- [ ] **Step 4: Write failing tests for channel history query**

Append to `dashboard/src/tests/unit/queries.test.ts`:

```ts
import { getServerChannels, getChannelHistory } from '@/lib/queries';

describe('getServerChannels', () => {
  it('returns channel IDs belonging to a server', async () => {
    const mockRedis = { smembers: vi.fn().mockResolvedValue(['c1', 'c2', 'c3']) };
    const db = createMockDb();
    // channel:c1:server => s1, channel:c2:server => s1, channel:c3:server => s2
    const mockRedisGet = vi.fn()
      .mockResolvedValueOnce('s1')
      .mockResolvedValueOnce('s1')
      .mockResolvedValueOnce('s2');

    const result = await getServerChannels({ smembers: mockRedis.smembers, get: mockRedisGet }, 's1');
    expect(result).toEqual(['c1', 'c2']);
  });
});

describe('getChannelHistory', () => {
  it('returns messages from Redis list', async () => {
    const mockRedis = {
      lrange: vi.fn().mockResolvedValue(['[User: Alice]: hello', '[User: Bob]: hi']),
    };

    const result = await getChannelHistory(mockRedis, 'c1', 0, 50);
    expect(result).toEqual(['[User: Alice]: hello', '[User: Bob]: hi']);
    expect(mockRedis.lrange).toHaveBeenCalledWith('channel:c1:history', 0, 49);
  });
});
```

Add the missing `vi` import at the top of the file:

```ts
import { describe, it, expect, vi } from 'vitest';
```

- [ ] **Step 5: Run to confirm all failures**

```bash
cd dashboard && npx vitest run src/tests/unit/queries.test.ts
```

- [ ] **Step 6: Implement all query functions in `dashboard/src/lib/queries.ts`**

```ts
interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
}

interface RedisReader {
  smembers: (key: string) => Promise<string[]>;
  get: (key: string) => Promise<string | null>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
}

// --- Server list ---

export async function getUserServers(
  db: DbClient,
  userId: string
): Promise<{ server_id: string; is_admin: boolean; active_model: string }[]> {
  const result = await db.query(
    `SELECT us.server_id, us.is_admin, ss.active_model
     FROM user_servers us
     INNER JOIN server_settings ss ON us.server_id = ss.server_id
     WHERE us.user_id = $1
     ORDER BY us.server_id`,
    [userId]
  );
  return result.rows as { server_id: string; is_admin: boolean; active_model: string }[];
}

// --- Server settings ---

export async function getServerSettings(db: DbClient, serverId: string) {
  const result = await db.query(
    'SELECT server_id, active_model, is_active FROM server_settings WHERE server_id = $1',
    [serverId]
  );
  return (result.rows[0] as { server_id: string; active_model: string; is_active: boolean }) ?? null;
}

export async function updateServerModel(db: DbClient, serverId: string, model: string): Promise<void> {
  await db.query('UPDATE server_settings SET active_model = $1 WHERE server_id = $2', [model, serverId]);
}

// --- Lore ---

export async function getServerLore(db: DbClient, serverId: string): Promise<string | null> {
  const result = await db.query(
    'SELECT server_lore FROM server_settings WHERE server_id = $1',
    [serverId]
  );
  return (result.rows[0] as { server_lore: string | null })?.server_lore ?? null;
}

export async function updateServerLore(db: DbClient, serverId: string, lore: string): Promise<void> {
  await db.query('UPDATE server_settings SET server_lore = $1 WHERE server_id = $2', [lore, serverId]);
}

// --- Channel history ---

export async function getServerChannels(
  redis: Pick<RedisReader, 'smembers' | 'get'>,
  serverId: string
): Promise<string[]> {
  const allChannels = await redis.smembers('active_channels');
  const matched: string[] = [];

  for (const channelId of allChannels) {
    const channelServer = await redis.get(`channel:${channelId}:server`);
    if (channelServer === serverId) {
      matched.push(channelId);
    }
  }

  return matched;
}

export async function getChannelHistory(
  redis: Pick<RedisReader, 'lrange'>,
  channelId: string,
  offset: number,
  limit: number
): Promise<string[]> {
  return redis.lrange(`channel:${channelId}:history`, offset, offset + limit - 1);
}
```

- [ ] **Step 7: Run all query tests**

```bash
cd dashboard && npx vitest run src/tests/unit/queries.test.ts
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/lib/queries.ts dashboard/src/tests/unit/queries.test.ts
git commit -m "feat(dashboard): add DB and Redis query functions with tests"
```

---

## Task 8: Dashboard Layout and Server List Page

**Files:**
- Create: `dashboard/src/app/dashboard/layout.tsx`
- Create: `dashboard/src/app/dashboard/page.tsx`

**Prerequisite:** Tasks 5, 7 (auth, queries).

---

- [ ] **Step 1: Create `dashboard/src/app/dashboard/layout.tsx`**

```tsx
import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/');

  return (
    <div className="min-h-screen">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <a href="/dashboard" className="text-xl font-bold">Contexta</a>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{session.user.name}</span>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}>
            <button type="submit" className="text-sm text-gray-400 hover:text-white transition">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create `dashboard/src/app/dashboard/page.tsx`**

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserServers } from '@/lib/queries';
import { pool } from '@/lib/db';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const servers = await getUserServers(pool, session.user.id);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Your Servers</h1>
      {servers.length === 0 ? (
        <p className="text-gray-400">
          No servers found. Make sure Contexta is added to your Discord server.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <Link
              key={server.server_id}
              href={`/dashboard/${server.server_id}`}
              className="block rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition"
            >
              <h2 className="font-semibold">{server.server_id}</h2>
              <p className="text-sm text-gray-400 mt-1">
                {server.is_admin ? 'Admin' : 'Member'} &middot; {server.active_model}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/dashboard/layout.tsx dashboard/src/app/dashboard/page.tsx
git commit -m "feat(dashboard): add dashboard layout with nav and server list page"
```

---

## Task 9: Server Detail, Settings, and Lore Pages

**Files:**
- Create: `dashboard/src/app/dashboard/[serverId]/layout.tsx`
- Create: `dashboard/src/app/dashboard/[serverId]/page.tsx`
- Create: `dashboard/src/app/dashboard/[serverId]/settings/page.tsx`
- Create: `dashboard/src/app/dashboard/[serverId]/lore/page.tsx`

**Prerequisite:** Tasks 7, 8 (queries, dashboard layout).

---

- [ ] **Step 1: Create server-scoped layout with membership check**

`dashboard/src/app/dashboard/[serverId]/layout.tsx`:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkServerMembership } from '@/lib/auth-helpers';
import { pool } from '@/lib/db';

export default async function ServerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const membership = await checkServerMembership(pool, session.user.id, serverId);

  if (!membership) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-red-400">Access Denied</h1>
        <p className="text-gray-400 mt-2">You are not a member of this server.</p>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Create server overview page**

`dashboard/src/app/dashboard/[serverId]/page.tsx`:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkServerMembership } from '@/lib/auth-helpers';
import { pool } from '@/lib/db';
import Link from 'next/link';

export default async function ServerOverviewPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const membership = await checkServerMembership(pool, session.user.id, serverId);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Server: {serverId}</h1>
      <div className="flex flex-col gap-3">
        {membership?.is_admin && (
          <>
            <Link
              href={`/dashboard/${serverId}/settings`}
              className="rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition"
            >
              Settings — Configure bot model and cache
            </Link>
            <Link
              href={`/dashboard/${serverId}/lore`}
              className="rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition"
            >
              Lore — Edit server rules and themes
            </Link>
          </>
        )}
        <Link
          href={`/dashboard/${serverId}/history`}
          className="rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition"
        >
          History — Browse conversation history
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create settings page (admin only)**

`dashboard/src/app/dashboard/[serverId]/settings/page.tsx`:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerSettings, updateServerModel } from '@/lib/queries';
import { pool } from '@/lib/db';

const AVAILABLE_MODELS = ['gemini-2.5-flash', 'gemini-2.0-pro'];

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const isAdmin = await checkServerAdmin(pool, session.user.id, serverId);
  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-red-400">Access Denied</h1>
        <p className="text-gray-400 mt-2">Only server administrators can access settings.</p>
      </div>
    );
  }

  const settings = await getServerSettings(pool, serverId);

  async function handleUpdateModel(formData: FormData) {
    'use server';
    const model = formData.get('model') as string;
    if (AVAILABLE_MODELS.includes(model)) {
      await updateServerModel(pool, serverId, model);
    }
    redirect(`/dashboard/${serverId}/settings`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <form action={handleUpdateModel} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-gray-300 mb-1">
            Active Model
          </label>
          <select
            name="model"
            id="model"
            defaultValue={settings?.active_model ?? 'gemini-2.5-flash'}
            className="w-full rounded-lg bg-gray-900 border border-gray-700 p-2 text-white"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-500 transition"
        >
          Save
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Create lore page (admin only)**

`dashboard/src/app/dashboard/[serverId]/lore/page.tsx`:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerLore, updateServerLore } from '@/lib/queries';
import { pool } from '@/lib/db';

export default async function LorePage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const isAdmin = await checkServerAdmin(pool, session.user.id, serverId);
  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-red-400">Access Denied</h1>
        <p className="text-gray-400 mt-2">Only server administrators can edit lore.</p>
      </div>
    );
  }

  const lore = await getServerLore(pool, serverId);

  async function handleUpdateLore(formData: FormData) {
    'use server';
    const text = formData.get('lore') as string;
    await updateServerLore(pool, serverId, text);
    redirect(`/dashboard/${serverId}/lore`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Server Lore</h1>
      <form action={handleUpdateLore} className="space-y-4 max-w-2xl">
        <textarea
          name="lore"
          rows={12}
          defaultValue={lore ?? ''}
          placeholder="Enter your server's lore, rules, and themes..."
          className="w-full rounded-lg bg-gray-900 border border-gray-700 p-3 text-white resize-y"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-500 transition"
        >
          Save Lore
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/dashboard/\[serverId\]/
git commit -m "feat(dashboard): add server overview, settings, and lore pages with admin gating"
```

---

## Task 10: History Page

**Files:**
- Create: `dashboard/src/app/dashboard/[serverId]/history/page.tsx`

**Prerequisite:** Task 7 (queries).

---

- [ ] **Step 1: Create history page**

`dashboard/src/app/dashboard/[serverId]/history/page.tsx`:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getServerChannels, getChannelHistory } from '@/lib/queries';
import { redis } from '@/lib/redis';

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ serverId: string }>;
  searchParams: Promise<{ channel?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const { channel, page } = await searchParams;

  const channels = await getServerChannels(redis, serverId);
  const selectedChannel = channel ?? channels[0] ?? null;
  const currentPage = Math.max(1, parseInt(page ?? '1', 10));
  const pageSize = 50;

  let messages: string[] = [];
  if (selectedChannel) {
    messages = await getChannelHistory(redis, selectedChannel, (currentPage - 1) * pageSize, pageSize);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Conversation History</h1>

      {channels.length === 0 ? (
        <p className="text-gray-400">No conversation history found for this server.</p>
      ) : (
        <div className="flex gap-6">
          <nav className="w-48 shrink-0">
            <h2 className="text-sm font-medium text-gray-400 mb-2">Channels</h2>
            <ul className="space-y-1">
              {channels.map((ch) => (
                <li key={ch}>
                  <a
                    href={`?channel=${ch}&page=1`}
                    className={`block rounded px-3 py-1.5 text-sm transition ${
                      ch === selectedChannel
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-900'
                    }`}
                  >
                    #{ch}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex-1 min-w-0">
            {messages.length === 0 ? (
              <p className="text-gray-400">No messages in this channel.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {messages.map((msg, i) => (
                    <li key={i} className="rounded bg-gray-900 px-3 py-2 text-sm font-mono break-all">
                      {msg}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  {currentPage > 1 && (
                    <a
                      href={`?channel=${selectedChannel}&page=${currentPage - 1}`}
                      className="rounded bg-gray-800 px-3 py-1 text-sm hover:bg-gray-700 transition"
                    >
                      Previous
                    </a>
                  )}
                  {messages.length === pageSize && (
                    <a
                      href={`?channel=${selectedChannel}&page=${currentPage + 1}`}
                      className="rounded bg-gray-800 px-3 py-1 text-sm hover:bg-gray-700 transition"
                    >
                      Next
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/app/dashboard/\[serverId\]/history/
git commit -m "feat(dashboard): add channel history browser with pagination"
```

---

## Task 11: Final Verification

---

- [ ] **Step 1: Run all dashboard tests**

```bash
cd dashboard && npx vitest run
```

Expected: all PASS.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd dashboard && npx next build
```

Expected: build succeeds.

- [ ] **Step 3: Verify bot tests still pass**

```bash
cd /Users/iser/workspace/contexta-bot && npm test
```

Expected: 164/164 pass — no bot code was modified.

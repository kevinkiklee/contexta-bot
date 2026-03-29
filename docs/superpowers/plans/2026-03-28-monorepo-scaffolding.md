# Monorepo Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Contexta Bot repository into a pnpm monorepo with 4 apps and 3 shared packages, preserving all existing functionality and tests.

**Architecture:** pnpm workspaces with `apps/` (bot, backend, dashboard, website) and `packages/` (db, shared, ui). This is Sub-spec 1 — scaffolding and code relocation only. The bot and dashboard keep their current functionality; backend and website are empty scaffolds. Business logic migration (bot → backend) and dashboard API client rewiring happen in Sub-spec 2.

**Tech Stack:** pnpm workspaces, TypeScript, Drizzle ORM, Vitest, Next.js 15, Hono (scaffold only)

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `pnpm-workspace.yaml` | Defines workspace packages |
| `tsconfig.base.json` | Shared TypeScript config all packages extend |
| `packages/db/package.json` | @contexta/db package config |
| `packages/db/tsconfig.json` | DB package TS config |
| `packages/db/drizzle.config.ts` | Drizzle Kit config for migrations |
| `packages/db/src/schema.ts` | Drizzle table definitions (converted from schema.sql) |
| `packages/db/src/client.ts` | DB connection pool with SSL detection |
| `packages/db/src/index.ts` | Re-exports |
| `packages/shared/package.json` | @contexta/shared package config |
| `packages/shared/tsconfig.json` | Shared package TS config |
| `packages/shared/src/types.ts` | Cross-app interfaces |
| `packages/shared/src/constants.ts` | Model names, limits, defaults |
| `packages/shared/src/validation.ts` | Zod schemas for API payloads |
| `packages/shared/src/index.ts` | Re-exports |
| `packages/ui/package.json` | @contexta/ui package config |
| `packages/ui/tsconfig.json` | UI package TS config |
| `packages/ui/src/index.ts` | Re-exports |
| `apps/backend/package.json` | @contexta/backend scaffold |
| `apps/backend/tsconfig.json` | Backend TS config |
| `apps/backend/src/index.ts` | Minimal Hono health endpoint |
| `apps/website/package.json` | @contexta/website scaffold |
| `apps/website/tsconfig.json` | Website TS config |
| `apps/website/next.config.ts` | Next.js config |
| `apps/website/src/app/layout.tsx` | Root layout |
| `apps/website/src/app/page.tsx` | Placeholder landing page |

### Moved (git mv)

| From | To |
|------|----|
| `src/` | `apps/bot/src/` |
| `vitest.config.ts` | `apps/bot/vitest.config.ts` |
| `vitest.integration.config.ts` | `apps/bot/vitest.integration.config.ts` |
| `dashboard/` | `apps/dashboard/` |

### Modified

| File | Changes |
|------|---------|
| Root `package.json` | Becomes workspace root (new name, scripts, devDeps) |
| Root `tsconfig.json` | Becomes `apps/bot/tsconfig.json` (moved with src/) |
| `.gitignore` | Add pnpm patterns |
| `CLAUDE.md` | Update all paths and commands |

---

### Task 1: Initialize pnpm Workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Update .gitignore**

Replace `.gitignore` with:

```
node_modules/
dist/
.next/
.env
.env.local
.env*.local
.DS_Store
.claude/
.claire/
.clone/
*.tsbuildinfo
```

- [ ] **Step 4: Create the directory skeleton**

```bash
mkdir -p apps/bot apps/backend/src apps/dashboard apps/website/src/app
mkdir -p packages/db/src packages/shared/src packages/ui/src
```

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml tsconfig.base.json .gitignore
git commit -m "chore: initialize pnpm workspace skeleton"
```

---

### Task 2: Move Bot to apps/bot/

**Files:**
- Move: `src/` → `apps/bot/src/`
- Move: `vitest.config.ts` → `apps/bot/vitest.config.ts`
- Move: `vitest.integration.config.ts` → `apps/bot/vitest.integration.config.ts`
- Move: `tsconfig.json` → `apps/bot/tsconfig.json`
- Create: `apps/bot/package.json`

This is the most critical task — all existing bot code and tests must keep working.

- [ ] **Step 1: Move bot source and configs**

```bash
git mv src/ apps/bot/src/
git mv vitest.config.ts apps/bot/vitest.config.ts
git mv vitest.integration.config.ts apps/bot/vitest.integration.config.ts
git mv tsconfig.json apps/bot/tsconfig.json
```

- [ ] **Step 2: Create apps/bot/package.json**

```json
{
  "name": "@contexta/bot",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.80.0",
    "@google/genai": "latest",
    "discord.js": "^14.14.1",
    "dotenv": "^16.4.5",
    "openai": "^6.33.0",
    "pg": "^8.11.3",
    "redis": "^4.6.13"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "@types/pg": "^8.20.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "vitest": "^4.1.1"
  }
}
```

- [ ] **Step 3: Update apps/bot/tsconfig.json to extend base**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Update apps/bot/vitest.config.ts**

The exclude paths need updating since the file moved:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    exclude: ['dist/**', 'node_modules/**', '**/*.integration.test.ts'],
  },
});
```

- [ ] **Step 5: Update apps/bot/vitest.integration.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/integration/**/*.integration.test.ts'],
    globalSetup: ['src/tests/integration/globalSetup.ts'],
  },
});
```

- [ ] **Step 6: Update root package.json to workspace root**

Replace root `package.json` with:

```json
{
  "name": "contexta",
  "private": true,
  "scripts": {
    "dev:bot": "pnpm --filter @contexta/bot dev",
    "dev:backend": "pnpm --filter @contexta/backend dev",
    "dev:dashboard": "pnpm --filter @contexta/dashboard dev",
    "dev:website": "pnpm --filter @contexta/website dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:bot": "pnpm --filter @contexta/bot test",
    "test:dashboard": "pnpm --filter @contexta/dashboard test"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 7: Install dependencies and verify bot tests**

```bash
cd apps/bot && pnpm install
pnpm test
```

Expected: All 202 bot tests pass.

- [ ] **Step 8: Verify bot builds**

```bash
cd apps/bot && pnpm build
```

Expected: TypeScript compiles with no errors, `dist/` is created.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: move bot to apps/bot/"
```

---

### Task 3: Move Dashboard to apps/dashboard/

**Files:**
- Move: `dashboard/` → `apps/dashboard/`

- [ ] **Step 1: Move the dashboard**

```bash
git mv dashboard/ apps/dashboard/
```

- [ ] **Step 2: Update apps/dashboard/package.json name**

Change the `"name"` field from `"contexta-dashboard"` to `"@contexta/dashboard"`.

- [ ] **Step 3: Install dashboard dependencies**

```bash
cd apps/dashboard && pnpm install
```

- [ ] **Step 4: Verify dashboard builds**

```bash
cd apps/dashboard && pnpm build
```

Expected: Next.js builds successfully.

- [ ] **Step 5: Verify dashboard tests**

```bash
cd apps/dashboard && pnpm test
```

Expected: All existing dashboard tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move dashboard to apps/dashboard/"
```

---

### Task 4: Create packages/shared

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/validation.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create packages/shared/package.json**

```json
{
  "name": "@contexta/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.1.1"
  }
}
```

- [ ] **Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create packages/shared/src/types.ts**

```typescript
/** Server configuration stored in server_settings table */
export interface ServerSettings {
  serverId: string;
  activeModel: string;
  serverLore: string | null;
  contextCacheId: string | null;
  cacheExpiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

/** Global user profile from global_users table */
export interface GlobalUser {
  userId: string;
  globalName: string;
  createdAt: Date;
  lastInteraction: Date | null;
}

/** Per-server user context from server_members table */
export interface ServerMember {
  serverId: string;
  userId: string;
  inferredContext: string | null;
  preferences: Record<string, unknown>;
  interactionCount: number;
}

/** Semantic memory vector from channel_memory_vectors table */
export interface ChannelMemoryVector {
  id: string;
  serverId: string;
  channelId: string;
  summaryText: string;
  embedding: number[];
  timeStart: Date;
  timeEnd: Date;
  createdAt: Date;
}

/** Dashboard user from users table */
export interface DashboardUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Dashboard user-server link from user_servers table */
export interface UserServer {
  userId: string;
  serverId: string;
  isAdmin: boolean;
}

/** Background embedding worker stats */
export interface WorkerStats {
  status: string;
  reason?: string;
  channelsProcessed: number;
  embeddingsCreated: number;
  errors: string[];
}

/** Standard API response envelope */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

- [ ] **Step 4: Create packages/shared/src/constants.ts**

```typescript
/** All supported LLM model identifiers */
export const SUPPORTED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

/** Default model for new servers */
export const DEFAULT_MODEL: SupportedModel = 'gemini-2.5-flash';

/** pgvector embedding dimensions (Gemini text-embedding-004) */
export const EMBEDDING_DIMS = 768;

/** Discord message character limit */
export const MAX_DISCORD_MESSAGE_LENGTH = 2000;

/** Rate limiter defaults */
export const RATE_LIMIT_MAX_REQUESTS = 2;
export const RATE_LIMIT_WINDOW_MS = 10_000;

/** Redis channel history rolling window size */
export const CHANNEL_HISTORY_LIMIT = 50;

/** Minimum messages before background worker processes a channel */
export const WORKER_MIN_MESSAGES = 10;

/** Discord permission bits */
export const DISCORD_PERMISSIONS = {
  ADMINISTRATOR: 0x8n,
  MANAGE_GUILD: 0x20n,
} as const;
```

- [ ] **Step 5: Create packages/shared/src/validation.ts**

```typescript
import { z } from 'zod';
import { SUPPORTED_MODELS } from './constants.js';

export const SwitchModelSchema = z.object({
  model: z.enum(SUPPORTED_MODELS),
});

export const UpdateLoreSchema = z.object({
  text: z.string().min(1).max(10_000),
});

export const AskQuerySchema = z.object({
  serverId: z.string().min(1),
  query: z.string().min(1).max(4_000),
});

export const SummarizeSchema = z.object({
  serverId: z.string().min(1),
  channelId: z.string().min(1),
  messages: z.array(z.string()),
});

export const EmbeddingRequestSchema = z.object({
  serverId: z.string().min(1),
  channelId: z.string().min(1),
  text: z.string().min(1),
});
```

- [ ] **Step 6: Create packages/shared/src/index.ts**

```typescript
export * from './types.js';
export * from './constants.js';
export * from './validation.js';
```

- [ ] **Step 7: Install and verify**

```bash
cd packages/shared && pnpm install
pnpm build
```

Expected: Compiles with no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/
git commit -m "feat: create @contexta/shared package with types, constants, and validation"
```

---

### Task 5: Create packages/db with Drizzle Schema

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create packages/db/package.json**

```json
{
  "name": "@contexta/db",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.0",
    "pg": "^8.11.3",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/pg": "^8.20.0",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create packages/db/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create packages/db/drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export default defineConfig({
  schema: './src/schema.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Create packages/db/src/schema.ts**

Convert the existing `src/db/schema.sql` into Drizzle table definitions:

```typescript
import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  uuid,
  jsonb,
  index,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';

/** Custom pgvector column type */
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return `vector(768)`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const serverSettings = pgTable('server_settings', {
  serverId: varchar('server_id', { length: 255 }).primaryKey(),
  activeModel: varchar('active_model', { length: 50 }).default('gemini-2.5-flash'),
  serverLore: text('server_lore'),
  contextCacheId: varchar('context_cache_id', { length: 255 }),
  cacheExpiresAt: timestamp('cache_expires_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const globalUsers = pgTable('global_users', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  globalName: varchar('global_name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastInteraction: timestamp('last_interaction'),
});

export const serverMembers = pgTable('server_members', (t) => ({
  serverId: varchar('server_id', { length: 255 }).references(() => serverSettings.serverId),
  userId: varchar('user_id', { length: 255 }).references(() => globalUsers.userId),
  inferredContext: text('inferred_context'),
  preferences: jsonb('preferences').default('{}'),
  interactionCount: integer('interaction_count').default(0),
}), (table) => [
  primaryKey({ columns: [table.serverId, table.userId] }),
]);

export const channelMemoryVectors = pgTable('channel_memory_vectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  channelId: varchar('channel_id', { length: 255 }).notNull(),
  summaryText: text('summary_text').notNull(),
  embedding: vector('embedding').notNull(),
  timeStart: timestamp('time_start').notNull(),
  timeEnd: timestamp('time_end').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('channel_memory_meta_idx').on(table.serverId, table.channelId),
]);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userServers = pgTable('user_servers', (t) => ({
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  serverId: text('server_id').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
}), (table) => [
  primaryKey({ columns: [table.userId, table.serverId] }),
  index('idx_user_servers_server').on(table.serverId),
]);
```

- [ ] **Step 5: Create packages/db/src/client.ts**

Port the SSL detection logic from the bot's `src/db/index.ts`:

```typescript
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

/**
 * Parse DATABASE_URL and determine SSL config.
 * Strips `sslmode` from query string before passing to pg.
 */
export function parseDbConfig(
  rawUrl: string,
  disableSslEnv?: string,
): {
  connectionString: string;
  ssl: false | { rejectUnauthorized: true };
} {
  const sslmodeMatch = rawUrl.match(/[?&]sslmode=([^&]+)/);
  const sslmode = sslmodeMatch?.[1];
  const connectionString = rawUrl.split('?')[0];
  const isLocal =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const disableSSL =
    isLocal || sslmode === 'disable' || disableSslEnv === 'true';
  return {
    connectionString,
    ssl: disableSSL ? false : { rejectUnauthorized: true },
  };
}

const config = parseDbConfig(
  process.env.DATABASE_URL || '',
  process.env.DISABLE_DB_SSL,
);

export const pool = new Pool({
  connectionString: config.connectionString,
  ssl: config.ssl,
});

/** Drizzle ORM client with full schema */
export const db = drizzle(pool, { schema });

/** Raw query helper for cases where Drizzle doesn't fit (e.g., pgvector similarity search) */
export async function rawQuery(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[DB] Executed query - Duration: ${duration}ms, Rows: ${res.rowCount}`);
  return res;
}
```

- [ ] **Step 6: Create packages/db/src/index.ts**

```typescript
export { db, pool, rawQuery, parseDbConfig } from './client.js';
export * from './schema.js';
```

- [ ] **Step 7: Install and verify**

```bash
cd packages/db && pnpm install
pnpm build
```

Expected: Compiles with no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/db/
git commit -m "feat: create @contexta/db package with Drizzle schema and client"
```

---

### Task 6: Create packages/ui (Minimal)

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`

- [ ] **Step 1: Create packages/ui/package.json**

```json
{
  "name": "@contexta/ui",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "react": "^19.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create packages/ui/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "lib": ["dom", "dom.iterable", "esnext"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create packages/ui/src/index.ts**

```typescript
// @contexta/ui — shared React component library
// Components will be added as patterns emerge between dashboard and website.
export {};
```

- [ ] **Step 4: Install and verify**

```bash
cd packages/ui && pnpm install
pnpm build
```

Expected: Compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/
git commit -m "feat: create @contexta/ui package (minimal scaffold)"
```

---

### Task 7: Scaffold apps/backend/

**Files:**
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/src/index.ts`

- [ ] **Step 1: Create apps/backend/package.json**

```json
{
  "name": "@contexta/backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "test": "echo 'No tests yet' && exit 0"
  },
  "dependencies": {
    "hono": "^4.7.0",
    "@hono/node-server": "^1.14.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "vitest": "^4.1.1"
  }
}
```

- [ ] **Step 2: Create apps/backend/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create apps/backend/src/index.ts**

Minimal Hono server with health endpoint:

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';

dotenv.config();

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = parseInt(process.env.PORT || '4000', 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`[Backend] Server listening on port ${port}`);
});
```

- [ ] **Step 4: Install and verify**

```bash
cd apps/backend && pnpm install
pnpm build
```

Expected: Compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/
git commit -m "feat: scaffold @contexta/backend with Hono health endpoint"
```

---

### Task 8: Scaffold apps/website/

**Files:**
- Create: `apps/website/package.json`
- Create: `apps/website/tsconfig.json`
- Create: `apps/website/next.config.ts`
- Create: `apps/website/src/app/layout.tsx`
- Create: `apps/website/src/app/page.tsx`
- Create: `apps/website/src/app/globals.css`

- [ ] **Step 1: Create apps/website/package.json**

```json
{
  "name": "@contexta/website",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "test": "echo 'No tests yet' && exit 0"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "typescript": "^5.9.0",
    "tailwindcss": "^4.1.0",
    "@tailwindcss/postcss": "^4.1.0"
  }
}
```

- [ ] **Step 2: Create apps/website/tsconfig.json**

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

- [ ] **Step 3: Create apps/website/next.config.ts**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
};

export default nextConfig;
```

- [ ] **Step 4: Create apps/website/src/app/globals.css**

```css
@import "tailwindcss";
```

- [ ] **Step 5: Create apps/website/src/app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contexta — AI Co-Host for Discord',
  description: 'An intelligent AI agent that remembers your conversations and provides contextual assistance in Discord servers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Create apps/website/src/app/page.tsx**

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>Contexta</h1>
      <p>AI Co-Host for Discord — coming soon.</p>
    </main>
  );
}
```

- [ ] **Step 7: Create apps/website/postcss.config.mjs**

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

- [ ] **Step 8: Install and verify**

```bash
cd apps/website && pnpm install
pnpm build
```

Expected: Next.js builds with static export.

- [ ] **Step 9: Commit**

```bash
git add apps/website/
git commit -m "feat: scaffold @contexta/website with Next.js placeholder"
```

---

### Task 9: Root Integration and Verification

**Files:**
- Modify: Root `package.json` (ensure workspace scripts work)
- Modify: `.env.example`
- Modify: `CLAUDE.md`
- Delete: stale root configs (`package-lock.json`, root `node_modules/`)

- [ ] **Step 1: Clean up stale root files**

Remove the old npm lock file and node_modules (pnpm uses its own):

```bash
rm -f package-lock.json
rm -rf node_modules/
```

- [ ] **Step 2: Install all workspace dependencies from root**

```bash
pnpm install
```

Expected: pnpm installs deps for all workspace packages.

- [ ] **Step 3: Update .env.example**

Replace root `.env.example` with comprehensive list:

```
# ============================
# Contexta Monorepo — Environment Variables
# Copy to .env and fill in values.
# Each app reads from this root .env via dotenv.
# ============================

# --- Shared Infrastructure ---
DATABASE_URL=postgresql://localhost:5432/contexta_bot
REDIS_URL=redis://localhost:6379

# --- Bot (apps/bot) ---
DISCORD_TOKEN=
DEV_GUILD_ID=
BOT_API_KEY=
BACKEND_URL=http://localhost:4000

# --- Backend (apps/backend) ---
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
CRON_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PORT=4000

# --- Dashboard (apps/dashboard) ---
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# --- Database ---
DISABLE_DB_SSL=true
```

- [ ] **Step 4: Update CLAUDE.md**

Replace CLAUDE.md with updated paths and commands reflecting the monorepo structure. Key sections:
- Update all `src/` references to `apps/bot/src/`
- Update `dashboard/` references to `apps/dashboard/`
- Add sections for backend, website, and shared packages
- Update build/test commands to use pnpm workspace syntax

- [ ] **Step 5: Verify bot tests from root**

```bash
pnpm test:bot
```

Expected: All 202 bot tests pass.

- [ ] **Step 6: Verify dashboard tests from root**

```bash
pnpm test:dashboard
```

Expected: All dashboard tests pass.

- [ ] **Step 7: Verify full build from root**

```bash
pnpm build
```

Expected: All packages and apps build successfully.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: finalize monorepo setup with root integration and updated docs"
```

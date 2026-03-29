# Brand Color Scheme & Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a brand color scheme with togglable light/dark theme across dashboard and website.

**Architecture:** CSS custom properties define semantic color tokens, scoped to `:root` (light) and `.dark` (dark). Tailwind v4's `@theme` directive registers them as utilities (`bg-primary`, `text-text`, etc.). A `ThemeToggle` client component in `packages/ui` persists user preference to `localStorage` and falls back to `prefers-color-scheme`.

**Tech Stack:** Tailwind CSS v4, Next.js 15 App Router, React 19, CSS custom properties

---

### Task 1: Theme CSS tokens in dashboard globals.css

**Files:**
- Modify: `applications/dashboard/src/app/globals.css`
- Modify: `applications/dashboard/tailwind.config.ts`

- [ ] **Step 1: Replace globals.css with theme token definitions**

Replace the entire contents of `applications/dashboard/src/app/globals.css` with:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-accent: var(--accent);
  --color-bg: var(--bg);
  --color-bg-raised: var(--bg-raised);
  --color-bg-overlay: var(--bg-overlay);
  --color-border: var(--border-color);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-text-subtle: var(--text-subtle);
  --color-error: var(--error);
}

:root {
  --primary: #3B82F6;
  --primary-hover: #2563EB;
  --accent: #0891B2;
  --bg: #FFFFFF;
  --bg-raised: #F8FAFC;
  --bg-overlay: #F1F5F9;
  --border-color: #E2E8F0;
  --text: #0F172A;
  --text-muted: #64748B;
  --text-subtle: #334155;
  --error: #DC2626;
}

.dark {
  --primary: #3B82F6;
  --primary-hover: #60A5FA;
  --accent: #06B6D4;
  --bg: #0F172A;
  --bg-raised: #1E293B;
  --bg-overlay: #334155;
  --border-color: #334155;
  --text: #F8FAFC;
  --text-muted: #94A3B8;
  --text-subtle: #CBD5E1;
  --error: #F87171;
}
```

- [ ] **Step 2: Update tailwind.config.ts to enable dark mode class strategy**

Replace the entire contents of `applications/dashboard/tailwind.config.ts` with:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  darkMode: 'class',
};

export default config;
```

- [ ] **Step 3: Verify the CSS is valid**

Run: `pnpm --filter @contexta/dashboard build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add applications/dashboard/src/app/globals.css applications/dashboard/tailwind.config.ts
git commit -m "feat(dashboard): add semantic color tokens and dark mode support"
```

---

### Task 2: Theme CSS tokens in website globals.css

**Files:**
- Modify: `applications/website/src/app/globals.css`

- [ ] **Step 1: Replace globals.css with the same theme token definitions**

Replace the entire contents of `applications/website/src/app/globals.css` with:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-accent: var(--accent);
  --color-bg: var(--bg);
  --color-bg-raised: var(--bg-raised);
  --color-bg-overlay: var(--bg-overlay);
  --color-border: var(--border-color);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-text-subtle: var(--text-subtle);
  --color-error: var(--error);
}

:root {
  --primary: #3B82F6;
  --primary-hover: #2563EB;
  --accent: #0891B2;
  --bg: #FFFFFF;
  --bg-raised: #F8FAFC;
  --bg-overlay: #F1F5F9;
  --border-color: #E2E8F0;
  --text: #0F172A;
  --text-muted: #64748B;
  --text-subtle: #334155;
  --error: #DC2626;
}

.dark {
  --primary: #3B82F6;
  --primary-hover: #60A5FA;
  --accent: #06B6D4;
  --bg: #0F172A;
  --bg-raised: #1E293B;
  --bg-overlay: #334155;
  --border-color: #334155;
  --text: #F8FAFC;
  --text-muted: #94A3B8;
  --text-subtle: #CBD5E1;
  --error: #F87171;
}
```

- [ ] **Step 2: Commit**

```bash
git add applications/website/src/app/globals.css
git commit -m "feat(website): add semantic color tokens and dark mode support"
```

---

### Task 3: Theme script and ThemeToggle component

**Files:**
- Create: `packages/ui/src/theme-script.ts`
- Create: `packages/ui/src/ThemeToggle.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Create the theme initialization script**

Create `packages/ui/src/theme-script.ts`:

```ts
/**
 * Inline script that runs before React hydration to prevent theme flash.
 * Embed in layout via: <script dangerouslySetInnerHTML={{ __html: themeScript }} />
 */
export const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;
```

- [ ] **Step 2: Create the ThemeToggle component**

Create `packages/ui/src/ThemeToggle.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function getAppliedTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    const applied = getAppliedTheme(theme);
    document.documentElement.classList.toggle('dark', applied === 'dark');

    if (theme === 'system') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  function cycle() {
    setTheme((prev) => {
      if (prev === 'system') return 'light';
      if (prev === 'light') return 'dark';
      return 'system';
    });
  }

  const label = theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to change.`}
      className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:text-text hover:bg-bg-overlay transition"
    >
      {theme === 'system' && '◐'}
      {theme === 'light' && '☀'}
      {theme === 'dark' && '☾'}
      <span className="ml-1">{label}</span>
    </button>
  );
}
```

- [ ] **Step 3: Update packages/ui/src/index.ts to export the new modules**

Replace the entire contents of `packages/ui/src/index.ts` with:

```ts
export { ThemeToggle } from './ThemeToggle.js';
export { themeScript } from './theme-script.js';
```

- [ ] **Step 4: Verify the package compiles**

Run: `pnpm --filter @contexta/ui build`
Expected: Build succeeds (or no build step needed since the package uses direct TS imports).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/theme-script.ts packages/ui/src/ThemeToggle.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add ThemeToggle component and theme initialization script"
```

---

### Task 4: Wire theme into dashboard layout

**Files:**
- Modify: `applications/dashboard/src/app/layout.tsx`
- Modify: `applications/dashboard/src/app/dashboard/layout.tsx`

- [ ] **Step 1: Update the root layout with theme script and base classes**

Replace the entire contents of `applications/dashboard/src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import { themeScript } from '@contexta/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contexta Dashboard',
  description: 'Manage your Contexta bot servers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg text-text min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Update the dashboard layout with ThemeToggle and migrated classes**

Replace the entire contents of `applications/dashboard/src/app/dashboard/layout.tsx` with:

```tsx
import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@contexta/ui';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/');

  return (
    <div className="min-h-screen">
      <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
        <a href="/dashboard" className="text-xl font-bold">Contexta</a>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <span className="text-text-muted text-sm">{session.user.name}</span>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}>
            <button type="submit" className="text-sm text-text-muted hover:text-text transition">
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

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @contexta/dashboard build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add applications/dashboard/src/app/layout.tsx applications/dashboard/src/app/dashboard/layout.tsx
git commit -m "feat(dashboard): wire theme script and ThemeToggle into layouts"
```

---

### Task 5: Migrate dashboard landing page colors

**Files:**
- Modify: `applications/dashboard/src/app/page.tsx`

- [ ] **Step 1: Replace hardcoded color classes with theme tokens**

Replace the entire contents of `applications/dashboard/src/app/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">Contexta</h1>
      <p className="text-text-muted mb-8">AI co-host for your Discord server</p>
      <a
        href="/api/auth/signin"
        className="rounded-lg bg-primary px-6 py-3 text-white font-medium hover:bg-primary-hover transition"
      >
        Sign in with Discord
      </a>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add applications/dashboard/src/app/page.tsx
git commit -m "feat(dashboard): migrate landing page to theme tokens"
```

---

### Task 6: Migrate dashboard server list page colors

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Replace hardcoded color classes with theme tokens**

Replace the entire contents of `applications/dashboard/src/app/dashboard/page.tsx` with:

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
        <p className="text-text-muted">
          No servers found. Make sure Contexta is added to your Discord server.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <Link
              key={server.server_id}
              href={`/dashboard/${server.server_id}`}
              className="block rounded-lg border border-border p-4 hover:border-accent transition"
            >
              <h2 className="font-semibold">{server.server_name || server.server_id}</h2>
              <p className="text-sm text-text-muted mt-1">
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

- [ ] **Step 2: Commit**

```bash
git add applications/dashboard/src/app/dashboard/page.tsx
git commit -m "feat(dashboard): migrate server list page to theme tokens"
```

---

### Task 7: Migrate server layout and overview page colors

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/layout.tsx`
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/page.tsx`

- [ ] **Step 1: Replace colors in server layout**

Replace the entire contents of `applications/dashboard/src/app/dashboard/[serverId]/layout.tsx` with:

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
        <h1 className="text-xl font-bold text-error">Access Denied</h1>
        <p className="text-text-muted mt-2">You are not a member of this server.</p>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Replace colors in server overview page**

Replace the entire contents of `applications/dashboard/src/app/dashboard/[serverId]/page.tsx` with:

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
              className="rounded-lg border border-border p-4 hover:border-accent transition"
            >
              Settings — Configure bot model and cache
            </Link>
            <Link
              href={`/dashboard/${serverId}/lore`}
              className="rounded-lg border border-border p-4 hover:border-accent transition"
            >
              Lore — Edit server rules and themes
            </Link>
          </>
        )}
        <Link
          href={`/dashboard/${serverId}/history`}
          className="rounded-lg border border-border p-4 hover:border-accent transition"
        >
          History — Browse conversation history
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add applications/dashboard/src/app/dashboard/\[serverId\]/layout.tsx applications/dashboard/src/app/dashboard/\[serverId\]/page.tsx
git commit -m "feat(dashboard): migrate server layout and overview to theme tokens"
```

---

### Task 8: Migrate settings and lore page colors

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/settings/page.tsx`
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/lore/page.tsx`

- [ ] **Step 1: Replace colors in settings page**

Replace the entire contents of `applications/dashboard/src/app/dashboard/[serverId]/settings/page.tsx` with:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerSettings, updateServerModel } from '@/lib/queries';
import { pool } from '@/lib/db';

const AVAILABLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
];

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
        <h1 className="text-xl font-bold text-error">Access Denied</h1>
        <p className="text-text-muted mt-2">Only server administrators can access settings.</p>
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
    revalidatePath(`/dashboard/${serverId}/settings`);
    redirect(`/dashboard/${serverId}/settings`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <form action={handleUpdateModel} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-text-muted mb-1">
            Active Model
          </label>
          <select
            name="model"
            id="model"
            defaultValue={settings?.active_model ?? 'gemini-2.5-flash'}
            className="w-full rounded-lg bg-bg-raised border border-border p-2 text-text"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-white font-medium hover:bg-primary-hover transition"
        >
          Save
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Replace colors in lore page**

Replace the entire contents of `applications/dashboard/src/app/dashboard/[serverId]/lore/page.tsx` with:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
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
        <h1 className="text-xl font-bold text-error">Access Denied</h1>
        <p className="text-text-muted mt-2">Only server administrators can edit lore.</p>
      </div>
    );
  }

  const lore = await getServerLore(pool, serverId);

  async function handleUpdateLore(formData: FormData) {
    'use server';
    const text = formData.get('lore') as string;
    if (!text || text.length > 10_000) return;
    await updateServerLore(pool, serverId, text);
    revalidatePath(`/dashboard/${serverId}/lore`);
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
          className="w-full rounded-lg bg-bg-raised border border-border p-3 text-text resize-y"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-white font-medium hover:bg-primary-hover transition"
        >
          Save Lore
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add applications/dashboard/src/app/dashboard/\[serverId\]/settings/page.tsx applications/dashboard/src/app/dashboard/\[serverId\]/lore/page.tsx
git commit -m "feat(dashboard): migrate settings and lore pages to theme tokens"
```

---

### Task 9: Migrate history page colors

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/history/page.tsx`

- [ ] **Step 1: Replace hardcoded color classes with theme tokens**

Replace the entire contents of `applications/dashboard/src/app/dashboard/[serverId]/history/page.tsx` with:

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
        <p className="text-text-muted">No conversation history found for this server.</p>
      ) : (
        <div className="flex gap-6">
          <nav className="w-48 shrink-0">
            <h2 className="text-sm font-medium text-text-muted mb-2">Channels</h2>
            <ul className="space-y-1">
              {channels.map((ch) => (
                <li key={ch}>
                  <a
                    href={`?channel=${ch}&page=1`}
                    className={`block rounded px-3 py-1.5 text-sm transition ${
                      ch === selectedChannel
                        ? 'bg-bg-overlay text-text'
                        : 'text-text-muted hover:text-text hover:bg-bg-raised'
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
              <p className="text-text-muted">No messages in this channel.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {messages.map((msg, i) => (
                    <li key={i} className="rounded bg-bg-raised px-3 py-2 text-sm font-mono break-all">
                      {msg}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  {currentPage > 1 && (
                    <a
                      href={`?channel=${selectedChannel}&page=${currentPage - 1}`}
                      className="rounded bg-bg-overlay px-3 py-1 text-sm hover:bg-border transition"
                    >
                      Previous
                    </a>
                  )}
                  {messages.length === pageSize && (
                    <a
                      href={`?channel=${selectedChannel}&page=${currentPage + 1}`}
                      className="rounded bg-bg-overlay px-3 py-1 text-sm hover:bg-border transition"
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
git add applications/dashboard/src/app/dashboard/\[serverId\]/history/page.tsx
git commit -m "feat(dashboard): migrate history page to theme tokens"
```

---

### Task 10: Wire theme into website

**Files:**
- Modify: `applications/website/src/app/layout.tsx`
- Modify: `applications/website/src/app/page.tsx`

- [ ] **Step 1: Update the website root layout**

Replace the entire contents of `applications/website/src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import { themeScript } from '@contexta/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contexta — AI Co-Host for Discord',
  description: 'An intelligent AI agent that remembers your conversations and provides contextual assistance in Discord servers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg text-text min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Update the website placeholder page with brand colors**

Replace the entire contents of `applications/website/src/app/page.tsx` with:

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">Contexta</h1>
      <p className="text-text-muted">AI Co-Host for Discord — coming soon.</p>
    </main>
  );
}
```

- [ ] **Step 3: Verify both apps build**

Run: `pnpm build`
Expected: All packages build successfully.

- [ ] **Step 4: Commit**

```bash
git add applications/website/src/app/layout.tsx applications/website/src/app/page.tsx
git commit -m "feat(website): wire theme script and brand colors into layout"
```

---

### Task 11: Run tests and final verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All 99 tests pass. No color class changes should affect test logic since tests mock the DOM.

- [ ] **Step 2: Verify no remaining hardcoded gray/indigo classes in dashboard**

Run: `grep -rn 'gray-\|indigo-' applications/dashboard/src/ --include='*.tsx'`
Expected: No matches found.

- [ ] **Step 3: Verify no remaining hardcoded gray/indigo classes in website**

Run: `grep -rn 'gray-\|indigo-' applications/website/src/ --include='*.tsx'`
Expected: No matches found.

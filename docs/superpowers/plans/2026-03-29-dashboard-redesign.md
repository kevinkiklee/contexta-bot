# Dashboard UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the dashboard from bare-bones Tailwind into a professional admin dashboard with dual sidebar, refined pages, and smooth animations.

**Architecture:** Persistent dual sidebar (icon rail + nav panel) replaces the top nav bar. All page content renders in the main area to the right. CSS-only animations for page transitions, card interactions, and staggered list entrances. No new dependencies.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, React 19, CSS @keyframes

---

### Task 1: Animations CSS

**Files:**
- Create: `applications/dashboard/src/app/animations.css`
- Modify: `applications/dashboard/src/app/globals.css`

- [ ] **Step 1: Create animations.css with all keyframes and utility classes**

Create `applications/dashboard/src/app/animations.css`:

```css
/* Animations — GPU-composited (transform + opacity only) */
/* All animations respect prefers-reduced-motion */

@media (prefers-reduced-motion: no-preference) {
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-4px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .animate-fade-in {
    animation: fadeIn 300ms ease-out both;
  }

  .animate-fade-in-up {
    animation: fadeInUp 400ms ease-out both;
  }

  .animate-slide-in-left {
    animation: slideInLeft 200ms ease-out both;
  }

  .animate-scale-in {
    animation: scaleIn 300ms ease-out both;
  }

  .animate-stagger > * {
    opacity: 0;
    animation: fadeInUp 400ms ease-out both;
  }

  .animate-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .animate-stagger > *:nth-child(2) { animation-delay: 50ms; }
  .animate-stagger > *:nth-child(3) { animation-delay: 100ms; }
  .animate-stagger > *:nth-child(4) { animation-delay: 150ms; }
  .animate-stagger > *:nth-child(5) { animation-delay: 200ms; }
  .animate-stagger > *:nth-child(6) { animation-delay: 250ms; }
  .animate-stagger > *:nth-child(7) { animation-delay: 300ms; }
  .animate-stagger > *:nth-child(8) { animation-delay: 350ms; }
  .animate-stagger > *:nth-child(9) { animation-delay: 400ms; }
  .animate-stagger > *:nth-child(10) { animation-delay: 450ms; }

  .card-lift {
    transition: transform 200ms ease, box-shadow 200ms ease;
  }

  .card-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .icon-hover {
    transition: transform 150ms ease;
  }

  .icon-hover:hover {
    transform: scale(1.05);
  }

  .btn-press:active {
    transform: scale(0.97);
    transition: transform 100ms ease;
  }
}
```

- [ ] **Step 2: Import animations.css in globals.css**

Add the import to the top of `applications/dashboard/src/app/globals.css` (after the tailwindcss import):

The file currently starts with:
```css
@import "tailwindcss";
```

Change it to:
```css
@import "tailwindcss";
@import "./animations.css";
```

Leave everything else in globals.css unchanged (the @custom-variant, @theme, :root, .dark blocks).

- [ ] **Step 3: Commit**

```bash
git add applications/dashboard/src/app/animations.css applications/dashboard/src/app/globals.css
git commit -m "feat(dashboard): add animation keyframes and utility classes"
```

---

### Task 2: Sidebar component

**Files:**
- Create: `applications/dashboard/src/app/dashboard/sidebar.tsx`

- [ ] **Step 1: Create the dual sidebar client component**

Create `applications/dashboard/src/app/dashboard/sidebar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@contexta/ui';

interface Server {
  server_id: string;
  server_name: string | null;
  is_admin: boolean;
}

interface SidebarProps {
  servers: Server[];
  userName: string;
}

function LogoMark() {
  return (
    <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
      C
    </div>
  );
}

function ServerIcon({ server, isActive }: { server: Server; isActive: boolean }) {
  const initial = (server.server_name || server.server_id).charAt(0).toUpperCase();
  return (
    <Link
      href={`/dashboard/${server.server_id}`}
      title={server.server_name || server.server_id}
      className={`icon-hover w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 transition-all ${
        isActive
          ? 'bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-bg'
          : 'bg-bg-overlay text-text-subtle hover:bg-border'
      }`}
    >
      {initial}
    </Link>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}

function NavItem({ href, label, icon, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-[13px] transition-all relative ${
        active
          ? 'bg-bg-raised text-text font-medium'
          : 'text-text-muted hover:text-text hover:bg-bg-raised/50'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full animate-slide-in-left" />
      )}
      <span className="text-sm">{icon}</span>
      {label}
    </Link>
  );
}

export function Sidebar({ servers, userName }: SidebarProps) {
  const pathname = usePathname();

  const activeServerId = pathname.match(/^\/dashboard\/([^/]+)/)?.[1] ?? null;
  const activeServer = servers.find((s) => s.server_id === activeServerId);

  return (
    <aside className="flex h-screen shrink-0 sticky top-0">
      {/* Icon Rail */}
      <div className="w-14 border-r border-border flex flex-col items-center py-4 gap-2">
        <Link href="/dashboard" className="mb-3">
          <LogoMark />
        </Link>
        {servers.map((server) => (
          <ServerIcon
            key={server.server_id}
            server={server}
            isActive={server.server_id === activeServerId}
          />
        ))}
      </div>

      {/* Nav Panel */}
      <div className="w-[180px] border-r border-border flex flex-col">
        <nav className="flex-1 p-3 space-y-1">
          {activeServer ? (
            <>
              <div className="px-3 py-2 text-[13px] font-semibold truncate">
                {activeServer.server_name || activeServer.server_id}
              </div>
              <NavItem
                href={`/dashboard/${activeServerId}`}
                label="Overview"
                icon="⌂"
                active={pathname === `/dashboard/${activeServerId}`}
              />
              {activeServer.is_admin && (
                <>
                  <NavItem
                    href={`/dashboard/${activeServerId}/settings`}
                    label="Settings"
                    icon="⚙"
                    active={pathname === `/dashboard/${activeServerId}/settings`}
                  />
                  <NavItem
                    href={`/dashboard/${activeServerId}/lore`}
                    label="Lore"
                    icon="📜"
                    active={pathname === `/dashboard/${activeServerId}/lore`}
                  />
                </>
              )}
              <NavItem
                href={`/dashboard/${activeServerId}/history`}
                label="History"
                icon="💬"
                active={pathname === `/dashboard/${activeServerId}/history`}
              />
            </>
          ) : (
            <>
              <NavItem href="/dashboard" label="All Servers" icon="☰" active={pathname === '/dashboard'} />
              <NavItem href="/dashboard" label="Account" icon="◉" active={false} />
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2 px-2">
            <div className="w-6 h-6 rounded-full bg-bg-overlay flex items-center justify-center text-[10px] font-semibold text-text-muted">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-text-muted text-xs truncate">{userName}</span>
          </div>
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add applications/dashboard/src/app/dashboard/sidebar.tsx
git commit -m "feat(dashboard): add dual sidebar component"
```

---

### Task 3: Dashboard layout + loading states

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/layout.tsx`
- Create: `applications/dashboard/src/app/dashboard/loading.tsx`
- Create: `applications/dashboard/src/app/dashboard/[serverId]/loading.tsx`

- [ ] **Step 1: Replace dashboard layout — remove top nav, add sidebar shell**

Replace the entire contents of `applications/dashboard/src/app/dashboard/layout.tsx` with:

```tsx
import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserServers } from '@/lib/queries';
import { pool } from '@/lib/db';
import { Sidebar } from './sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/');

  const servers = await getUserServers(pool, session.user.id!);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        servers={servers}
        userName={session.user.name || 'User'}
      />
      <main className="flex-1 min-w-0 p-8">
        <div className="max-w-4xl animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
```

Note: The `signOut` import is no longer used here — sign out will be handled by the sidebar. Remove the import.

Actually, the sidebar is a client component so it can't call server actions directly. We need to keep sign out as a server action. Add a sign-out form to the sidebar bottom section. Let me update — actually, for simplicity, let's add a sign-out route. But the simplest approach is a small server component wrapper.

For now, let's add a sign-out link that navigates to `/api/auth/signout`. NextAuth handles this automatically.

The layout becomes simply:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserServers } from '@/lib/queries';
import { pool } from '@/lib/db';
import { Sidebar } from './sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/');

  const servers = await getUserServers(pool, session.user.id!);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        servers={servers}
        userName={session.user.name || 'User'}
      />
      <main className="flex-1 min-w-0 p-8">
        <div className="max-w-4xl animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Update sidebar to use /api/auth/signout link**

In the sidebar component's bottom section, add a sign-out link. Modify the bottom `<div>` in `sidebar.tsx` to include:

```tsx
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2 px-2">
            <div className="w-6 h-6 rounded-full bg-bg-overlay flex items-center justify-center text-[10px] font-semibold text-text-muted">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-text-muted text-xs truncate">{userName}</span>
          </div>
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
            <a href="/api/auth/signout" className="text-[11px] text-text-muted hover:text-text transition">
              Sign out
            </a>
          </div>
        </div>
```

- [ ] **Step 3: Create loading.tsx for dashboard level**

Create `applications/dashboard/src/app/dashboard/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="h-6 w-48 bg-bg-raised rounded animate-pulse mb-4" />
      <div className="h-4 w-64 bg-bg-raised rounded animate-pulse mb-8" />
      <div className="space-y-3">
        <div className="h-16 bg-bg-raised rounded-lg animate-pulse" />
        <div className="h-16 bg-bg-raised rounded-lg animate-pulse" />
        <div className="h-16 bg-bg-raised rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create loading.tsx for server level**

Create `applications/dashboard/src/app/dashboard/[serverId]/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="h-6 w-48 bg-bg-raised rounded animate-pulse mb-4" />
      <div className="h-4 w-64 bg-bg-raised rounded animate-pulse mb-8" />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="h-24 bg-bg-raised rounded-xl animate-pulse" />
        <div className="h-24 bg-bg-raised rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add applications/dashboard/src/app/dashboard/layout.tsx applications/dashboard/src/app/dashboard/loading.tsx applications/dashboard/src/app/dashboard/sidebar.tsx "applications/dashboard/src/app/dashboard/[serverId]/loading.tsx"
git commit -m "feat(dashboard): wire sidebar into layout, add loading states"
```

---

### Task 4: Landing page + server list page redesign

**Files:**
- Modify: `applications/dashboard/src/app/page.tsx`
- Modify: `applications/dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Add logo mark to landing page**

Replace the entire contents of `applications/dashboard/src/app/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center animate-scale-in">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold mb-6">
        C
      </div>
      <h1 className="text-4xl font-bold mb-2 tracking-tight">Contexta</h1>
      <p className="text-text-muted mb-8">AI co-host for your Discord server</p>
      <a
        href="/api/auth/signin"
        className="btn-press rounded-lg bg-primary px-6 py-3 text-white font-medium hover:bg-primary-hover transition"
      >
        Sign in with Discord
      </a>
    </main>
  );
}
```

- [ ] **Step 2: Redesign server list page**

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Your Servers</h1>
        <p className="text-text-muted text-sm mt-1">Manage your Discord servers with Contexta</p>
      </div>
      {servers.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-raised p-8 text-center">
          <p className="text-text-muted">
            No servers found. Make sure Contexta is added to your Discord server.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 animate-stagger">
          {servers.map((server) => {
            const initial = (server.server_name || server.server_id).charAt(0).toUpperCase();
            return (
              <Link
                key={server.server_id}
                href={`/dashboard/${server.server_id}`}
                className="card-lift flex items-center gap-4 rounded-xl border border-border bg-bg-raised p-4 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-bg-overlay flex items-center justify-center text-[15px] font-semibold text-text-subtle shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{server.server_name || server.server_id}</div>
                  <div className="text-text-muted text-xs mt-0.5">{server.active_model}</div>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                  server.is_admin
                    ? 'text-primary bg-primary/10'
                    : 'text-text-muted bg-bg-overlay'
                }`}>
                  {server.is_admin ? 'Admin' : 'Member'}
                </span>
                <span className="text-text-muted text-sm">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add applications/dashboard/src/app/page.tsx applications/dashboard/src/app/dashboard/page.tsx
git commit -m "feat(dashboard): redesign landing page and server list"
```

---

### Task 5: Server overview page redesign

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/page.tsx`

- [ ] **Step 1: Redesign server overview with stat cards and action cards**

Replace the entire contents of `applications/dashboard/src/app/dashboard/[serverId]/page.tsx` with:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkServerMembership } from '@/lib/auth-helpers';
import { getServerSettings } from '@/lib/queries';
import { getServerChannels } from '@/lib/queries';
import { pool } from '@/lib/db';
import { redis } from '@/lib/redis';
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
  const settings = await getServerSettings(pool, serverId);
  const channels = await getServerChannels(redis, serverId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-text-muted text-sm mt-1">Server dashboard for {serverId}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-8 animate-stagger">
        <div className="rounded-xl border border-border bg-bg-raised p-5">
          <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Active Model</div>
          <div className="text-lg font-semibold mt-1">{settings?.active_model ?? 'gemini-2.5-flash'}</div>
        </div>
        <div className="rounded-xl border border-border bg-bg-raised p-5">
          <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Channels Tracked</div>
          <div className="text-lg font-semibold mt-1">{channels.length}</div>
        </div>
      </div>

      {/* Action cards */}
      <h2 className="text-sm font-medium text-text-muted mb-3">Quick Actions</h2>
      <div className="flex flex-col gap-2 animate-stagger">
        {membership?.is_admin && (
          <>
            <Link
              href={`/dashboard/${serverId}/settings`}
              className="card-lift flex items-center justify-between rounded-xl border border-border bg-bg-raised p-4 transition-all"
            >
              <div>
                <div className="font-semibold text-sm">Settings</div>
                <div className="text-text-muted text-xs mt-0.5">Configure bot model and cache</div>
              </div>
              <span className="text-text-muted">→</span>
            </Link>
            <Link
              href={`/dashboard/${serverId}/lore`}
              className="card-lift flex items-center justify-between rounded-xl border border-border bg-bg-raised p-4 transition-all"
            >
              <div>
                <div className="font-semibold text-sm">Lore</div>
                <div className="text-text-muted text-xs mt-0.5">Edit server rules and themes</div>
              </div>
              <span className="text-text-muted">→</span>
            </Link>
          </>
        )}
        <Link
          href={`/dashboard/${serverId}/history`}
          className="card-lift flex items-center justify-between rounded-xl border border-border bg-bg-raised p-4 transition-all"
        >
          <div>
            <div className="font-semibold text-sm">History</div>
            <div className="text-text-muted text-xs mt-0.5">Browse conversation history</div>
          </div>
          <span className="text-text-muted">→</span>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "applications/dashboard/src/app/dashboard/[serverId]/page.tsx"
git commit -m "feat(dashboard): redesign server overview with stat and action cards"
```

---

### Task 6: Settings page redesign

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/settings/page.tsx`

- [ ] **Step 1: Redesign settings with radio-style model selector in raised card**

Replace the entire contents of `applications/dashboard/src/app/dashboard/[serverId]/settings/page.tsx` with:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerSettings, updateServerModel } from '@/lib/queries';
import { pool } from '@/lib/db';

const MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic' },
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
  const currentModel = settings?.active_model ?? 'gemini-2.5-flash';

  async function handleUpdateModel(formData: FormData) {
    'use server';
    const model = formData.get('model') as string;
    if (MODELS.some((m) => m.id === model)) {
      await updateServerModel(pool, serverId, model);
    }
    revalidatePath(`/dashboard/${serverId}/settings`);
    redirect(`/dashboard/${serverId}/settings`);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-text-muted text-sm mt-1">Configure your bot for this server</p>
      </div>

      <form action={handleUpdateModel}>
        <div className="rounded-xl border border-border bg-bg-raised p-6 max-w-lg">
          <h2 className="text-sm font-semibold mb-4">Model Selection</h2>
          <div className="space-y-2">
            {MODELS.map((model) => (
              <label
                key={model.id}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                  currentModel === model.id
                    ? 'border-primary bg-bg-overlay ring-2 ring-primary'
                    : 'border-border hover:border-accent'
                }`}
              >
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  defaultChecked={currentModel === model.id}
                  className="sr-only"
                />
                <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                  currentModel === model.id
                    ? 'border-primary bg-primary'
                    : 'border-border'
                }`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{model.name}</div>
                  <div className="text-xs text-text-muted">{model.provider}</div>
                </div>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="btn-press mt-6 rounded-lg bg-primary px-5 py-2 text-white text-sm font-medium hover:bg-primary-hover transition"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "applications/dashboard/src/app/dashboard/[serverId]/settings/page.tsx"
git commit -m "feat(dashboard): redesign settings with radio-style model selector"
```

---

### Task 7: Lore page redesign

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/lore/page.tsx`

- [ ] **Step 1: Redesign lore page with raised card and character counter**

Replace the entire contents of `applications/dashboard/src/app/dashboard/[serverId]/lore/page.tsx` with:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerLore, updateServerLore } from '@/lib/queries';
import { pool } from '@/lib/db';
import { LoreForm } from './lore-form';

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Server Lore</h1>
        <p className="text-text-muted text-sm mt-1">Define the rules, themes, and personality for your server</p>
      </div>

      <LoreForm action={handleUpdateLore} defaultValue={lore ?? ''} />
    </div>
  );
}
```

- [ ] **Step 2: Create the LoreForm client component for character counting**

Create `applications/dashboard/src/app/dashboard/[serverId]/lore/lore-form.tsx`:

```tsx
'use client';

import { useState } from 'react';

const MAX_LENGTH = 10_000;
const WARN_THRESHOLD = 9_500;

interface LoreFormProps {
  action: (formData: FormData) => void;
  defaultValue: string;
}

export function LoreForm({ action, defaultValue }: LoreFormProps) {
  const [length, setLength] = useState(defaultValue.length);

  return (
    <form action={action}>
      <div className="rounded-xl border border-border bg-bg-raised p-6 max-w-2xl">
        <h2 className="text-sm font-semibold mb-4">Lore Content</h2>
        <textarea
          name="lore"
          rows={14}
          defaultValue={defaultValue}
          onChange={(e) => setLength(e.target.value.length)}
          placeholder="Enter your server's lore, rules, and themes..."
          className="w-full rounded-lg bg-bg border border-border p-3 text-text text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
        <div className="flex items-center justify-between mt-3">
          <span className={`text-xs ${length > WARN_THRESHOLD ? 'text-error' : 'text-text-muted'}`}>
            {length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
          </span>
          <button
            type="submit"
            className="btn-press rounded-lg bg-primary px-5 py-2 text-white text-sm font-medium hover:bg-primary-hover transition"
          >
            Save Lore
          </button>
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "applications/dashboard/src/app/dashboard/[serverId]/lore/page.tsx" "applications/dashboard/src/app/dashboard/[serverId]/lore/lore-form.tsx"
git commit -m "feat(dashboard): redesign lore page with character counter"
```

---

### Task 8: History page redesign

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/history/page.tsx`

- [ ] **Step 1: Redesign history with channel tabs and styled message rows**

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Conversation History</h1>
        <p className="text-text-muted text-sm mt-1">Browse recent conversations by channel</p>
      </div>

      {channels.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-raised p-8 text-center">
          <p className="text-text-muted">No conversation history found for this server.</p>
        </div>
      ) : (
        <>
          {/* Channel tabs */}
          <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
            {channels.map((ch) => (
              <a
                key={ch}
                href={`?channel=${ch}&page=1`}
                className={`shrink-0 px-3 py-1.5 rounded-md text-sm transition ${
                  ch === selectedChannel
                    ? 'bg-primary text-white font-medium'
                    : 'text-text-muted hover:text-text hover:bg-bg-raised'
                }`}
              >
                #{ch}
              </a>
            ))}
          </div>

          {/* Messages */}
          <div className="rounded-xl border border-border bg-bg-raised overflow-hidden">
            {messages.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-text-muted">No messages in this channel.</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {messages.map((msg, i) => (
                    <li key={i} className="px-4 py-3 text-sm font-mono break-all text-text-subtle">
                      {msg}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <div>
                    {currentPage > 1 ? (
                      <a
                        href={`?channel=${selectedChannel}&page=${currentPage - 1}`}
                        className="btn-press text-sm text-text-muted hover:text-text transition"
                      >
                        ← Previous
                      </a>
                    ) : (
                      <span />
                    )}
                  </div>
                  <span className="text-xs text-text-muted">Page {currentPage}</span>
                  <div>
                    {messages.length === pageSize && (
                      <a
                        href={`?channel=${selectedChannel}&page=${currentPage + 1}`}
                        className="btn-press text-sm text-text-muted hover:text-text transition"
                      >
                        Next →
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "applications/dashboard/src/app/dashboard/[serverId]/history/page.tsx"
git commit -m "feat(dashboard): redesign history page with channel tabs"
```

---

### Task 9: Server layout cleanup

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/layout.tsx`

- [ ] **Step 1: Clean up server layout — keep auth check, add animation wrapper**

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
      <div className="rounded-xl border border-border bg-bg-raised p-8 text-center animate-fade-in">
        <h1 className="text-xl font-bold text-error mb-2">Access Denied</h1>
        <p className="text-text-muted">You are not a member of this server.</p>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add "applications/dashboard/src/app/dashboard/[serverId]/layout.tsx"
git commit -m "feat(dashboard): clean up server layout with styled access denied"
```

---

### Task 10: Run tests and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All 99 tests pass.

- [ ] **Step 2: Build the dashboard to verify no compile errors**

Run: `pnpm --filter @contexta/dashboard build`
Expected: Build succeeds.

- [ ] **Step 3: Verify no remaining old gray/indigo classes**

Run: `grep -rn 'gray-\|indigo-' applications/dashboard/src/ --include='*.tsx'`
Expected: No matches found.

# Dashboard UX Redesign

## Summary

Full redesign of the Contexta dashboard — layout shell, page structure, visual refinement, and animations. Transform the current bare-bones Tailwind UI into a professional, refined admin dashboard with a persistent dual sidebar, raised card surfaces, role badges, smooth page transitions, and micro-interactions.

## Layout Shell

The dashboard uses a persistent two-panel sidebar + main content area. The top nav bar is removed entirely — its contents (logo, theme toggle, user info, sign out) move into the sidebar.

### Icon Rail (56px wide, always visible)

- Top: Contexta logo mark — 28x28 rounded square with gradient (primary → accent), white "C"
- Below: Server initial icons — 36x36 rounded squares, first letter of server name, background `bg-bg-overlay`
- Active server: highlighted with a blue ring (`ring-2 ring-primary`)
- Click a server icon to navigate to `/dashboard/{serverId}`
- Server list populated from `getUserServers` query (already fetched in dashboard layout)

### Nav Panel (180px wide)

**When no server is selected** (server list view):
- "All Servers" link (active)
- "Account" link (placeholder, renders nothing for now — future-proofing the nav slot)

**When inside a server** (`/dashboard/{serverId}/*`):
- Server name at top (bold, 13px)
- Overview — links to `/dashboard/{serverId}`
- Settings — links to `/dashboard/{serverId}/settings` (admin only)
- Lore — links to `/dashboard/{serverId}/lore` (admin only)
- History — links to `/dashboard/{serverId}/history`
- Active page gets a left accent bar (3px, primary color) and `bg-bg-raised` background

**Bottom of nav panel** (always visible):
- ThemeToggle component
- Sign out button (text link style)

### Main Content Area

Takes remaining width. Renders the current route's page component. Wraps content in a fade-in entrance animation container.

### Sidebar Component

`applications/dashboard/src/app/dashboard/sidebar.tsx` — a client component (`'use client'`).

Props:
- `servers: { server_id: string; server_name?: string; is_admin: boolean }[]`
- `activeServerId: string | null`
- `activePath: string`
- `userName: string`

Uses `usePathname()` from `next/navigation` to determine active page. Admin-only nav items are conditionally rendered based on the active server's `is_admin` flag.

## Page Redesigns

### Landing / Sign-in Page

No sidebar. Full-screen centered layout. Add Contexta logo mark (same gradient square as sidebar) above the "Contexta" heading. Rest unchanged — tagline + "Sign in with Discord" button.

### Server List Page

- Sidebar nav panel shows: "All Servers" (active), "Account" (placeholder)
- Page heading: "Your Servers" with subtitle "Manage your Discord servers with Contexta"
- Server cards as vertical list items (not grid):
  - Each row: initial avatar (36px square, rounded, first letter), server name (bold), model name (muted), role badge ("Admin" in primary color pill, "Member" in muted pill), arrow indicator
  - Background: `bg-bg-raised`, border: `border-border`, rounded-lg
  - Hover: lift animation (translateY -2px, box-shadow fade-in)
  - Staggered entrance animation (each card delays 50ms)

### Server Overview Page

- Sidebar nav panel shows server nav (Overview active)
- Stat cards in 2-column grid:
  - "Active Model" — shows current model name
  - "Channels Tracked" — shows count from channel query
- Quick action cards below:
  - Settings, Lore, History — each as a raised card with title, description, and arrow
  - Settings and Lore cards only visible to admins
  - Hover lift animation on all cards

### Settings Page

- Sidebar nav panel shows server nav (Settings active)
- Content wrapped in a raised card (`bg-bg-raised`, `border-border`, `rounded-xl`, padding)
- Heading inside card: "Model Selection"
- Model options as a vertical list of radio-style items instead of a `<select>`:
  - Each option: model name (bold) + provider label (muted) in a bordered row
  - Selected option gets `ring-2 ring-primary` and `bg-bg-overlay`
  - Still uses a hidden `<input type="radio">` for form semantics
- Save button at bottom of card

### Lore Page

- Sidebar nav panel shows server nav (Lore active)
- Content wrapped in a raised card
- Heading: "Server Lore"
- Textarea with same styling as current but inside the card
- Character count indicator below textarea: `{length} / 10,000` — muted text, turns `text-error` above 9,500
- Save button at bottom

### History Page

- Sidebar nav panel shows server nav (History active)
- Channel selector: horizontal tab bar at top of content area (replaces the old inline sidebar)
  - Each tab: `#channel-name`, active tab gets bottom border in primary color
  - Overflow: horizontal scroll with fade edges if many channels
- Messages in a raised container below tabs
  - Each message: monospace text in `bg-bg-raised` rows with subtle bottom border
  - Pagination controls at bottom (Previous / Next) styled as subtle buttons

## Animations & Transitions

### CSS Implementation

All animations defined in `applications/dashboard/src/app/animations.css`, imported in `globals.css`. No animation libraries — pure CSS `@keyframes` + Tailwind `transition` utilities.

All animation properties use only `transform` and `opacity` (GPU-composited, no layout thrash).

All animations wrapped in `@media (prefers-reduced-motion: no-preference)` for accessibility.

### Page Transitions

- `loading.tsx` files at `/dashboard/` and `/dashboard/[serverId]/` levels
- Content fade-in: opacity 0→1, translateY 8px→0, 300ms ease-out
- Applied via a CSS class on the main content wrapper

### Sidebar Interactions

- Server icon hover: scale 1.0→1.05, 150ms ease
- Nav item hover: background fades in, 150ms
- Active nav item: left accent bar slides in from left, 200ms ease-out

### Card Interactions

- Hover lift: translateY 0→-2px + box-shadow fade-in, 200ms ease
- Applied to: server list cards, overview stat cards, overview action cards

### List Stagger

- Server list cards: each card has `animation-delay: calc(var(--index) * 50ms)` via inline style or nth-child
- Fade-up entrance: opacity 0→1, translateY 12px→0, 400ms ease-out

### Form Feedback

- Button `:active` state: scale 0.97, 100ms ease
- Save success: not implemented (would require client state — skip for now)

### Keyframes Inventory

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
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
```

## File Changes

### New files
- `applications/dashboard/src/app/animations.css` — Keyframes and animation utility classes
- `applications/dashboard/src/app/dashboard/sidebar.tsx` — Dual sidebar client component
- `applications/dashboard/src/app/dashboard/loading.tsx` — Page transition wrapper
- `applications/dashboard/src/app/dashboard/[serverId]/loading.tsx` — Page transition wrapper

### Modified files
- `applications/dashboard/src/app/globals.css` — Import animations.css
- `applications/dashboard/src/app/page.tsx` — Add logo mark to landing page
- `applications/dashboard/src/app/dashboard/layout.tsx` — Replace top nav with sidebar shell, fetch servers, pass to sidebar
- `applications/dashboard/src/app/dashboard/page.tsx` — Redesigned server list with avatars, badges, stagger
- `applications/dashboard/src/app/dashboard/[serverId]/layout.tsx` — Pass serverId context to sidebar
- `applications/dashboard/src/app/dashboard/[serverId]/page.tsx` — Stat cards + action cards with hover lift
- `applications/dashboard/src/app/dashboard/[serverId]/settings/page.tsx` — Raised card wrapper, radio-style model selector
- `applications/dashboard/src/app/dashboard/[serverId]/lore/page.tsx` — Raised card wrapper, character counter
- `applications/dashboard/src/app/dashboard/[serverId]/history/page.tsx` — Channel tabs, styled message rows

### Not in scope
- No changes to bot, backend, website, or shared packages
- No new npm dependencies
- No data model or API changes
- No skeleton loaders
- No scroll-triggered or parallax animations

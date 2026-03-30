# UI/UX Improvements

**Date:** 2026-03-29
**Scope:** Three sub-projects: dashboard polish, settings/admin UX, bot response quality
**Apps affected:** dashboard, bot, packages/ui

## Sub-project 1: Dashboard Polish

### 1A: Brand Theme Application

Apply the existing brand theme spec colors. Update CSS custom properties in `globals.css`:

| Token | Current (Dark) | New (Dark) | Current (Light) | New (Light) |
|-------|---------------|------------|-----------------|-------------|
| `--color-primary` | `#6366F1` | `#3B82F6` | `#6366F1` | `#3B82F6` |
| `--color-primary-hover` | (missing) | `#60A5FA` | (missing) | `#2563EB` |
| `--color-primary-muted` | `#6366F1/10` | `#3B82F6/10` | `#6366F1/10` | `#3B82F6/10` |
| `--color-bg` | `#09090B` | `#0F172A` | `#FAFAFA` | `#FFFFFF` |
| `--color-bg-raised` | `#18181B` | `#1E293B` | `#FFFFFF` | `#F8FAFC` |
| `--color-bg-overlay` | `#27272A` | `#334155` | `#F4F4F5` | `#F1F5F9` |
| `--color-border` | `#27272A` | `#334155` | `#E4E4E7` | `#E2E8F0` |
| `--color-text-muted` | `#A1A1AA` | `#94A3B8` | `#71717A` | `#64748B` |
| `--color-text-subtle` | `#D4D4D8` | `#CBD5E1` | `#3F3F46` | `#334155` |

Add `--color-primary-hover` token and update any `hover:bg-primary/90` to `hover:bg-primary-hover` in components.

### 1B: Mobile Responsive Sidebar

**Approach:** Collapsible sidebar with hamburger menu on mobile.

**Breakpoint:** 768px (md).

**Behavior:**
- **Desktop (≥768px):** Sidebar stays as-is — icon rail (52px) + nav panel (190px), always visible.
- **Mobile (<768px):** Sidebar hidden. Fixed top bar with hamburger icon (left) and page title (center). Tapping hamburger slides sidebar in from left as full-height overlay with backdrop. Tapping backdrop or nav item closes it.

**Implementation:**
- Add `sidebarOpen` state to Sidebar component
- Desktop: `hidden md:flex` on sidebar, `flex md:hidden` on mobile top bar
- Mobile overlay: fixed position, z-50, backdrop with `bg-black/50`
- Close on nav item click (router change)

### 1C: Strategic Loading States

Add skeleton placeholders for data-heavy pages only:

| Page | Skeleton Treatment |
|------|-------------------|
| Server overview | 2 stat cards shimmer + 4 action card outlines |
| Knowledge browser | 4 stat cards shimmer + 5 table row placeholders |
| Message history | 10 message row placeholders |
| Dashboard index (server list) | 3 server card placeholders |

**Implementation:** Create `loading.tsx` files in each route segment. Use Tailwind `animate-pulse` on `bg-bg-overlay` rectangles matching the actual layout dimensions. No generic spinners.

### 1D: Empty States with CTAs

| Page | Empty State |
|------|-------------|
| Dashboard index (no servers) | Icon + "No servers found" + "Invite Contexta to your Discord server to get started." + [Add to Discord] button (links to bot invite URL from `BOT_CLIENT_ID`) + [Learn more] link |
| Knowledge browser (no entries) | Icon + "No knowledge entries yet" + "The bot automatically extracts knowledge from conversations. Once active, entries will appear here." |
| Message history (no messages) | Icon + "No messages recorded yet" + "Messages appear here once the bot is active in this server's channels." |
| Knowledge browser (filtered, no results) | "No entries match your filters." + [Clear filters] button |

---

## Sub-project 2: Settings/Admin UX

### 2A: Combine Settings Forms

Merge the model selection and knowledge approval into a single page with clear sections but ONE save button. Use a single `<form>` with a server action that updates both model and knowledge config atomically.

Sections separated by headings:
- **Model Selection** — existing radio group
- **Knowledge Approval** — threshold slider + review toggle

Single "Save Settings" button at the bottom.

### 2B: Success Feedback

After saving any form (settings, lore, personality), show a toast/flash message instead of silent redirect.

**Implementation:** Add a `?saved=true` query param on redirect. Page reads it and shows a dismissable green banner: "Settings saved successfully." Auto-dismiss after 3 seconds. Use a small client component (`SavedBanner`) that reads `searchParams`.

### 2C: Consistent Access Denied Styling

Standardize the "Access Denied" treatment across all admin pages (settings, lore, personality, knowledge):
- Same card style: `border border-border rounded-lg p-6 bg-bg-raised` with lock icon
- Same message: "You need admin permissions to access this page."
- No red/error colors — this isn't an error, it's expected for non-admins

---

## Sub-project 3: Bot Response Quality

### 3A: Discord Embed Formatting for /ask and /recall

Replace plain text responses with Discord embeds for structured commands:

**`/ask` response:**
```
Embed:
  color: 0x3B82F6 (primary blue)
  description: [LLM response text]
  footer: "📚 Sources: KE-3f8a (decision, ●●●) · KE-1c2d (topic, ●●○)"
```

**`/recall` response:**
```
Embed:
  color: 0x3B82F6
  title: "🔍 Recall: {topic}"
  description: [synthesized response]
  footer: "Sources from knowledge base and channel history"
```

**`/knowledge search` response:**
```
Embed:
  color: 0x3B82F6
  title: "🔍 Knowledge Search: {query}"
  fields: [
    { name: "KE-3f8a — Redis Decision", value: "decision · ●●● \n Team chose Redis..." },
    ...up to 3 fields
  ]
  footer: "N results found"
```

**@mention responses** stay as plain text (embeds feel too formal for casual chat).

### 3B: Clearer Error Messages

Replace generic error messages with specific ones:

| Current | New |
|---------|-----|
| "I ran into an issue..." | "I couldn't process that right now. Try again in a moment." |
| "Failed to search the knowledge base." | "Knowledge search is temporarily unavailable. Try again shortly." |
| Rate limited (add new) | "You're sending commands too quickly. Please wait a few seconds." |

### 3C: Human-Friendly Model Labels

In the dashboard server cards and overview page, show human labels instead of raw model IDs:

| Model ID | Display Label |
|----------|--------------|
| `gemini-2.5-flash` | Gemini Flash |
| `gemini-2.5-pro` | Gemini Pro |
| `gpt-4o` | GPT-4o |
| `gpt-4o-mini` | GPT-4o Mini |
| `claude-3.5-sonnet` | Claude Sonnet |
| `claude-3.5-haiku` | Claude Haiku |

Add a `getModelLabel(modelId: string)` helper in `packages/shared`.

---

## Out of Scope

- Knowledge graph visualization
- Bulk actions on knowledge entries
- Theme toggle component (already exists in packages/ui)
- Website styling (separate project)
- Bot personality/tone changes
- New dashboard pages or features

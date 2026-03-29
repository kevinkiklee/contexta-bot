# Brand Color Scheme & Theme System

## Summary

Apply a unified brand color scheme across the dashboard and website with togglable light/dark theme modes. Professional, clean, refined — not cartoonish or flashy.

## Brand Colors

| Name | Hex | Role |
|------|-----|------|
| Electric Blue | `#3B82F6` | Primary — buttons, active states, CTAs |
| Deep Navy | `#0F172A` | Secondary — dark mode background, light mode headings |
| Neon Cyan | `#06B6D4` | Accent — links, highlights, badges |
| Cool Gray | `#CBD5E1` | Neutral — muted text, borders, dividers |

## Approach

Tailwind v4 CSS-first: define CSS custom properties in `globals.css` using `@theme`, scoped to `:root` (light) and `.dark` (dark). Toggle via `class="dark"` on `<html>`, persisted to `localStorage`, initialized from `prefers-color-scheme`.

## Semantic Color Tokens

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `--color-primary` | `#3B82F6` | `#3B82F6` | Buttons, active states |
| `--color-primary-hover` | `#60A5FA` | `#2563EB` | Button hover |
| `--color-accent` | `#06B6D4` | `#0891B2` | Links, highlights, badges |
| `--color-bg` | `#0F172A` | `#FFFFFF` | Page background |
| `--color-bg-raised` | `#1E293B` | `#F8FAFC` | Cards, inputs, panels |
| `--color-bg-overlay` | `#334155` | `#F1F5F9` | Hover states, selected items |
| `--color-border` | `#334155` | `#E2E8F0` | Borders, dividers |
| `--color-text` | `#F8FAFC` | `#0F172A` | Primary text |
| `--color-text-muted` | `#94A3B8` | `#64748B` | Secondary/helper text |
| `--color-text-subtle` | `#CBD5E1` | `#334155` | Tertiary text |
| `--color-error` | `#F87171` | `#DC2626` | Error states |

## Theme Toggle

A `<ThemeToggle>` client component in `packages/ui/`:

- On mount: reads `localStorage.getItem('theme')`. If no stored preference, reads `prefers-color-scheme`. Sets or removes `class="dark"` on `<html>`.
- On click: cycles light -> dark -> system. Persists choice to `localStorage`.
- Default: system preference (option C from brainstorming).

### Flash Prevention

A synchronous `<script>` block in the root layout runs before React hydration. It reads `localStorage` and applies the `dark` class immediately, preventing a visible flash of the wrong theme on page load.

This script is exported as a string from `packages/ui/src/theme-script.ts` for embedding in layout files.

## Dashboard Migration

Replace every hardcoded Tailwind color class with theme tokens:

| Current | Becomes |
|---------|---------|
| `bg-gray-950` | `bg-bg` |
| `bg-gray-900` | `bg-bg-raised` |
| `bg-gray-800` | `bg-bg-overlay` |
| `border-gray-800`, `border-gray-700` | `border-border` |
| `text-gray-100`, `text-white` | `text-text` |
| `text-gray-300`, `text-gray-400` | `text-text-muted` |
| `bg-indigo-600` | `bg-primary` |
| `hover:bg-indigo-500` | `hover:bg-primary-hover` |
| `hover:border-gray-600` | `hover:border-accent` |
| `text-red-400` | `text-error` |

13 dashboard files updated — every layout.tsx, page.tsx, and the landing page. No logic changes, purely class name swaps.

## Website

Minimal: update root `layout.tsx` to use `bg-bg text-text` and include the theme script. The placeholder page gets basic brand color styling.

## File Changes

### New files
- `packages/ui/src/ThemeToggle.tsx` — client component for theme cycling
- `packages/ui/src/theme-script.ts` — inline script string for SSR flash prevention

### Modified files
- `applications/dashboard/src/app/globals.css` — theme token definitions via `@theme`
- `applications/website/src/app/globals.css` — same theme token definitions
- `applications/dashboard/src/app/layout.tsx` — theme script + ThemeToggle
- `applications/website/src/app/layout.tsx` — theme script + ThemeToggle
- `applications/dashboard/src/app/page.tsx` — class migration
- `applications/dashboard/src/app/dashboard/layout.tsx` — class migration
- `applications/dashboard/src/app/dashboard/page.tsx` — class migration
- `applications/dashboard/src/app/dashboard/[serverId]/layout.tsx` — class migration
- `applications/dashboard/src/app/dashboard/[serverId]/page.tsx` — class migration
- `applications/dashboard/src/app/dashboard/[serverId]/settings/page.tsx` — class migration
- `applications/dashboard/src/app/dashboard/[serverId]/lore/page.tsx` — class migration
- `applications/dashboard/src/app/dashboard/[serverId]/history/page.tsx` — class migration
- `applications/website/src/app/page.tsx` — brand colors on placeholder
- `packages/ui/src/index.ts` — export ThemeToggle and theme-script
- `packages/ui/package.json` — add peer dependency note if needed

### Not in scope
- No new UI components beyond ThemeToggle
- No shadcn/ui installation
- No redesign of page layouts or structure
- No changes to bot or backend (no UI)

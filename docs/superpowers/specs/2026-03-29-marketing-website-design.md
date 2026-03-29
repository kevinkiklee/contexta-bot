# Marketing Website Design Spec

**Date:** 2026-03-29
**App:** `applications/website/` (@contexta/website)
**Deploy:** Vercel (already scaffolded with Next.js 15, Tailwind v4)

## Overview

Single-page marketing site for Contexta, an AI Discord bot with long-term memory. Target audience: general Discord users who'd share the link with their server admin. Playful, fun tone matching Discord's casual vibe.

## Page Structure

Seven sections on one scrollable page:

1. **Sticky Nav** — Logo + "Contexta" wordmark. Links: Features, How It Works. "Add to Discord" CTA button. Semi-transparent with backdrop blur.

2. **Hero** — Large heading: "Your server's memory." Subtext explaining the knowledge management angle. Glowing abstract orb visual centerpiece. Two CTAs: "Add to Discord" (primary, blurple `#5865F2`) and "Open Dashboard" (ghost/outline).

3. **Features Grid** — 4 cards highlighting:
   - **Long-term memory** — remembers conversations across channels and time
   - **Server lore** — custom personality, rules, context that shape every response
   - **Semantic recall** — search past conversations by meaning, not keywords
   - **Personal profiles** — knows each member's preferences and style

4. **How It Works** — 3 steps in a horizontal row connected by dotted line:
   - Add to Discord
   - Set your lore
   - Contexta learns

5. **Stats / Social Proof** — Optional section if numbers are available. Can be placeholder initially.

6. **Final CTA** — Repeat "Add to Discord" with closing line.

7. **Footer** — Minimal: Dashboard link, GitHub link (if public), Discord support server.

## Visual Design

**Aesthetic:** Cosmic / Ethereal — "neural network in space"

**Colors:**
- Background: Deep space gradient `#0a0612` → `#1a0e2e` → `#0d0b1a`
- Primary accent: Purple `#7c3aed` with glow (`box-shadow: 0 0 40px #7c3aed33`)
- Secondary accent: Cyan `#06b6d4`
- Text: `#e8e0f0` (primary), `#9585b0` (muted)
- CTA buttons: Discord blurple `#5865F2`

**Typography:**
- Font: Manrope (consistent with dashboard)
- Hero: Bold, 4xl-6xl, tight tracking
- Body: Regular, relaxed line height

**Effects:**
- Floating gradient orbs (CSS radial-gradient + blur + slow CSS animation)
- Subtle grain/noise texture overlay
- Glow rings behind feature icons
- Gradient divider lines between sections
- Feature cards: glass-morphism (`backdrop-blur`, semi-transparent borders, purple glow on hover)

**How It Works:** Three numbered circles connected by faint dotted line, each with icon + label.

## Technical Details

- Built in existing `applications/website/` Next.js 15 scaffold
- Single `page.tsx` with section components
- Tailwind v4 CSS-based theming (update `globals.css` with cosmic palette)
- Manrope font via `next/font/google` (same setup as dashboard)
- All static — no API calls, no auth, no server components needed beyond default
- CSS-only animations (no JS animation library needed)
- Responsive: mobile-first, single column on small screens, grid on desktop

## CTAs

- "Add to Discord" links to Discord bot invite URL (env var or hardcoded)
- "Open Dashboard" links to `https://contexta-bot.vercel.app` (or the dashboard domain)

## Out of Scope

- Blog, docs, pricing pages (single page only)
- CMS integration
- Analytics (can be added later)
- i18n

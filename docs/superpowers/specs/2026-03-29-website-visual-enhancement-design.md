# Marketing Website Visual Enhancement Spec

**Date:** 2026-03-29
**App:** `applications/website/` (@contexta/website)
**Scope:** Homepage enrichment + 1 new section. No new pages.

## Goal

Transform the marketing site from a text-heavy page with minimal inline SVGs into a visually dramatic, illustration-rich experience. All visuals are CSS/SVG-only — no raster image assets. The visual direction is bold and dramatic (Vercel/Stripe/Linear aesthetic) with 3D-ish isometric elements, layered depth, and scroll-triggered animations.

## Design Decisions

- **Visual approach:** Pure CSS/SVG illustrations — no image files, no asset pipeline
- **Style:** Bold, dramatic, 3D-ish — perspective transforms, layered gradients, glowing effects
- **Content focus:** Memory concept + bot-in-action demos (the two strongest selling points)
- **Layout shift:** Features move from 2x2 grid to full-width alternating rows
- **New section:** "See It In Action" showcase between Features and How It Works

## Section-by-Section Design

### 1. Hero Overhaul

**Current state:** Constellation SVG background, small neural orb, simple Discord message mockup, scroll indicator.

**New design:**

**Isometric Brain Illustration** (replaces neural orb):
- Layered concentric rings with CSS `perspective` and `rotateX`/`rotateY` transforms creating a 3D holographic effect
- Rings built from SVG circles with gradient strokes (purple → cyan)
- Glowing nodes at ring intersections that pulse with `animation: pulse-glow`
- Small orbiting data particles (tiny circles on CSS `@keyframes` orbital paths)
- Soft radial gradient glow behind the entire assembly (`box-shadow` or pseudo-element blur)
- Gentle continuous rotation on the Y axis (very slow, ~30s cycle)

**Discord Chat Mockup** (replaces simple text box):
- Full-fidelity Discord dark theme recreation:
  - Dark card (`#36393f` background, `#2f3136` sidebar hint, `#40444b` input bar)
  - 3-4 message bubbles with circular avatar placeholders (colored circles with initials), username in role color, timestamp in dim text
  - Multi-turn conversation: User asks question → Bot responds with context from a previous conversation → shows the "memory" in action
- Messages animate in sequentially on page load with a stagger delay (200ms between each)
- Typing indicator animation (three bouncing dots) appears before bot's message

**Background depth layers:**
- Large soft gradient blur blobs (purple, cyan) positioned behind hero content using `position: absolute` + `filter: blur(100px)` + low opacity
- Subtle parallax-like effect: background blurs shift slightly on scroll (CSS `transform` with scroll-linked offset, or a simple `translateY` shift)
- Keep existing constellation SVG but reduce opacity to ~15% to serve as texture, not focal point

### 2. Features Section — Alternating Full-Width Rows

**Current state:** 2x2 card grid with small visual snippets inside each card.

**New layout:** Each feature is a full-width row, alternating illustration-left/text-right and text-left/illustration-right. Each row takes roughly 60vh of vertical space.

**Row structure:**
```
[Illustration (50%)] [Text content (50%)]  ← odd rows
[Text content (50%)] [Illustration (50%)]  ← even rows
```

On mobile (`< lg`), stack vertically: illustration on top, text below.

**Feature illustrations (each ~400-500px, scroll-animated):**

**a) Long-Term Memory — Animated Timeline**
- Vertical timeline line (gradient stroke, purple → cyan)
- Conversation bubble nodes along the timeline at intervals, growing in size/brightness toward the bottom (representing accumulating memory)
- Each node is a rounded rect with 2-3 lines of placeholder text
- Nodes fade in and scale up sequentially when the section scrolls into view
- Glowing connection lines between related nodes (dashed, animated dash-offset)
- A large "memory bank" glow at the bottom — a rounded container with pulsing border

**b) Server Lore — Floating Configuration Panel**
- CSS 3D perspective panel (`rotateY(-8deg) rotateX(5deg)`) creating an isometric tilt
- Dark card with monospace text showing lore configuration entries:
  ```
  personality: "Friendly and witty"
  context: "Gaming community since 2021"
  rules: "No spoilers in #general"
  ```
- Lines appear one by one with a typewriter animation (CSS `steps()` + `width` animation)
- Soft glow emanating from the card edges
- Small floating "edit" cursor icon orbiting the panel

**c) Semantic Recall — Radar/Sonar Search Visualization**
- Central search query node (glowing circle with magnifying glass icon)
- Expanding concentric rings radiating outward (sonar pulse effect — ring scales up while fading out, repeating)
- Network of small conversation nodes scattered around at varying distances
- When the pulse reaches a node, it lights up with a confidence score badge (98%, 85%, 72%)
- Glowing connection lines draw from matched nodes back to the center
- 3-4 "matched" nodes highlighted in cyan, rest stay dim

**d) Personal Profiles — Isometric Card Stack**
- 3 user profile cards stacked with CSS 3D transforms (`rotateX(45deg) rotateY(-10deg)`) in an isometric fan
- Each card has: colored avatar circle, username, and 2-3 preference tags (e.g., "Loves hiking", "Python dev", "Night owl")
- Cards float at slightly different Z-levels creating real depth
- On scroll-in, cards slide into position from scattered starting points
- Subtle shadow layers between cards reinforcing the 3D stacking
- Gentle hover lift effect on the top card

### 3. New Section: "See It In Action"

**Position:** After Features, before How It Works.

**Purpose:** The centerpiece visual — a dramatic demo of the bot's memory recall in a realistic Discord conversation context.

**Layout:** Full-width section with centered content (max-width ~700px for the chat window).

**Discord Conversation Replay:**
- High-fidelity Discord chat recreation (same styling as hero mockup but larger and more detailed)
- Conversation script (3 acts, animated sequentially):

  **Day 1 label** (dim timestamp divider: "Monday, March 24")
  - **Alex:** "just got back from an amazing hike at Mt. Rainier 🏔️"
  - **Jordan:** "jealous! I've been stuck inside all week"
  - *(Contexta silently observes — no response, but a subtle "memory stored" indicator glows)*

  **Day 3 label** ("Wednesday, March 26")
  - **Jordan:** "@Contexta any birthday gift ideas for Alex?"
  - *(Typing indicator appears)*
  - **Contexta:** "Alex mentioned loving hiking at Mt. Rainier a couple days ago! Maybe a National Parks pass, a trail guide for the PNW, or some nice hiking gear? 🎁"

**Memory Connection Lines:**
- After Contexta's response appears, animated SVG arcs draw from the response bubble backward to the Day 1 "hike at Mt. Rainier" message
- Lines glow (purple → cyan gradient stroke) and pulse once before settling at low opacity
- A small "memory retrieved" badge appears on the connecting line at the midpoint
- This is the visual payoff — the "aha" moment

**Background treatment:**
- Large radial gradient spotlight (purple center, transparent edges) behind the chat window
- Floating particle dots drifting slowly upward (20-30 small circles with `animation: float-slow`)
- Section padding generous (py-32 or more) to let the visual breathe

**Animation sequencing:**
- All animations trigger on scroll-into-view (IntersectionObserver)
- Day 1 messages appear first (staggered 300ms)
- Brief pause (800ms)
- Day 3 label + Jordan's question appear
- Typing indicator (1.5s)
- Contexta's response types in
- Memory connection lines draw after response is fully visible (500ms delay)
- Total sequence: ~6-7 seconds

### 4. How It Works — Isometric Step Illustrations

**Current state:** 3 steps with simple icons and a connecting dashed line.

**New design:**

Each step gets a large isometric illustration instead of a small icon:

**Step 1: "Add to Discord"**
- Isometric Discord logo rendered as a 3D-ish element (the Discord clyde icon with perspective transform and gradient fill)
- A "+" badge floating beside it with a glow
- Animated: slides in from left on scroll

**Step 2: "Set Your Lore"**
- Isometric floating book/document with glowing pages
- Configuration text visible on the open pages
- Animated: scales up from center on scroll

**Step 3: "It Learns"**
- Growing neural network — starts as 3-4 nodes, then connection lines draw and new nodes appear, expanding into a larger network
- Animated: network grows in complexity over 3 seconds on scroll

**Connecting path:** Replace the dashed line with an animated glowing path (SVG `<path>` with gradient stroke and `stroke-dashoffset` animation flowing left to right). The glow travels along the path like energy flowing between steps.

### 5. Final CTA Enhancement

**Current state:** Emoji header (🧠), heading, Discord button, small constellation background.

**New design:**
- Replace the 🧠 emoji with a smaller version of the hero's isometric brain illustration (visual bookend — callbacks create cohesion)
- Increase the gradient spotlight intensity — stronger purple/cyan radial glow
- Add floating particles (reuse from "See It In Action" section)
- The brain illustration gently pulses, inviting action

## Animation Strategy

All scroll-triggered animations use `IntersectionObserver` with a `threshold` of `0.2` (trigger when 20% visible). Animations are CSS-only — add a `.visible` class that triggers keyframes via the observer.

**Performance considerations:**
- Use `will-change: transform, opacity` on animated elements
- Prefer `transform` and `opacity` for all animations (compositor-only, no layout thrash)
- Use `@media (prefers-reduced-motion: reduce)` to disable all animations — elements appear in final state immediately
- Particle counts kept low (20-30 max per section)

**Stagger pattern:** Elements within a section use `animation-delay` increments of 100-200ms, set via CSS custom properties or nth-child selectors.

## Component Architecture

Extract the current monolithic `page.tsx` (537 lines) into focused components:

```
src/app/page.tsx              — Section composition + IntersectionObserver logic
src/components/
  Nav.tsx                     — Sticky navigation (existing, extracted)
  Hero.tsx                    — Hero section with brain illustration + Discord mockup
  FeatureRow.tsx              — Reusable alternating feature row (takes side, illustration slot, text)
  features/
    MemoryTimeline.tsx        — Long-term memory illustration
    LorePanel.tsx             — Floating lore configuration panel
    RecallRadar.tsx           — Semantic recall sonar visualization
    ProfileStack.tsx          — Isometric profile card stack
  SeeItInAction.tsx           — Discord conversation replay + memory connection lines
  DiscordChat.tsx             — Reusable Discord chat mockup (used in Hero + SeeItInAction)
  HowItWorks.tsx              — 3 steps with isometric illustrations + glowing path
  FinalCTA.tsx                — CTA with brain illustration callback
  Footer.tsx                  — Footer (existing, extracted)
  BrainIllustration.tsx       — Isometric brain (used in Hero + FinalCTA, with size prop)
  GlowBlob.tsx                — Reusable background gradient blur blob
  Particles.tsx               — Floating particle field (configurable count, speed, color)
```

All components are Server Components by default. Only add `'use client'` to the root `page.tsx` (or a wrapper) for the IntersectionObserver scroll logic.

## CSS/Animation Additions to globals.css

New keyframes needed:
- `sonar-pulse` — expanding ring with fade
- `draw-line` — stroke-dashoffset from full to 0
- `typewriter` — width from 0 to 100% in steps
- `slide-in-left` / `slide-in-right` — translateX entrance
- `grow-network` — node/edge appearance sequence
- `arc-draw` — SVG path draw for memory connection lines

New utility classes:
- `.visible` — trigger class added by IntersectionObserver
- `.stagger-children > *:nth-child(n)` — delay increments

## Responsive Behavior

- **Desktop (lg+):** Full side-by-side feature rows, large illustrations, all particles
- **Tablet (md):** Feature rows stack, illustrations resize to 300px, particle count halved
- **Mobile (sm):** Single column throughout, illustrations 250px or full-width, particles minimal (10), Discord mockups slightly simplified (fewer messages)

## What Stays the Same

- Nav structure and links (extracted but unchanged)
- Color palette and theme variables in globals.css
- Footer content and styling
- Overall dark glassmorphism aesthetic
- Discord invite URL and dashboard URL
- Manrope font

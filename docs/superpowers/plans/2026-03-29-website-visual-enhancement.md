# Website Visual Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the marketing website from text-heavy with minimal SVGs into a visually dramatic, illustration-rich experience using pure CSS/SVG — no raster images.

**Architecture:** Extract the monolithic 537-line `page.tsx` into focused components. Add a client-side `ScrollReveal` wrapper using IntersectionObserver to trigger CSS animations on scroll. Each section gets large, bold CSS/SVG illustrations with 3D perspective transforms and glowing effects.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4 (CSS-based `@theme` config), pure CSS animations, inline SVG.

**Spec:** `docs/superpowers/specs/2026-03-29-website-visual-enhancement-design.md`

---

## File Structure

```
applications/website/src/
├── app/
│   ├── page.tsx                  — Slim composition of section components
│   ├── globals.css               — Extended with new keyframes + utility classes
│   └── layout.tsx                — Unchanged
└── components/
    ├── ScrollReveal.tsx          — 'use client' IntersectionObserver wrapper
    ├── Nav.tsx                   — Sticky nav (extracted from page.tsx, unchanged logic)
    ├── Hero.tsx                  — Hero section with brain + Discord mockup
    ├── BrainIllustration.tsx     — Isometric brain (reused in Hero + FinalCTA)
    ├── DiscordChat.tsx           — Reusable Discord chat mockup component
    ├── GlowBlob.tsx              — Reusable background gradient blur blob
    ├── Particles.tsx             — Floating particle field
    ├── Features.tsx              — Alternating full-width feature rows
    ├── features/
    │   ├── MemoryTimeline.tsx    — Animated timeline illustration
    │   ├── LorePanel.tsx         — 3D floating config panel
    │   ├── RecallRadar.tsx       — Sonar search visualization
    │   └── ProfileStack.tsx      — Isometric profile card stack
    ├── SeeItInAction.tsx         — Discord conversation replay + memory lines
    ├── HowItWorks.tsx            — 3 isometric steps + glowing path
    ├── FinalCTA.tsx              — CTA with brain callback
    └── Footer.tsx                — Footer (extracted, unchanged)
```

---

### Task 1: Add New CSS Keyframes and Utility Classes

**Files:**
- Modify: `applications/website/src/app/globals.css`

- [ ] **Step 1: Add new keyframes inside the `prefers-reduced-motion` block**

Add these after the existing `spin-very-slow` keyframe (after line 91 in globals.css):

```css
  @keyframes sonar-pulse {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(2.5); opacity: 0; }
  }

  @keyframes draw-line {
    from { stroke-dashoffset: var(--line-length, 1000); }
    to { stroke-dashoffset: 0; }
  }

  @keyframes typewriter {
    from { width: 0; }
    to { width: 100%; }
  }

  @keyframes slide-in-left {
    from { opacity: 0; transform: translateX(-40px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(40px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes grow-network {
    0% { opacity: 0; transform: scale(0.3); }
    60% { opacity: 1; transform: scale(1.05); }
    100% { opacity: 1; transform: scale(1); }
  }

  @keyframes arc-draw {
    from { stroke-dashoffset: var(--arc-length, 500); }
    to { stroke-dashoffset: 0; }
  }

  @keyframes glow-path {
    0% { stroke-dashoffset: 200; }
    100% { stroke-dashoffset: 0; }
  }

  @keyframes bounce-dot {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
  }
```

- [ ] **Step 2: Add scroll-reveal utility classes after the stagger block**

Add after the closing `}` of the `prefers-reduced-motion` block (after line 107):

```css
/* Scroll reveal - elements hidden until .visible is added */
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

.reveal-left {
  opacity: 0;
  transform: translateX(-40px);
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.reveal-left.visible {
  opacity: 1;
  transform: translateX(0);
}

.reveal-right {
  opacity: 0;
  transform: translateX(40px);
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.reveal-right.visible {
  opacity: 1;
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal, .reveal-left, .reveal-right {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

- [ ] **Step 3: Verify globals.css is valid**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds with no CSS errors.

- [ ] **Step 4: Commit**

```bash
git add applications/website/src/app/globals.css
git commit -m "feat(website): add scroll-reveal and illustration animation keyframes"
```

---

### Task 2: Create Shared Utility Components

**Files:**
- Create: `applications/website/src/components/ScrollReveal.tsx`
- Create: `applications/website/src/components/GlowBlob.tsx`
- Create: `applications/website/src/components/Particles.tsx`

- [ ] **Step 1: Create ScrollReveal component**

```tsx
// applications/website/src/components/ScrollReveal.tsx
'use client';

import { useEffect, useRef } from 'react';

export default function ScrollReveal({
  children,
  className = '',
  threshold = 0.2,
}: {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          observer.unobserve(el);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create GlowBlob component**

```tsx
// applications/website/src/components/GlowBlob.tsx
export default function GlowBlob({
  color = 'purple',
  size = 400,
  className = '',
}: {
  color?: 'purple' | 'cyan';
  size?: number;
  className?: string;
}) {
  const colorClass = color === 'purple' ? 'bg-purple/8' : 'bg-cyan/6';
  return (
    <div
      className={`absolute rounded-full ${colorClass} pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        filter: `blur(${Math.round(size * 0.3)}px)`,
      }}
    />
  );
}
```

- [ ] **Step 3: Create Particles component**

```tsx
// applications/website/src/components/Particles.tsx
export default function Particles({
  count = 20,
  color = '#7c3aed',
  className = '',
}: {
  count?: number;
  color?: string;
  className?: string;
}) {
  // Generate deterministic positions from index so SSR matches client
  const particles = Array.from({ length: count }, (_, i) => ({
    left: `${(i * 37 + 13) % 100}%`,
    top: `${(i * 53 + 7) % 100}%`,
    size: 1.5 + (i % 3),
    duration: 6 + (i % 5) * 2,
    delay: (i % 7) * 0.8,
    opacity: 0.15 + (i % 4) * 0.1,
  }));

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float-slow"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify components compile**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add applications/website/src/components/ScrollReveal.tsx applications/website/src/components/GlowBlob.tsx applications/website/src/components/Particles.tsx
git commit -m "feat(website): add ScrollReveal, GlowBlob, and Particles utility components"
```

---

### Task 3: Create BrainIllustration Component

**Files:**
- Create: `applications/website/src/components/BrainIllustration.tsx`

- [ ] **Step 1: Create the isometric brain illustration**

```tsx
// applications/website/src/components/BrainIllustration.tsx
export default function BrainIllustration({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'w-64 h-64 sm:w-80 sm:h-80' : 'w-32 h-32 sm:w-40 sm:h-40';
  const viewBox = '0 0 300 300';

  return (
    <div className={`relative ${dim} mx-auto`} style={{ perspective: '800px' }}>
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full bg-purple/10 blur-3xl scale-[1.8] animate-pulse-glow" />
      <div className="absolute inset-4 rounded-full bg-cyan/8 blur-2xl scale-150 animate-float-slow" />

      {/* Rotating ring assembly */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={viewBox}
        fill="none"
        style={{ transform: 'rotateX(20deg) rotateY(-15deg)', transformStyle: 'preserve-3d' }}
      >
        <defs>
          <linearGradient id="ring1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="ring2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="ring3" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <radialGradient id="coreGlow">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Core glow */}
        <circle cx="150" cy="150" r="80" fill="url(#coreGlow)" />

        {/* Ring 1 - outer */}
        <ellipse cx="150" cy="150" rx="130" ry="130" stroke="url(#ring1)" strokeWidth="1.5" opacity="0.4" strokeDasharray="8 12">
          <animateTransform attributeName="transform" type="rotate" from="0 150 150" to="360 150 150" dur="30s" repeatCount="indefinite" />
        </ellipse>

        {/* Ring 2 - middle */}
        <ellipse cx="150" cy="150" rx="100" ry="60" stroke="url(#ring2)" strokeWidth="1" opacity="0.3" strokeDasharray="6 10">
          <animateTransform attributeName="transform" type="rotate" from="60 150 150" to="420 150 150" dur="25s" repeatCount="indefinite" />
        </ellipse>

        {/* Ring 3 - inner tilted */}
        <ellipse cx="150" cy="150" rx="70" ry="100" stroke="url(#ring3)" strokeWidth="1" opacity="0.35" strokeDasharray="4 8">
          <animateTransform attributeName="transform" type="rotate" from="120 150 150" to="480 150 150" dur="20s" repeatCount="indefinite" />
        </ellipse>

        {/* Orbiting nodes */}
        {[
          { rx: 130, ry: 130, dur: '12s', r: 4, color: '#7c3aed', startAngle: 0 },
          { rx: 130, ry: 130, dur: '12s', r: 3, color: '#06b6d4', startAngle: 180 },
          { rx: 100, ry: 60, dur: '8s', r: 3.5, color: '#a78bfa', startAngle: 90 },
          { rx: 70, ry: 100, dur: '15s', r: 3, color: '#06b6d4', startAngle: 270 },
          { rx: 100, ry: 60, dur: '8s', r: 2.5, color: '#7c3aed', startAngle: 45 },
        ].map((node, i) => {
          const rad = (node.startAngle * Math.PI) / 180;
          const cx = 150 + node.rx * Math.cos(rad);
          const cy = 150 + node.ry * Math.sin(rad);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={node.r} fill={node.color} opacity="0.8">
                <animateTransform attributeName="transform" type="rotate" from={`${node.startAngle} 150 150`} to={`${node.startAngle + 360} 150 150`} dur={node.dur} repeatCount="indefinite" />
              </circle>
              <circle cx={cx} cy={cy} r={node.r * 2.5} fill={node.color} opacity="0.15">
                <animateTransform attributeName="transform" type="rotate" from={`${node.startAngle} 150 150`} to={`${node.startAngle + 360} 150 150`} dur={node.dur} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.1;0.25;0.1" dur="3s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {/* Intersection glow nodes (stationary) */}
        {[
          [150, 20], [280, 150], [150, 280], [20, 150],
          [220, 90], [80, 210], [220, 210], [80, 90],
        ].map(([x, y], i) => (
          <circle key={`glow-${i}`} cx={x} cy={y} r="2" fill="#a78bfa" opacity="0.5">
            <animate attributeName="opacity" values="0.2;0.7;0.2" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" begin={`${i * 0.4}s`} />
            <animate attributeName="r" values="1.5;3;1.5" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" begin={`${i * 0.4}s`} />
          </circle>
        ))}

        {/* Central core orb */}
        <circle cx="150" cy="150" r="25" fill="#0a0612" stroke="url(#ring1)" strokeWidth="1.5" opacity="0.8" />
        <circle cx="150" cy="150" r="18" fill="url(#ring1)" opacity="0.15" />
        <text x="150" y="157" textAnchor="middle" fontSize="22" className="select-none">🧠</text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add applications/website/src/components/BrainIllustration.tsx
git commit -m "feat(website): add isometric brain illustration component"
```

---

### Task 4: Create DiscordChat Component

**Files:**
- Create: `applications/website/src/components/DiscordChat.tsx`

- [ ] **Step 1: Create the reusable Discord chat mockup**

```tsx
// applications/website/src/components/DiscordChat.tsx
export interface ChatMessage {
  username: string;
  avatar: string;
  avatarColor: string;
  content: string;
  isBot?: boolean;
  timestamp?: string;
}

export interface ChatDay {
  label: string;
  messages: ChatMessage[];
}

export default function DiscordChat({
  days,
  className = '',
}: {
  days: ChatDay[];
  className?: string;
}) {
  return (
    <div className={`rounded-xl overflow-hidden shadow-2xl shadow-black/40 ${className}`} style={{ background: '#313338' }}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5" style={{ background: '#2b2d31' }}>
        <span className="text-[#80848e] text-sm font-semibold"># general</span>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-1">
        {days.map((day, di) => (
          <div key={di}>
            {/* Day divider */}
            <div className="flex items-center gap-3 my-4 first:mt-0">
              <div className="flex-1 h-px" style={{ background: '#3f4147' }} />
              <span className="text-[11px] font-semibold" style={{ color: '#80848e' }}>{day.label}</span>
              <div className="flex-1 h-px" style={{ background: '#3f4147' }} />
            </div>

            {day.messages.map((msg, mi) => (
              <div key={mi} className="flex items-start gap-3 py-1 px-1 rounded hover:bg-white/[0.02] group">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                  style={{ background: msg.isBot ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : msg.avatarColor }}
                >
                  {msg.isBot ? '🧠' : msg.avatar}
                </div>

                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm" style={{ color: msg.isBot ? '#7c3aed' : msg.avatarColor }}>
                      {msg.username}
                    </span>
                    {msg.isBot && (
                      <span className="text-[10px] font-semibold px-1 py-0.5 rounded" style={{ background: '#5865f2', color: 'white' }}>
                        BOT
                      </span>
                    )}
                    {msg.timestamp && (
                      <span className="text-[11px]" style={{ color: '#80848e' }}>{msg.timestamp}</span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5 leading-relaxed" style={{ color: '#dbdee1' }}>
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add applications/website/src/components/DiscordChat.tsx
git commit -m "feat(website): add reusable DiscordChat mockup component"
```

---

### Task 5: Create Feature Illustration Components

**Files:**
- Create: `applications/website/src/components/features/MemoryTimeline.tsx`
- Create: `applications/website/src/components/features/LorePanel.tsx`
- Create: `applications/website/src/components/features/RecallRadar.tsx`
- Create: `applications/website/src/components/features/ProfileStack.tsx`

- [ ] **Step 1: Create MemoryTimeline**

```tsx
// applications/website/src/components/features/MemoryTimeline.tsx
export default function MemoryTimeline() {
  const nodes = [
    { y: 30, label: '2 weeks ago', size: 8, text: 'movie night debate...', color: '#7c3aed' },
    { y: 100, label: '1 week ago', size: 10, text: 'Sam recommended ramen', color: '#a78bfa' },
    { y: 170, label: '3 days ago', size: 13, text: 'hiking trip photos 🏔️', color: '#06b6d4' },
    { y: 240, label: 'yesterday', size: 15, text: 'karaoke plans Friday', color: '#7c3aed' },
    { y: 310, label: 'now', size: 18, text: 'asking about plans...', color: '#06b6d4' },
  ];

  return (
    <div className="relative w-full max-w-md mx-auto h-[380px]">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 380" fill="none">
        <defs>
          <linearGradient id="timeline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Timeline line */}
        <line x1="80" y1="20" x2="80" y2="360" stroke="url(#timeline-grad)" strokeWidth="2" />

        {/* Nodes */}
        {nodes.map((n, i) => (
          <g key={i} opacity="0" className="animate-fade-in-up" style={{ animationDelay: `${i * 200}ms`, animationFillMode: 'forwards' }}>
            {/* Glow */}
            <circle cx="80" cy={n.y + 15} r={n.size * 1.5} fill={n.color} opacity="0.1">
              <animate attributeName="opacity" values="0.05;0.15;0.05" dur={`${3 + i}s`} repeatCount="indefinite" />
            </circle>
            {/* Core dot */}
            <circle cx="80" cy={n.y + 15} r={n.size / 2} fill={n.color} opacity="0.8" />
            {/* Connection dashes to card */}
            <line x1={80 + n.size / 2 + 4} y1={n.y + 15} x2="140" y2={n.y + 15} stroke={n.color} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
            {/* Card */}
            <rect x="140" y={n.y} width="220" height="30" rx="8" fill="white" fillOpacity="0.03" stroke="white" strokeOpacity="0.06" strokeWidth="1" />
            <text x="152" y={n.y + 19} fill="#e8e0f0" fontSize="11" fontFamily="var(--font-sans)">{n.text}</text>
            {/* Timestamp */}
            <text x="82" y={n.y + 35} fill="#6b5a85" fontSize="9" fontFamily="var(--font-sans)">{n.label}</text>
          </g>
        ))}

        {/* Pulse at bottom */}
        <circle cx="80" cy="325" r="18" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.4">
          <animate attributeName="r" values="18;28;18" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Memory bank glow at bottom */}
        <rect x="30" y="340" width="100" height="24" rx="12" fill="none" stroke="#7c3aed" strokeWidth="1" opacity="0.3">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" />
        </rect>
        <text x="80" y="356" textAnchor="middle" fill="#7c3aed" fontSize="8" fontFamily="var(--font-sans)" opacity="0.6">MEMORY STORED</text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Create LorePanel**

```tsx
// applications/website/src/components/features/LorePanel.tsx
export default function LorePanel() {
  const lines = [
    { prefix: 'personality:', value: '"Friendly and witty"', color: '#7c3aed' },
    { prefix: 'context:', value: '"Gaming community since 2021"', color: '#06b6d4' },
    { prefix: 'rules:', value: '"No spoilers in #general"', color: '#a78bfa' },
    { prefix: 'tone:', value: '"Helpful party member"', color: '#f472b6' },
  ];

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ perspective: '600px' }}>
      {/* Card glow */}
      <div className="absolute inset-0 rounded-2xl bg-cyan/5 blur-2xl scale-110" />

      {/* Floating config card */}
      <div
        className="relative glass rounded-2xl overflow-hidden border-cyan/10"
        style={{ transform: 'rotateY(-6deg) rotateX(4deg)' }}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan/60" />
            <span className="text-text-dim text-[11px] uppercase tracking-wider font-semibold">Server Lore</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div className="w-2 h-2 rounded-full bg-white/10" />
          </div>
        </div>

        {/* Content */}
        <div className="p-5 font-mono text-[13px] leading-loose space-y-1">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 overflow-hidden">
              <span style={{ color: line.color }} className="opacity-70 shrink-0">{line.prefix}</span>
              <span className="text-text-muted">{line.value}</span>
            </div>
          ))}
        </div>

        {/* Cursor line */}
        <div className="px-5 pb-4 font-mono text-[13px]">
          <span className="text-purple/70">add_rule: </span>
          <span className="inline-block w-2 h-4 bg-purple/50 animate-pulse-glow align-middle" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create RecallRadar**

```tsx
// applications/website/src/components/features/RecallRadar.tsx
export default function RecallRadar() {
  const matches = [
    { angle: 30, distance: 0.55, label: '94%', color: '#7c3aed' },
    { angle: 150, distance: 0.7, label: '82%', color: '#a78bfa' },
    { angle: 260, distance: 0.85, label: '71%', color: '#06b6d4' },
  ];

  const dimNodes = [
    { angle: 80, distance: 0.9 },
    { angle: 190, distance: 0.6 },
    { angle: 310, distance: 0.75 },
    { angle: 350, distance: 0.5 },
    { angle: 120, distance: 0.95 },
  ];

  const cx = 200;
  const cy = 200;
  const maxR = 160;

  return (
    <div className="relative w-full max-w-md mx-auto">
      <svg viewBox="0 0 400 400" fill="none" className="w-full">
        {/* Sonar pulse rings */}
        {[1, 2, 3].map((i) => (
          <circle key={i} cx={cx} cy={cy} r="30" fill="none" stroke="#7c3aed" strokeWidth="0.5" opacity="0.3">
            <animate attributeName="r" values="30;160;30" dur="4s" repeatCount="indefinite" begin={`${i * 1.3}s`} />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="4s" repeatCount="indefinite" begin={`${i * 1.3}s`} />
          </circle>
        ))}

        {/* Background grid rings */}
        {[0.33, 0.66, 1].map((pct, i) => (
          <circle key={i} cx={cx} cy={cy} r={maxR * pct} fill="none" stroke="white" strokeWidth="0.3" opacity="0.05" />
        ))}

        {/* Center search node */}
        <circle cx={cx} cy={cy} r="16" fill="#7c3aed" opacity="0.2" />
        <circle cx={cx} cy={cy} r="8" fill="#7c3aed" opacity="0.6" />
        {/* Magnifying glass icon */}
        <circle cx={cx - 2} cy={cy - 2} r="4" fill="none" stroke="white" strokeWidth="1.5" opacity="0.8" />
        <line x1={cx + 1} y1={cy + 1} x2={cx + 4} y2={cy + 4} stroke="white" strokeWidth="1.5" opacity="0.8" strokeLinecap="round" />

        {/* Dim (non-matching) nodes */}
        {dimNodes.map((n, i) => {
          const rad = (n.angle * Math.PI) / 180;
          const nx = cx + maxR * n.distance * Math.cos(rad);
          const ny = cy + maxR * n.distance * Math.sin(rad);
          return <circle key={`dim-${i}`} cx={nx} cy={ny} r="3" fill="#6b5a85" opacity="0.2" />;
        })}

        {/* Matching nodes with connection lines */}
        {matches.map((m, i) => {
          const rad = (m.angle * Math.PI) / 180;
          const nx = cx + maxR * m.distance * Math.cos(rad);
          const ny = cy + maxR * m.distance * Math.sin(rad);
          return (
            <g key={i}>
              {/* Connection line */}
              <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={m.color} strokeWidth="1" opacity="0.3" strokeDasharray="4 4">
                <animate attributeName="opacity" values="0.1;0.4;0.1" dur="3s" repeatCount="indefinite" begin={`${i * 0.5}s`} />
              </line>
              {/* Node glow */}
              <circle cx={nx} cy={ny} r="12" fill={m.color} opacity="0.1">
                <animate attributeName="opacity" values="0.05;0.2;0.05" dur="2s" repeatCount="indefinite" />
              </circle>
              {/* Node */}
              <circle cx={nx} cy={ny} r="5" fill={m.color} opacity="0.8" />
              {/* Score badge */}
              <rect x={nx + 8} y={ny - 10} width="30" height="16" rx="4" fill={m.color} fillOpacity="0.15" stroke={m.color} strokeOpacity="0.3" strokeWidth="0.5" />
              <text x={nx + 23} y={ny + 1} textAnchor="middle" fill={m.color} fontSize="9" fontFamily="var(--font-sans)" fontWeight="bold">{m.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Create ProfileStack**

```tsx
// applications/website/src/components/features/ProfileStack.tsx
export default function ProfileStack() {
  const profiles = [
    { name: 'Alex', tags: ['Loves hiking', 'Night owl'], color: '#7c3aed', z: 30, rotate: -8 },
    { name: 'Sam', tags: ['Python dev', 'Foodie'], color: '#06b6d4', z: 15, rotate: 0 },
    { name: 'Jordan', tags: ['Casual gamer', 'Pun lover'], color: '#f472b6', z: 0, rotate: 6 },
  ];

  return (
    <div className="relative w-full max-w-sm mx-auto h-[320px]" style={{ perspective: '800px' }}>
      {profiles.map((p, i) => (
        <div
          key={p.name}
          className="absolute left-1/2 glass rounded-2xl p-5 w-52 transition-transform duration-500 hover:-translate-y-2"
          style={{
            transform: `translateX(-50%) rotateX(8deg) rotateY(${p.rotate}deg) translateZ(${p.z}px)`,
            top: `${i * 70 + 20}px`,
            zIndex: profiles.length - i,
          }}
        >
          {/* Avatar */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: p.color }}
            >
              {p.name[0]}
            </div>
            <div>
              <p className="text-text font-semibold text-sm">{p.name}</p>
              <p className="text-text-dim text-[10px]">Member</p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: `${p.color}15`, color: p.color }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify all compile**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add applications/website/src/components/features/
git commit -m "feat(website): add feature illustration components (timeline, lore, radar, profiles)"
```

---

### Task 6: Create Nav and Footer Components (Extract)

**Files:**
- Create: `applications/website/src/components/Nav.tsx`
- Create: `applications/website/src/components/Footer.tsx`

- [ ] **Step 1: Create Nav.tsx**

Extract the `Nav` function from `page.tsx` (lines 189-213) into its own file. Move the `DISCORD_INVITE` constant to a shared constants location at the top of `Nav.tsx`:

```tsx
// applications/website/src/components/Nav.tsx
export const DISCORD_INVITE = 'https://discord.com/oauth2/authorize?client_id=1485441632835866786&permissions=274877910016&scope=bot+applications.commands';
export const DASHBOARD_URL = 'https://contexta-bot.vercel.app';

export default function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border">
      <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between backdrop-blur-xl bg-bg/60">
        <div className="flex items-center gap-6">
          <a href="#" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple to-cyan flex items-center justify-center text-white text-xs font-bold">
              C
            </div>
            <span className="font-bold text-sm text-text">Contexta</span>
          </a>
          <div className="hidden sm:flex items-center gap-5 text-[13px] text-text-muted">
            <a href="#features" className="hover:text-text transition">Features</a>
            <a href="#how-it-works" className="hover:text-text transition">How It Works</a>
          </div>
        </div>
        <a
          href={DISCORD_INVITE}
          className="rounded-lg bg-blurple px-4 py-1.5 text-white text-[13px] font-semibold hover:bg-blurple-hover transition shadow-lg shadow-blurple/20"
        >
          Add to Discord
        </a>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create Footer.tsx**

```tsx
// applications/website/src/components/Footer.tsx
import { DISCORD_INVITE, DASHBOARD_URL } from './Nav';

export default function Footer() {
  return (
    <footer className="border-t border-border px-6 py-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-text-dim">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple to-cyan flex items-center justify-center text-white text-[8px] font-bold">
            C
          </div>
          <span>Contexta</span>
        </div>
        <div className="flex items-center gap-5">
          <a href={DASHBOARD_URL} className="hover:text-text-muted transition">Dashboard</a>
          <a href={DISCORD_INVITE} className="hover:text-text-muted transition">Add to Discord</a>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add applications/website/src/components/Nav.tsx applications/website/src/components/Footer.tsx
git commit -m "feat(website): extract Nav and Footer into separate components"
```

---

### Task 7: Create Hero Section Component

**Files:**
- Create: `applications/website/src/components/Hero.tsx`

- [ ] **Step 1: Create Hero.tsx**

This uses `BrainIllustration`, `DiscordChat`, and `GlowBlob`:

```tsx
// applications/website/src/components/Hero.tsx
import BrainIllustration from './BrainIllustration';
import DiscordChat from './DiscordChat';
import GlowBlob from './GlowBlob';
import { DISCORD_INVITE, DASHBOARD_URL } from './Nav';

const HERO_CHAT = [
  {
    label: 'Today',
    messages: [
      { username: 'Alex', avatar: 'A', avatarColor: '#5865f2', content: 'hey what was the name of that restaurant Sam recommended last week?', timestamp: '2:34 PM' },
      { username: 'Contexta', avatar: '🧠', avatarColor: '#7c3aed', content: 'Sam recommended Sakura Ramen last Tuesday — said the spicy miso was "life-changing" 🍜', isBot: true, timestamp: '2:34 PM' },
    ],
  },
];

function ConstellationBg() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.08]" viewBox="0 0 1200 800" fill="none" preserveAspectRatio="xMidYMid slice">
      {[
        [150, 120], [320, 200], [480, 100], [620, 280], [800, 150],
        [950, 250], [1050, 120], [200, 400], [400, 350], [600, 450],
        [750, 380], [900, 480], [1100, 400], [100, 600], [300, 550],
        [500, 650], [700, 580], [850, 650], [1000, 600],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="2" fill="#7c3aed" opacity="0.6">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} />
          </circle>
        </g>
      ))}
      {[
        [150, 120, 320, 200], [320, 200, 480, 100], [480, 100, 620, 280],
        [620, 280, 800, 150], [800, 150, 950, 250], [200, 400, 400, 350],
        [400, 350, 600, 450], [600, 450, 750, 380], [750, 380, 900, 480],
        [100, 600, 300, 550], [300, 550, 500, 650], [500, 650, 700, 580],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={`l-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7c3aed" strokeWidth="0.5" opacity="0.15" />
      ))}
    </svg>
  );
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-14 overflow-hidden">
      <ConstellationBg />
      <GlowBlob color="purple" size={500} className="top-1/4 left-1/4 animate-float-slow" />
      <GlowBlob color="cyan" size={400} className="bottom-1/3 right-1/4 animate-float" />

      <div className="relative z-10 text-center max-w-2xl animate-fade-in-up">
        <BrainIllustration size="lg" />

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mt-8">
          Your server&apos;s
          <br />
          <span className="bg-gradient-to-r from-purple via-[#a78bfa] to-cyan bg-clip-text text-transparent">
            memory.
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-text-muted max-w-md mx-auto leading-relaxed">
          An AI that actually knows your community. Remembers conversations, learns your culture, and gets better over time.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
          <a
            href={DISCORD_INVITE}
            className="group inline-flex items-center gap-2.5 rounded-xl bg-blurple px-6 py-3 text-white font-semibold text-sm hover:bg-blurple-hover transition-colors shadow-lg shadow-blurple/25"
          >
            <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" className="opacity-90">
              <path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.2a.2.2 0 0 0-.2.1 40.6 40.6 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37 37 0 0 0 25.4.3a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.4 5a.2.2 0 0 0-.1 0A59.7 59.7 0 0 0 .2 45.3a.2.2 0 0 0 .1.2A58.8 58.8 0 0 0 18 54.7a.2.2 0 0 0 .3-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.8 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .3 36.4 36.4 0 0 1-5.5 2.7.2.2 0 0 0-.1.3 47.2 47.2 0 0 0 3.6 5.8.2.2 0 0 0 .3.1A58.6 58.6 0 0 0 70.7 45.4a.2.2 0 0 0 .1-.1A59.5 59.5 0 0 0 60.2 5a.2.2 0 0 0 0 0ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 4-2.8 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 4-2.9 7.2-6.4 7.2Z" />
            </svg>
            Add to Discord
          </a>
          <a
            href={DASHBOARD_URL}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-text-muted font-semibold text-sm hover:text-text hover:border-purple/30 transition-all"
          >
            Open Dashboard
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h7v7" /><path d="M13 3L6 10" />
            </svg>
          </a>
        </div>

        {/* Discord chat mockup */}
        <div className="mt-16 max-w-lg mx-auto animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <DiscordChat days={HERO_CHAT} />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-text-dim text-xs flex flex-col items-center gap-2 animate-pulse-glow">
        <span>scroll</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 6 8 10 12 6" />
        </svg>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add applications/website/src/components/Hero.tsx
git commit -m "feat(website): add Hero section with brain illustration and Discord chat"
```

---

### Task 8: Create Features Section Component

**Files:**
- Create: `applications/website/src/components/Features.tsx`

- [ ] **Step 1: Create Features.tsx with alternating full-width rows**

```tsx
// applications/website/src/components/Features.tsx
import ScrollReveal from './ScrollReveal';
import GlowBlob from './GlowBlob';
import MemoryTimeline from './features/MemoryTimeline';
import LorePanel from './features/LorePanel';
import RecallRadar from './features/RecallRadar';
import ProfileStack from './features/ProfileStack';

const FEATURES = [
  {
    icon: '🧠',
    title: 'Long-Term Memory',
    description: 'Remembers conversations across channels and time. Yesterday\'s inside joke? Last month\'s game night plans? It\'s all there.',
    accent: '#7c3aed',
    illustration: <MemoryTimeline />,
  },
  {
    icon: '📜',
    title: 'Server Lore',
    description: 'Define your server\'s personality, rules, and lore. Contexta weaves it into every response — your culture, your bot.',
    accent: '#06b6d4',
    illustration: <LorePanel />,
  },
  {
    icon: '🔮',
    title: 'Semantic Recall',
    description: 'Search by meaning, not keywords. Ask "what did we decide about movie night?" and get the actual answer.',
    accent: '#a78bfa',
    illustration: <RecallRadar />,
  },
  {
    icon: '👤',
    title: 'Personal Profiles',
    description: 'Knows each member\'s preferences, tone, and context. Talks to everyone like it actually knows them — because it does.',
    accent: '#f472b6',
    illustration: <ProfileStack />,
  },
];

export default function Features() {
  return (
    <section id="features" className="relative px-6 py-24 sm:py-32">
      <div className="divider mb-24" />

      <GlowBlob color="purple" size={400} className="top-1/4 -left-48" />
      <GlowBlob color="cyan" size={300} className="top-2/3 -right-32" />

      <div className="relative max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <p className="text-purple text-xs font-semibold uppercase tracking-[3px] mb-3">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Knowledge that grows with your community
          </h2>
          <p className="mt-4 text-text-muted max-w-md mx-auto">
            Not just another chatbot. Contexta builds a living memory of your server.
          </p>
        </div>

        <div className="space-y-24 lg:space-y-32">
          {FEATURES.map((f, i) => {
            const isReversed = i % 2 === 1;
            return (
              <ScrollReveal key={f.title} className="reveal">
                <div className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-16`}>
                  {/* Illustration */}
                  <div className="flex-1 w-full max-w-md lg:max-w-none">
                    {f.illustration}
                  </div>

                  {/* Text */}
                  <div className="flex-1 text-center lg:text-left">
                    <div
                      className="inline-flex w-14 h-14 rounded-2xl items-center justify-center text-2xl mb-5 border border-white/5"
                      style={{ background: `${f.accent}15` }}
                    >
                      {f.icon}
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold mb-4">{f.title}</h3>
                    <p className="text-text-muted text-base sm:text-lg leading-relaxed max-w-md mx-auto lg:mx-0">
                      {f.description}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add applications/website/src/components/Features.tsx
git commit -m "feat(website): add Features section with alternating full-width illustration rows"
```

---

### Task 9: Create "See It In Action" Section

**Files:**
- Create: `applications/website/src/components/SeeItInAction.tsx`

- [ ] **Step 1: Create SeeItInAction.tsx**

```tsx
// applications/website/src/components/SeeItInAction.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import DiscordChat from './DiscordChat';
import type { ChatDay } from './DiscordChat';
import GlowBlob from './GlowBlob';
import Particles from './Particles';

const DAY_1: ChatDay = {
  label: 'Monday, March 24',
  messages: [
    { username: 'Alex', avatar: 'A', avatarColor: '#5865f2', content: 'just got back from an amazing hike at Mt. Rainier 🏔️', timestamp: '4:23 PM' },
    { username: 'Jordan', avatar: 'J', avatarColor: '#57f287', content: "jealous! I've been stuck inside all week", timestamp: '4:25 PM' },
  ],
};

const DAY_3: ChatDay = {
  label: 'Wednesday, March 26',
  messages: [
    { username: 'Jordan', avatar: 'J', avatarColor: '#57f287', content: '@Contexta any birthday gift ideas for Alex?', timestamp: '11:42 AM' },
    { username: 'Contexta', avatar: '🧠', avatarColor: '#7c3aed', content: 'Alex mentioned loving hiking at Mt. Rainier a couple days ago! Maybe a National Parks pass, a trail guide for the PNW, or some nice hiking gear? 🎁', isBot: true, timestamp: '11:42 AM' },
  ],
};

export default function SeeItInAction() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0); // 0=hidden, 1=day1, 2=day3, 3=lines

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase(1);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase === 0) return;
    if (phase === 1) {
      const t = setTimeout(() => setPhase(2), 1500);
      return () => clearTimeout(t);
    }
    if (phase === 2) {
      const t = setTimeout(() => setPhase(3), 2500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const visibleDays: ChatDay[] = [];
  if (phase >= 1) visibleDays.push(DAY_1);
  if (phase >= 2) visibleDays.push(DAY_3);

  return (
    <section ref={sectionRef} className="relative px-6 py-32 sm:py-40 overflow-hidden">
      <div className="divider mb-24" />

      {/* Background */}
      <GlowBlob color="purple" size={600} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <Particles count={25} color="#7c3aed" />

      <div className="relative max-w-2xl mx-auto text-center">
        <p className="text-purple text-xs font-semibold uppercase tracking-[3px] mb-3">See It In Action</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Memory that connects the dots
        </h2>
        <p className="text-text-muted mb-16 max-w-md mx-auto">
          Watch how Contexta recalls a conversation from days ago to give the perfect answer.
        </p>

        {/* Chat + memory lines wrapper */}
        <div className="relative">
          {/* Discord chat */}
          <div
            className="transition-all duration-700"
            style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'translateY(0)' : 'translateY(20px)' }}
          >
            {visibleDays.length > 0 && <DiscordChat days={visibleDays} />}
          </div>

          {/* Memory connection line overlay */}
          {phase >= 3 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 10 }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="mem-line" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              {/* Arc from bot response area to day1 message area */}
              <path
                d="M 70 82 C 85 60, 85 40, 55 22"
                fill="none"
                stroke="url(#mem-line)"
                strokeWidth="0.4"
                opacity="0.6"
                strokeDasharray="200"
                strokeDashoffset="200"
                strokeLinecap="round"
              >
                <animate attributeName="stroke-dashoffset" from="200" to="0" dur="1s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" />
              </path>
              {/* Glow duplicate */}
              <path
                d="M 70 82 C 85 60, 85 40, 55 22"
                fill="none"
                stroke="url(#mem-line)"
                strokeWidth="1.2"
                opacity="0.15"
                strokeDasharray="200"
                strokeDashoffset="200"
                strokeLinecap="round"
              >
                <animate attributeName="stroke-dashoffset" from="200" to="0" dur="1s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" />
              </path>
              {/* "Memory retrieved" badge at midpoint */}
              <g opacity="0">
                <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="0.8s" fill="freeze" />
                <rect x="72" y="48" width="22" height="7" rx="3.5" fill="#7c3aed" fillOpacity="0.2" stroke="#7c3aed" strokeOpacity="0.4" strokeWidth="0.2" />
                <text x="83" y="53" textAnchor="middle" fill="#a78bfa" fontSize="3" fontFamily="var(--font-sans)">memory</text>
              </g>
            </svg>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add applications/website/src/components/SeeItInAction.tsx
git commit -m "feat(website): add See It In Action section with animated Discord replay and memory lines"
```

---

### Task 10: Create HowItWorks Section Component

**Files:**
- Create: `applications/website/src/components/HowItWorks.tsx`

- [ ] **Step 1: Create HowItWorks.tsx with isometric illustrations and glowing path**

```tsx
// applications/website/src/components/HowItWorks.tsx
import ScrollReveal from './ScrollReveal';

const STEPS = [
  {
    num: '1',
    title: 'Add to Discord',
    description: 'One click to invite Contexta to your server.',
    color: '#7c3aed',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" className="w-20 h-20 mx-auto" style={{ transform: 'rotateY(-10deg) rotateX(5deg)' }}>
        {/* Discord logo stylized */}
        <circle cx="60" cy="60" r="50" fill="#5865f2" opacity="0.15" />
        <circle cx="60" cy="60" r="35" fill="#5865f2" opacity="0.1" />
        <path d="M78 42.3a44.4 44.4 0 0 0-11.2-3.5.2.2 0 0 0-.1.1 31.6 31.6 0 0 0-1.4 2.8 41 41 0 0 0-12.3 0 28 28 0 0 0-1.4-2.8.2.2 0 0 0-.1-.1A44.3 44.3 0 0 0 40.3 42.3a.1.1 0 0 0-.1 0 45.3 45.3 0 0 0-7.7 30.6.2.2 0 0 0 0 .1 44.6 44.6 0 0 0 13.4 6.8.2.2 0 0 0 .2-.1 31.8 31.8 0 0 0 2.7-4.5.2.2 0 0 0-.1-.2 29.4 29.4 0 0 1-4.2-2 .2.2 0 0 1 0-.3l.8-.7a.2.2 0 0 1 .2 0 31.8 31.8 0 0 0 27.2 0 .2.2 0 0 1 .2 0l.8.7a.2.2 0 0 1 0 .3 27.6 27.6 0 0 1-4.2 2 .2.2 0 0 0 0 .2 35.8 35.8 0 0 0 2.7 4.5.2.2 0 0 0 .2 0A44.5 44.5 0 0 0 86.1 73a.2.2 0 0 0 0-.1A45.1 45.1 0 0 0 78.1 42.3ZM50 66.7c-2.7 0-4.9-2.4-4.9-5.4s2.1-5.4 4.9-5.4 5 2.5 4.9 5.4c0 3-2.1 5.4-4.9 5.4Zm17.9 0c-2.7 0-4.9-2.4-4.9-5.4s2.1-5.4 4.9-5.4 5 2.5 4.9 5.4c0 3-2.2 5.4-4.9 5.4Z" fill="#5865f2" opacity="0.7" transform="scale(0.75) translate(20 20)" />
        {/* Plus badge */}
        <circle cx="95" cy="25" r="14" fill="#7c3aed" opacity="0.8" />
        <line x1="95" y1="19" x2="95" y2="31" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="89" y1="25" x2="101" y2="25" stroke="white" strokeWidth="2" strokeLinecap="round" />
        {/* Glow */}
        <circle cx="95" cy="25" r="14" fill="none" stroke="#7c3aed" strokeWidth="1" opacity="0.4">
          <animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    ),
  },
  {
    num: '2',
    title: 'Set your lore',
    description: 'Tell it your server\'s personality and rules.',
    color: '#06b6d4',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" className="w-20 h-20 mx-auto" style={{ transform: 'rotateY(5deg) rotateX(8deg)' }}>
        {/* Book */}
        <rect x="25" y="20" width="70" height="80" rx="4" fill="white" fillOpacity="0.03" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.3" />
        <line x1="60" y1="20" x2="60" y2="100" stroke="#06b6d4" strokeWidth="0.5" opacity="0.2" />
        {/* Page lines */}
        {[35, 45, 55, 65].map((y) => (
          <g key={y}>
            <line x1="35" y1={y} x2="55" y2={y} stroke="#06b6d4" strokeWidth="0.8" opacity="0.3" />
            <line x1="65" y1={y} x2="85" y2={y} stroke="#06b6d4" strokeWidth="0.8" opacity="0.2" />
          </g>
        ))}
        {/* Glow */}
        <rect x="25" y="20" width="70" height="80" rx="4" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.2">
          <animate attributeName="opacity" values="0.1;0.4;0.1" dur="3s" repeatCount="indefinite" />
        </rect>
      </svg>
    ),
  },
  {
    num: '3',
    title: 'It learns',
    description: 'Contexta builds knowledge from every conversation.',
    color: '#a78bfa',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" className="w-20 h-20 mx-auto">
        {/* Neural network nodes */}
        {[
          [40, 30], [80, 30], [60, 55], [35, 75], [60, 90], [85, 75], [20, 50], [100, 50],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="5" fill="#a78bfa" opacity="0.6">
              <animate attributeName="r" values="4;6;4" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} />
            </circle>
            <circle cx={x} cy={y} r="8" fill="#a78bfa" opacity="0.1">
              <animate attributeName="opacity" values="0.05;0.15;0.05" dur="3s" repeatCount="indefinite" />
            </circle>
          </g>
        ))}
        {/* Connections */}
        {[
          [40, 30, 60, 55], [80, 30, 60, 55], [60, 55, 35, 75], [60, 55, 85, 75],
          [35, 75, 60, 90], [85, 75, 60, 90], [20, 50, 40, 30], [100, 50, 80, 30],
          [20, 50, 35, 75], [100, 50, 85, 75], [40, 30, 80, 30],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={`c-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a78bfa" strokeWidth="0.5" opacity="0.25">
            <animate attributeName="opacity" values="0.1;0.35;0.1" dur={`${3 + (i % 2)}s`} repeatCount="indefinite" />
          </line>
        ))}
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-6 py-24 sm:py-32">
      <div className="divider mb-24" />
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-cyan text-xs font-semibold uppercase tracking-[3px] mb-3">How It Works</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Three steps. Zero config headaches.
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-8 relative">
          {/* Glowing connecting path */}
          <svg className="hidden sm:block absolute top-16 left-[18%] right-[18%] h-2 overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="path-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <line x1="0" y1="1" x2="100%" y2="1" stroke="url(#path-grad)" strokeWidth="1.5" opacity="0.3" />
            {/* Animated glow traveling along the line */}
            <circle r="4" fill="#7c3aed" opacity="0.6">
              <animateMotion dur="4s" repeatCount="indefinite" path="M 0,1 L 1000,1" />
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur="4s" repeatCount="indefinite" />
            </circle>
          </svg>

          {STEPS.map((s, i) => (
            <ScrollReveal key={s.num} className="reveal" threshold={0.3}>
              <div className="text-center relative">
                <div className="relative mb-6">
                  {s.illustration}
                  <div
                    className="absolute -top-1 right-1/2 translate-x-10 w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${s.color}, #06b6d4)`, boxShadow: `0 0 20px ${s.color}40` }}
                  >
                    {s.num}
                  </div>
                </div>
                <h3 className="font-bold text-base mb-1">{s.title}</h3>
                <p className="text-text-muted text-sm">{s.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add applications/website/src/components/HowItWorks.tsx
git commit -m "feat(website): add HowItWorks section with isometric step illustrations and glowing path"
```

---

### Task 11: Create FinalCTA Section Component

**Files:**
- Create: `applications/website/src/components/FinalCTA.tsx`

- [ ] **Step 1: Create FinalCTA.tsx with brain illustration callback**

```tsx
// applications/website/src/components/FinalCTA.tsx
import BrainIllustration from './BrainIllustration';
import GlowBlob from './GlowBlob';
import Particles from './Particles';
import ScrollReveal from './ScrollReveal';
import { DISCORD_INVITE } from './Nav';

export default function FinalCTA() {
  return (
    <section className="relative px-6 py-24 sm:py-32 overflow-hidden">
      <div className="divider mb-24" />

      <GlowBlob color="purple" size={600} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <Particles count={15} color="#a78bfa" />

      <ScrollReveal className="reveal">
        <div className="relative max-w-lg mx-auto text-center">
          <BrainIllustration size="sm" />

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 mt-8">
            Ready to give your server a brain?
          </h2>
          <p className="text-text-muted mb-10">
            Free to use. Takes 30 seconds to set up. Your community will thank you.
          </p>
          <a
            href={DISCORD_INVITE}
            className="group inline-flex items-center gap-2.5 rounded-xl bg-blurple px-8 py-4 text-white font-semibold hover:bg-blurple-hover transition-colors shadow-lg shadow-blurple/25"
          >
            <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" className="opacity-90">
              <path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.2a.2.2 0 0 0-.2.1 40.6 40.6 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37 37 0 0 0 25.4.3a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.4 5a.2.2 0 0 0-.1 0A59.7 59.7 0 0 0 .2 45.3a.2.2 0 0 0 .1.2A58.8 58.8 0 0 0 18 54.7a.2.2 0 0 0 .3-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.8 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .3 36.4 36.4 0 0 1-5.5 2.7.2.2 0 0 0-.1.3 47.2 47.2 0 0 0 3.6 5.8.2.2 0 0 0 .3.1A58.6 58.6 0 0 0 70.7 45.4a.2.2 0 0 0 .1-.1A59.5 59.5 0 0 0 60.2 5a.2.2 0 0 0 0 0ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 4-2.8 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 4-2.9 7.2-6.4 7.2Z" />
            </svg>
            Add to Discord
          </a>
        </div>
      </ScrollReveal>
    </section>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add applications/website/src/components/FinalCTA.tsx
git commit -m "feat(website): add FinalCTA section with brain illustration callback"
```

---

### Task 12: Rewrite page.tsx to Compose Components

**Files:**
- Modify: `applications/website/src/app/page.tsx`

- [ ] **Step 1: Replace the entire page.tsx with the slim composition**

Replace the full contents of `applications/website/src/app/page.tsx` with:

```tsx
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import Features from '../components/Features';
import SeeItInAction from '../components/SeeItInAction';
import HowItWorks from '../components/HowItWorks';
import FinalCTA from '../components/FinalCTA';
import Footer from '../components/Footer';

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <Nav />
      <Hero />
      <Features />
      <SeeItInAction />
      <HowItWorks />
      <FinalCTA />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 2: Build and verify**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm --filter @contexta/website build`
Expected: Build succeeds with no errors. The page should compose all sections.

- [ ] **Step 3: Commit**

```bash
git add applications/website/src/app/page.tsx
git commit -m "feat(website): rewrite page.tsx to compose extracted section components"
```

---

### Task 13: Visual Verification

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/iser/workspace/contexta-bot && pnpm dev:website`

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5001` and check:
- Nav renders with logo, links, and Discord button
- Hero shows brain illustration, heading, CTAs, and Discord chat mockup
- Features shows 4 alternating rows with large illustrations
- "See It In Action" section appears with animated Discord replay
- How It Works shows 3 steps with illustrations and glowing path
- Final CTA shows small brain illustration and Discord button
- Footer renders correctly
- Scroll animations trigger on scroll-into-view
- No console errors
- Mobile responsive (resize to ~375px width)

- [ ] **Step 3: Fix any visual issues found**

Address any layout, spacing, or animation issues discovered during verification.

- [ ] **Step 4: Final commit if any fixes were made**

```bash
git add -A
git commit -m "fix(website): visual polish from verification pass"
```

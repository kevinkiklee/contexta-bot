const DISCORD_INVITE = 'https://discord.com/oauth2/authorize?client_id=1485441632835866786&permissions=274877910016&scope=bot+applications.commands';
const DASHBOARD_URL = 'https://contexta-bot.vercel.app';

/* ── SVG Illustrations ──────────────────────────────────── */

function ConstellationBg() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 1200 800" fill="none" preserveAspectRatio="xMidYMid slice">
      {/* Nodes */}
      {[
        [150, 120], [320, 200], [480, 100], [620, 280], [800, 150],
        [950, 250], [1050, 120], [200, 400], [400, 350], [600, 450],
        [750, 380], [900, 480], [1100, 400], [100, 600], [300, 550],
        [500, 650], [700, 580], [850, 650], [1000, 600], [180, 720],
        [450, 500], [670, 700], [920, 720], [1080, 550],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="2" fill="#7c3aed" opacity="0.8">
            <animate attributeName="opacity" values="0.3;0.9;0.3" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} />
          </circle>
          <circle cx={x} cy={y} r="6" fill="#7c3aed" opacity="0.1">
            <animate attributeName="r" values="4;8;4" dur={`${4 + (i % 3)}s`} repeatCount="indefinite" begin={`${i * 0.2}s`} />
          </circle>
        </g>
      ))}
      {/* Connections */}
      {[
        [150, 120, 320, 200], [320, 200, 480, 100], [480, 100, 620, 280],
        [620, 280, 800, 150], [800, 150, 950, 250], [950, 250, 1050, 120],
        [200, 400, 400, 350], [400, 350, 600, 450], [600, 450, 750, 380],
        [750, 380, 900, 480], [320, 200, 400, 350], [620, 280, 600, 450],
        [800, 150, 750, 380], [100, 600, 300, 550], [300, 550, 500, 650],
        [500, 650, 700, 580], [700, 580, 850, 650], [200, 400, 100, 600],
        [400, 350, 450, 500], [450, 500, 500, 650], [750, 380, 700, 580],
        [900, 480, 1000, 600], [1000, 600, 1080, 550], [850, 650, 920, 720],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7c3aed" strokeWidth="0.5" opacity="0.3">
          <animate attributeName="opacity" values="0.1;0.4;0.1" dur={`${5 + (i % 3)}s`} repeatCount="indefinite" begin={`${i * 0.4}s`} />
        </line>
      ))}
    </svg>
  );
}

function NeuralOrbGraphic() {
  return (
    <div className="relative w-40 h-40 sm:w-52 sm:h-52 mx-auto mb-10">
      {/* Outer glow rings */}
      <div className="absolute inset-0 rounded-full bg-purple/15 blur-3xl scale-[2] animate-pulse-glow" />
      <div className="absolute inset-2 rounded-full bg-cyan/10 blur-2xl scale-150 animate-float-slow" />

      {/* Orbit rings */}
      <svg className="absolute inset-0 w-full h-full animate-spin-very-slow" viewBox="0 0 200 200">
        <ellipse cx="100" cy="100" rx="90" ry="90" fill="none" stroke="#7c3aed" strokeWidth="0.5" opacity="0.2" strokeDasharray="4 6" />
        <ellipse cx="100" cy="100" rx="70" ry="70" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.15" strokeDasharray="3 8" />
        <ellipse cx="100" cy="100" rx="50" ry="50" fill="none" stroke="#a78bfa" strokeWidth="0.5" opacity="0.2" strokeDasharray="2 5" />
        {/* Orbiting dots */}
        <circle cx="190" cy="100" r="3" fill="#7c3aed" opacity="0.8">
          <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="12s" repeatCount="indefinite" />
        </circle>
        <circle cx="170" cy="100" r="2" fill="#06b6d4" opacity="0.7">
          <animateTransform attributeName="transform" type="rotate" from="120 100 100" to="480 100 100" dur="8s" repeatCount="indefinite" />
        </circle>
        <circle cx="150" cy="100" r="2.5" fill="#a78bfa" opacity="0.6">
          <animateTransform attributeName="transform" type="rotate" from="240 100 100" to="600 100 100" dur="15s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Central orb */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-purple/25 via-[#1a0e2e] to-cyan/15 border border-purple/20 flex items-center justify-center shadow-[0_0_60px_rgba(124,58,237,0.15)]">
          <span className="text-4xl sm:text-5xl">🧠</span>
        </div>
      </div>
    </div>
  );
}

function MemoryIllustration() {
  return (
    <svg viewBox="0 0 400 200" fill="none" className="w-full max-w-sm mx-auto opacity-60 mt-6">
      {/* Timeline */}
      <line x1="40" y1="100" x2="360" y2="100" stroke="#7c3aed" strokeWidth="1" opacity="0.3" />
      {/* Memory nodes along timeline */}
      {[
        { x: 60, label: '2w ago', color: '#7c3aed', size: 6 },
        { x: 120, label: '1w ago', color: '#a78bfa', size: 8 },
        { x: 190, label: '3d ago', color: '#06b6d4', size: 10 },
        { x: 260, label: 'yesterday', color: '#7c3aed', size: 12 },
        { x: 340, label: 'now', color: '#06b6d4', size: 14 },
      ].map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy="100" r={n.size} fill={n.color} opacity="0.2">
            <animate attributeName="opacity" values="0.1;0.3;0.1" dur={`${3 + i}s`} repeatCount="indefinite" />
          </circle>
          <circle cx={n.x} cy="100" r={n.size / 2.5} fill={n.color} opacity="0.7" />
          <text x={n.x} y="130" fill="#9585b0" fontSize="9" textAnchor="middle" fontFamily="var(--font-sans)">{n.label}</text>
          {/* Connection lines to branching memories */}
          {i > 0 && (
            <line x1={n.x} y1={100 - n.size} x2={n.x} y2={60 - i * 5} stroke={n.color} strokeWidth="0.5" opacity="0.2" strokeDasharray="2 3" />
          )}
          {i > 0 && (
            <circle cx={n.x} cy={55 - i * 5} r="2" fill={n.color} opacity="0.4" />
          )}
        </g>
      ))}
      {/* Pulse at "now" */}
      <circle cx="340" cy="100" r="14" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.3">
        <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function MockDiscordMessage({ username, avatar, message, botReply }: { username: string; avatar: string; message: string; botReply: string }) {
  return (
    <div className="glass rounded-xl p-4 space-y-3 text-sm max-w-md mx-auto">
      {/* User message */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-blurple/30 flex items-center justify-center text-xs font-bold text-blurple shrink-0">{avatar}</div>
        <div>
          <span className="text-blurple text-xs font-semibold">{username}</span>
          <p className="text-text-muted text-[13px] mt-0.5">{message}</p>
        </div>
      </div>
      {/* Bot reply */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple/30 to-cyan/20 flex items-center justify-center text-xs shrink-0">🧠</div>
        <div>
          <span className="text-purple text-xs font-semibold">Contexta</span>
          <span className="text-text-dim text-[10px] ml-1.5">BOT</span>
          <p className="text-text text-[13px] mt-0.5">{botReply}</p>
        </div>
      </div>
    </div>
  );
}

function LorePreview() {
  return (
    <div className="glass rounded-xl overflow-hidden max-w-sm mx-auto mt-6">
      <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-purple/60" />
        <span className="text-text-dim text-[11px] uppercase tracking-wider font-semibold">Server Lore</span>
      </div>
      <div className="p-4 text-[12px] text-text-muted leading-relaxed font-mono">
        <p className="text-purple/70 mb-1"># Personality</p>
        <p>Friendly and witty. Use gaming metaphors.</p>
        <p>Speak like a helpful party member.</p>
        <p className="text-purple/70 mt-3 mb-1"># Rules</p>
        <p>No spoilers for ongoing campaigns.</p>
        <p>Keep responses under 200 words.</p>
      </div>
    </div>
  );
}

function RecallVisual() {
  return (
    <div className="max-w-sm mx-auto mt-6 space-y-2">
      {/* Search query */}
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" />
        </svg>
        <span className="text-text text-[13px]">what did we plan for friday?</span>
      </div>
      {/* Results */}
      {[
        { match: '94%', text: 'Alex said "let\'s do karaoke Friday at 8pm"', time: '3 days ago', color: '#7c3aed' },
        { match: '82%', text: 'Sam mentioned bringing snacks for Friday', time: '2 days ago', color: '#a78bfa' },
        { match: '71%', text: 'Channel vote: karaoke won 5-2 over movies', time: '4 days ago', color: '#06b6d4' },
      ].map((r, i) => (
        <div key={i} className="glass rounded-lg px-4 py-2.5 flex items-start gap-3">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 shrink-0" style={{ color: r.color, background: `${r.color}15` }}>{r.match}</span>
          <div className="min-w-0">
            <p className="text-text text-[12px] truncate">{r.text}</p>
            <p className="text-text-dim text-[10px] mt-0.5">{r.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Page Sections ──────────────────────────────────────── */

function Nav() {
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

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-14 overflow-hidden">
      {/* Constellation background */}
      <ConstellationBg />

      {/* Background orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-purple/8 blur-[120px] animate-float-slow" />
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan/6 blur-[100px] animate-float" />

      <div className="relative z-10 text-center max-w-2xl animate-fade-in-up">
        <NeuralOrbGraphic />

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]">
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

        {/* Mock Discord preview */}
        <div className="mt-16 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <MockDiscordMessage
            username="Alex"
            avatar="A"
            message="hey what was the name of that restaurant Sam recommended last week?"
            botReply="Sam recommended Sakura Ramen on Tuesday — said the spicy miso was 'life-changing' 🍜"
          />
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

const FEATURES = [
  {
    icon: '🧠',
    title: 'Long-Term Memory',
    description: 'Remembers conversations across channels and time. Yesterday\'s inside joke? Last month\'s game night plans? It\'s all there.',
    accent: 'from-purple to-purple/50',
    glow: 'bg-purple/10',
    visual: 'memory' as const,
  },
  {
    icon: '📜',
    title: 'Server Lore',
    description: 'Define your server\'s personality, rules, and lore. Contexta weaves it into every response — your culture, your bot.',
    accent: 'from-cyan to-cyan/50',
    glow: 'bg-cyan/10',
    visual: 'lore' as const,
  },
  {
    icon: '🔮',
    title: 'Semantic Recall',
    description: 'Search by meaning, not keywords. Ask "what did we decide about movie night?" and get the actual answer.',
    accent: 'from-[#a78bfa] to-[#a78bfa]/50',
    glow: 'bg-[#a78bfa]/10',
    visual: 'recall' as const,
  },
  {
    icon: '👤',
    title: 'Personal Profiles',
    description: 'Knows each member\'s preferences, tone, and context. Talks to everyone like it actually knows them — because it does.',
    accent: 'from-[#f472b6] to-[#f472b6]/50',
    glow: 'bg-[#f472b6]/10',
    visual: 'profiles' as const,
  },
];

function ProfileCards() {
  return (
    <div className="flex gap-2 mt-6 justify-center">
      {[
        { name: 'Alex', pref: 'Casual, loves puns', color: '#7c3aed' },
        { name: 'Sam', pref: 'Straight to the point', color: '#06b6d4' },
        { name: 'Jordan', pref: 'Detailed explanations', color: '#f472b6' },
      ].map((p) => (
        <div key={p.name} className="glass rounded-lg px-3 py-2 text-center w-24">
          <div className="w-6 h-6 rounded-full mx-auto mb-1.5 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: p.color }}>{p.name[0]}</div>
          <p className="text-text text-[11px] font-semibold">{p.name}</p>
          <p className="text-text-dim text-[9px] mt-0.5">{p.pref}</p>
        </div>
      ))}
    </div>
  );
}

function FeatureVisual({ type }: { type: 'memory' | 'lore' | 'recall' | 'profiles' }) {
  switch (type) {
    case 'memory': return <MemoryIllustration />;
    case 'lore': return <LorePreview />;
    case 'recall': return <RecallVisual />;
    case 'profiles': return <ProfileCards />;
  }
}

function Features() {
  return (
    <section id="features" className="relative px-6 py-24 sm:py-32">
      <div className="divider mb-24" />

      {/* Ambient background */}
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] rounded-full bg-purple/3 blur-[150px]" />
      <div className="absolute top-1/3 right-0 w-[300px] h-[300px] rounded-full bg-cyan/3 blur-[120px]" />

      <div className="relative max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-purple text-xs font-semibold uppercase tracking-[3px] mb-3">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Knowledge that grows with your community
          </h2>
          <p className="mt-4 text-text-muted max-w-md mx-auto">
            Not just another chatbot. Contexta builds a living memory of your server.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 stagger">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-6 sm:p-8 transition-all duration-300 group"
            >
              <div className="relative w-12 h-12 mb-5">
                <div className={`absolute inset-0 rounded-xl ${f.glow} blur-xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${f.accent} border border-white/5 flex items-center justify-center text-xl`}>
                  {f.icon}
                </div>
              </div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{f.description}</p>
              <FeatureVisual type={f.visual} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    num: '1',
    title: 'Add to Discord',
    description: 'One click to invite Contexta to your server',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    num: '2',
    title: 'Set your lore',
    description: 'Tell it your server\'s personality and rules',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h1.5A2.5 2.5 0 0 1 8 7.5V20a1.5 1.5 0 0 0-1.5-1.5H4V5Z" /><path d="M20 5h-1.5A2.5 2.5 0 0 0 16 7.5V20a1.5 1.5 0 0 1 1.5-1.5H20V5Z" />
      </svg>
    ),
  },
  {
    num: '3',
    title: 'It learns',
    description: 'Contexta builds knowledge from every conversation',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5Z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
];

function HowItWorks() {
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

        <div className="grid sm:grid-cols-3 gap-6 relative stagger">
          {/* Connecting line */}
          <div className="hidden sm:block absolute top-12 left-[20%] right-[20%]">
            <svg className="w-full h-2" preserveAspectRatio="none">
              <line x1="0" y1="1" x2="100%" y2="1" stroke="#7c3aed" strokeWidth="1" strokeDasharray="6 4" opacity="0.2" />
            </svg>
          </div>

          {STEPS.map((s) => (
            <div key={s.num} className="text-center relative">
              <div className="relative w-24 h-24 mx-auto mb-5">
                <div className="absolute inset-0 rounded-full bg-purple/5 blur-xl scale-150" />
                <div className="relative w-24 h-24 rounded-full glass border-purple/10 flex items-center justify-center">
                  {s.icon}
                </div>
                <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-purple to-cyan text-white text-[11px] font-bold flex items-center justify-center shadow-lg shadow-purple/30">
                  {s.num}
                </div>
              </div>
              <h3 className="font-bold text-base mb-1">{s.title}</h3>
              <p className="text-text-muted text-sm">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative px-6 py-24 sm:py-32">
      <div className="divider mb-24" />
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] rounded-full bg-purple/5 blur-[120px]" />
      </div>

      {/* Mini constellation */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.08]" viewBox="0 0 800 400" fill="none" preserveAspectRatio="xMidYMid slice">
        {[[100, 80], [250, 150], [400, 60], [550, 180], [700, 100], [200, 300], [400, 280], [600, 320]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2" fill="#7c3aed" opacity="0.6">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${3 + i}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {[[100, 80, 250, 150], [250, 150, 400, 60], [400, 60, 550, 180], [550, 180, 700, 100], [200, 300, 400, 280], [400, 280, 600, 320], [250, 150, 400, 280]].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7c3aed" strokeWidth="0.5" opacity="0.2" />
        ))}
      </svg>

      <div className="relative max-w-lg mx-auto text-center">
        <div className="text-5xl mb-6">🧠</div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
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
    </section>
  );
}

function Footer() {
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

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <FinalCTA />
      <Footer />
    </main>
  );
}

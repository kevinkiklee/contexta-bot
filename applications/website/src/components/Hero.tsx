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

import BrainIllustration from './BrainIllustration';
import DiscordChat from './DiscordChat';
import GlowBlob from './GlowBlob';
import AddToDiscordButton from './AddToDiscordButton';
import { DASHBOARD_URL } from './Nav';

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
          <AddToDiscordButton size="md" />
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

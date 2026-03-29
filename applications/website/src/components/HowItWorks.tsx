import ScrollReveal from './ScrollReveal';

const STEPS = [
  {
    num: '1',
    title: 'Add to Discord',
    description: 'One click to invite Contexta to your server.',
    color: '#7c3aed',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" className="w-20 h-20 mx-auto" style={{ transform: 'rotateY(-10deg) rotateX(5deg)' }}>
        <circle cx="60" cy="60" r="50" fill="#5865f2" opacity="0.15" />
        <circle cx="60" cy="60" r="35" fill="#5865f2" opacity="0.1" />
        <path d="M78 42.3a44.4 44.4 0 0 0-11.2-3.5.2.2 0 0 0-.1.1 31.6 31.6 0 0 0-1.4 2.8 41 41 0 0 0-12.3 0 28 28 0 0 0-1.4-2.8.2.2 0 0 0-.1-.1A44.3 44.3 0 0 0 40.3 42.3a.1.1 0 0 0-.1 0 45.3 45.3 0 0 0-7.7 30.6.2.2 0 0 0 0 .1 44.6 44.6 0 0 0 13.4 6.8.2.2 0 0 0 .2-.1 31.8 31.8 0 0 0 2.7-4.5.2.2 0 0 0-.1-.2 29.4 29.4 0 0 1-4.2-2 .2.2 0 0 1 0-.3l.8-.7a.2.2 0 0 1 .2 0 31.8 31.8 0 0 0 27.2 0 .2.2 0 0 1 .2 0l.8.7a.2.2 0 0 1 0 .3 27.6 27.6 0 0 1-4.2 2 .2.2 0 0 0 0 .2 35.8 35.8 0 0 0 2.7 4.5.2.2 0 0 0 .2 0A44.5 44.5 0 0 0 86.1 73a.2.2 0 0 0 0-.1A45.1 45.1 0 0 0 78.1 42.3ZM50 66.7c-2.7 0-4.9-2.4-4.9-5.4s2.1-5.4 4.9-5.4 5 2.5 4.9 5.4c0 3-2.1 5.4-4.9 5.4Zm17.9 0c-2.7 0-4.9-2.4-4.9-5.4s2.1-5.4 4.9-5.4 5 2.5 4.9 5.4c0 3-2.2 5.4-4.9 5.4Z" fill="#5865f2" opacity="0.7" transform="scale(0.75) translate(20 20)" />
        <circle cx="95" cy="25" r="14" fill="#7c3aed" opacity="0.8" />
        <line x1="95" y1="19" x2="95" y2="31" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="89" y1="25" x2="101" y2="25" stroke="white" strokeWidth="2" strokeLinecap="round" />
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
    description: "Tell it your server's personality and rules.",
    color: '#06b6d4',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" className="w-20 h-20 mx-auto" style={{ transform: 'rotateY(5deg) rotateX(8deg)' }}>
        <rect x="25" y="20" width="70" height="80" rx="4" fill="white" fillOpacity="0.03" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.3" />
        <line x1="60" y1="20" x2="60" y2="100" stroke="#06b6d4" strokeWidth="0.5" opacity="0.2" />
        {[35, 45, 55, 65].map((y) => (
          <g key={y}>
            <line x1="35" y1={y} x2="55" y2={y} stroke="#06b6d4" strokeWidth="0.8" opacity="0.3" />
            <line x1="65" y1={y} x2="85" y2={y} stroke="#06b6d4" strokeWidth="0.8" opacity="0.2" />
          </g>
        ))}
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
          <svg className="hidden sm:block absolute top-16 left-[18%] right-[18%] h-2 overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="path-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <line x1="0" y1="1" x2="100%" y2="1" stroke="url(#path-grad)" strokeWidth="1.5" opacity="0.3" />
            <circle r="4" fill="#7c3aed" opacity="0.6">
              <animateMotion dur="4s" repeatCount="indefinite" path="M 0,1 L 1000,1" />
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur="4s" repeatCount="indefinite" />
            </circle>
          </svg>

          {STEPS.map((s) => (
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

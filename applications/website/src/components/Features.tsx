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

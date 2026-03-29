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

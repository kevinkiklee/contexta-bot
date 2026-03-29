import BrainIllustration from './BrainIllustration';
import GlowBlob from './GlowBlob';
import Particles from './Particles';
import ScrollReveal from './ScrollReveal';
import AddToDiscordButton from './AddToDiscordButton';

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
          <AddToDiscordButton size="lg" />
        </div>
      </ScrollReveal>
    </section>
  );
}

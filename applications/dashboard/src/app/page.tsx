import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,var(--primary-muted),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,var(--accent-muted),transparent)]" />

      <div className="relative animate-scale-in flex flex-col items-center">
        {/* Logo */}
        <div className="relative mb-8">
          <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full scale-150" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary/25">
            C
          </div>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight mb-3">Contexta</h1>
        <p className="text-text-muted text-base mb-10 max-w-xs text-center leading-relaxed">
          AI co-host for your Discord server.
          <br />
          <span className="text-text-subtle text-sm">Manage conversations, memory, and lore.</span>
        </p>

        <a
          href="/api/auth/signin"
          className="btn-press group relative inline-flex items-center gap-2.5 rounded-xl bg-[#5865F2] px-6 py-3 text-white font-semibold text-sm hover:bg-[#4752C4] transition-colors shadow-lg shadow-[#5865F2]/25"
        >
          <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" className="opacity-90">
            <path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.2a.2.2 0 0 0-.2.1 40.6 40.6 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37 37 0 0 0 25.4.3a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.4 5a.2.2 0 0 0-.1 0A59.7 59.7 0 0 0 .2 45.3a.2.2 0 0 0 .1.2A58.8 58.8 0 0 0 18 54.7a.2.2 0 0 0 .3-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.8 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .3 36.4 36.4 0 0 1-5.5 2.7.2.2 0 0 0-.1.3 47.2 47.2 0 0 0 3.6 5.8.2.2 0 0 0 .3.1A58.6 58.6 0 0 0 70.7 45.4a.2.2 0 0 0 .1-.1A59.5 59.5 0 0 0 60.2 5a.2.2 0 0 0 0 0ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 4-2.8 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 4-2.9 7.2-6.4 7.2Z" />
          </svg>
          Sign in with Discord
        </a>

        <p className="text-text-muted text-xs mt-6 opacity-60">
          Requires a Discord account
        </p>
      </div>
    </main>
  );
}

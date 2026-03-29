import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center animate-scale-in">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold mb-6">
        C
      </div>
      <h1 className="text-4xl font-bold mb-2 tracking-tight">Contexta</h1>
      <p className="text-text-muted mb-8">AI co-host for your Discord server</p>
      <a
        href="/api/auth/signin"
        className="btn-press rounded-lg bg-primary px-6 py-3 text-white font-medium hover:bg-primary-hover transition"
      >
        Sign in with Discord
      </a>
    </main>
  );
}

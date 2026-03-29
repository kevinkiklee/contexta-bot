import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">Contexta</h1>
      <p className="text-gray-400 mb-8">AI co-host for your Discord server</p>
      <a
        href="/api/auth/signin"
        className="rounded-lg bg-indigo-600 px-6 py-3 text-white font-medium hover:bg-indigo-500 transition"
      >
        Sign in with Discord
      </a>
    </main>
  );
}

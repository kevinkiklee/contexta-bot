import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/');

  return (
    <div className="min-h-screen">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <a href="/dashboard" className="text-xl font-bold">Contexta</a>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{session.user.name}</span>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}>
            <button type="submit" className="text-sm text-gray-400 hover:text-white transition">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserServers } from '@/lib/queries';
import { pool } from '@/lib/db';
import { Sidebar } from './sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/');

  const servers = await getUserServers(pool, session.user.id!);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        servers={servers}
        userName={session.user.name || 'User'}
      />
      <main className="flex-1 min-w-0 p-8">
        <div className="max-w-4xl animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

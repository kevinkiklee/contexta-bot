import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserServers } from '@/lib/queries';
import { pool } from '@/lib/db';
import { getBots } from '@/lib/bots';
import { getSelectedBotId } from '@/lib/bot-cookie';
import { Sidebar } from './sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/');

  const bots = getBots();
  const activeBotId = await getSelectedBotId();
  const servers = await getUserServers(pool, session.user.id!, activeBotId);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        servers={servers}
        userName={session.user.name || 'User'}
        bots={bots}
        activeBotId={activeBotId}
      />
      <main className="flex-1 min-w-0 p-8 lg:p-10">
        <div className="max-w-4xl animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserServers } from '@/lib/queries';
import { pool } from '@/lib/db';
import { getSelectedBotId } from '@/lib/bot-cookie';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const botId = await getSelectedBotId();
  const servers = await getUserServers(pool, session.user.id, botId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Your Servers</h1>
        <p className="text-text-muted text-sm mt-1">Manage your Discord servers with Contexta</p>
      </div>
      {servers.length === 0 ? (
        <div className="rounded-2xl border border-border border-dashed bg-bg-raised p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-bg-overlay flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-text-muted" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <p className="text-text-subtle font-medium text-sm">No servers found</p>
          <p className="text-text-muted text-xs mt-1.5 max-w-xs mx-auto">
            Make sure Contexta is added to your Discord server and you have the right permissions.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 animate-stagger">
          {servers.map((server) => {
            const initial = (server.server_name || server.server_id).charAt(0).toUpperCase();
            return (
              <Link
                key={server.server_id}
                href={`/dashboard/${server.server_id}`}
                className="card-lift group flex items-center gap-4 rounded-xl border border-border bg-bg-raised p-4 hover:border-primary/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-[15px] font-bold text-primary shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{server.server_name || server.server_id}</div>
                  <div className="text-text-muted text-xs mt-0.5 font-[family-name:var(--font-mono)]">{server.active_model}</div>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  server.is_admin
                    ? 'text-primary bg-primary-muted'
                    : 'text-text-muted bg-bg-overlay'
                }`}>
                  {server.is_admin ? 'Admin' : 'Member'}
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 4 10 8 6 12" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

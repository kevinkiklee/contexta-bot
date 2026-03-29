import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserServers } from '@/lib/queries';
import { pool } from '@/lib/db';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const servers = await getUserServers(pool, session.user.id);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Your Servers</h1>
        <p className="text-text-muted text-sm mt-1">Manage your Discord servers with Contexta</p>
      </div>
      {servers.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-raised p-8 text-center">
          <p className="text-text-muted">
            No servers found. Make sure Contexta is added to your Discord server.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 animate-stagger">
          {servers.map((server) => {
            const initial = (server.server_name || server.server_id).charAt(0).toUpperCase();
            return (
              <Link
                key={server.server_id}
                href={`/dashboard/${server.server_id}`}
                className="card-lift flex items-center gap-4 rounded-xl border border-border bg-bg-raised p-4 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-bg-overlay flex items-center justify-center text-[15px] font-semibold text-text-subtle shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{server.server_name || server.server_id}</div>
                  <div className="text-text-muted text-xs mt-0.5">{server.active_model}</div>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                  server.is_admin
                    ? 'text-primary bg-primary/10'
                    : 'text-text-muted bg-bg-overlay'
                }`}>
                  {server.is_admin ? 'Admin' : 'Member'}
                </span>
                <span className="text-text-muted text-sm">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

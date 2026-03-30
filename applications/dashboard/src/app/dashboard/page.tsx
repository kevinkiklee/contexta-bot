import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserServers } from '@/lib/queries';
import { pool } from '@/lib/db';
import { getSelectedBotId } from '@/lib/bot-cookie';
import { getModelLabel } from '@contexta/shared';
import Link from 'next/link';

const botClientId = process.env.BOT_CLIENT_ID;
const inviteUrl = botClientId
  ? `https://discord.com/oauth2/authorize?client_id=${botClientId}&permissions=274877910016&scope=bot`
  : null;

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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-bg-overlay flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-text mb-1">No servers found</h3>
          <p className="text-sm text-text-muted max-w-sm mb-4">
            Invite Contexta to your Discord server to get started. Once the bot joins, your server will appear here.
          </p>
          {inviteUrl && (
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Add to Discord
            </a>
          )}
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
                  <div className="text-text-muted text-xs mt-0.5 font-[family-name:var(--font-mono)]">{getModelLabel(server.active_model ?? '')}</div>
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

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkServerMembership } from '@/lib/auth-helpers';
import { getServerSettings, getServerChannels } from '@/lib/queries';
import { pool } from '@/lib/db';
import { redis } from '@/lib/redis';
import { getSelectedBotId } from '@/lib/bot-cookie';
import { getModelLabel } from '@contexta/shared';
import Link from 'next/link';

export default async function ServerOverviewPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const botId = await getSelectedBotId();
  const membership = await checkServerMembership(pool, session.user.id, serverId);
  const settings = await getServerSettings(pool, serverId, botId);
  const channels = await getServerChannels(redis, serverId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-text-muted text-sm mt-1">Server dashboard for {serverId}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-10 animate-stagger">
        <div className="rounded-xl border border-border bg-bg-raised p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-[40px]" />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-primary-muted flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" className="text-primary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="8 1 10 6 15 6 11 10 12.5 15 8 12 3.5 15 5 10 1 6 6 6" />
              </svg>
            </div>
            <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Active Model</div>
          </div>
          <div className="text-lg font-bold font-[family-name:var(--font-mono)]">{getModelLabel(settings?.active_model ?? 'gemini-2.5-flash')}</div>
        </div>
        <div className="rounded-xl border border-border bg-bg-raised p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-accent/5 rounded-bl-[40px]" />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-accent-muted flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" className="text-accent" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h12M2 8h12M2 12h12" />
              </svg>
            </div>
            <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Channels Tracked</div>
          </div>
          <div className="text-lg font-bold">{channels.length}</div>
        </div>
      </div>

      {/* Action cards */}
      <div className="mb-4">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Quick Actions</h2>
      </div>
      <div className="flex flex-col gap-2 animate-stagger">
        {membership?.is_admin && (
          <>
            <ActionCard
              href={`/dashboard/${serverId}/settings`}
              title="Settings"
              description="Configure bot model and behavior"
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" />
                </svg>
              }
            />
            <ActionCard
              href={`/dashboard/${serverId}/lore`}
              title="Lore"
              description="Edit server rules, themes, and personality"
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h1.5A2.5 2.5 0 0 1 6 5.5V14a1.5 1.5 0 0 0-1.5-1.5H2V3Z" /><path d="M14 3h-1.5A2.5 2.5 0 0 0 10 5.5V14a1.5 1.5 0 0 1 1.5-1.5H14V3Z" />
                </svg>
              }
            />
          </>
        )}
        <ActionCard
          href={`/dashboard/${serverId}/history`}
          title="History"
          description="Browse conversation history by channel"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 8.5a6 6 0 1 1-3-5.2" /><polyline points="14 3 14 7 10 7" />
            </svg>
          }
        />
      </div>
    </div>
  );
}

function ActionCard({ href, title, description, icon }: { href: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="card-lift group flex items-center gap-4 rounded-xl border border-border bg-bg-raised p-4 hover:border-primary/30 transition-all"
    >
      <div className="w-9 h-9 rounded-lg bg-bg-overlay flex items-center justify-center text-text-muted group-hover:text-primary group-hover:bg-primary-muted transition-colors shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-text-muted text-xs mt-0.5">{description}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 4 10 8 6 12" />
      </svg>
    </Link>
  );
}

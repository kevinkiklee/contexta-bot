import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkServerMembership } from '@/lib/auth-helpers';
import { getServerSettings, getServerChannels } from '@/lib/queries';
import { pool } from '@/lib/db';
import { redis } from '@/lib/redis';
import Link from 'next/link';

export default async function ServerOverviewPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const membership = await checkServerMembership(pool, session.user.id, serverId);
  const settings = await getServerSettings(pool, serverId);
  const channels = await getServerChannels(redis, serverId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-text-muted text-sm mt-1">Server dashboard for {serverId}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-8 animate-stagger">
        <div className="rounded-xl border border-border bg-bg-raised p-5">
          <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Active Model</div>
          <div className="text-lg font-semibold mt-1">{settings?.active_model ?? 'gemini-2.5-flash'}</div>
        </div>
        <div className="rounded-xl border border-border bg-bg-raised p-5">
          <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Channels Tracked</div>
          <div className="text-lg font-semibold mt-1">{channels.length}</div>
        </div>
      </div>

      {/* Action cards */}
      <h2 className="text-sm font-medium text-text-muted mb-3">Quick Actions</h2>
      <div className="flex flex-col gap-2 animate-stagger">
        {membership?.is_admin && (
          <>
            <Link
              href={`/dashboard/${serverId}/settings`}
              className="card-lift flex items-center justify-between rounded-xl border border-border bg-bg-raised p-4 transition-all"
            >
              <div>
                <div className="font-semibold text-sm">Settings</div>
                <div className="text-text-muted text-xs mt-0.5">Configure bot model and cache</div>
              </div>
              <span className="text-text-muted">→</span>
            </Link>
            <Link
              href={`/dashboard/${serverId}/lore`}
              className="card-lift flex items-center justify-between rounded-xl border border-border bg-bg-raised p-4 transition-all"
            >
              <div>
                <div className="font-semibold text-sm">Lore</div>
                <div className="text-text-muted text-xs mt-0.5">Edit server rules and themes</div>
              </div>
              <span className="text-text-muted">→</span>
            </Link>
          </>
        )}
        <Link
          href={`/dashboard/${serverId}/history`}
          className="card-lift flex items-center justify-between rounded-xl border border-border bg-bg-raised p-4 transition-all"
        >
          <div>
            <div className="font-semibold text-sm">History</div>
            <div className="text-text-muted text-xs mt-0.5">Browse conversation history</div>
          </div>
          <span className="text-text-muted">→</span>
        </Link>
      </div>
    </div>
  );
}

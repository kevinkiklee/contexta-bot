import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { checkServerMembership } from '@/lib/auth-helpers';
import { getKnowledgeStats, getKnowledgeEntries } from '@/lib/queries';
import { getSelectedBotId } from '@/lib/bot-cookie';
import { KnowledgeList } from './knowledge-list';

interface StatCardProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  href?: string;
}

function StatCard({ label, value, highlight, href }: StatCardProps) {
  const inner = (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        highlight
          ? 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10'
          : 'border-border bg-bg-raised hover:bg-bg-overlay'
      }`}
    >
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? 'text-amber-400' : 'text-text'}`}>
        {value}
      </p>
    </div>
  );

  if (href) {
    return <a href={href}>{inner}</a>;
  }
  return inner;
}

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ serverId: string }>;
  searchParams: Promise<{ status?: string; type?: string; q?: string; pinned?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const { status, type, q, pinned } = await searchParams;

  const membership = await checkServerMembership(pool, session.user.id, serverId);
  if (!membership) {
    return (
      <div className="rounded-2xl border border-error/20 bg-error/5 p-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-error" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-error mb-1">Access Denied</h1>
        <p className="text-text-muted text-sm">You are not a member of this server.</p>
      </div>
    );
  }

  const [stats, result] = await Promise.all([
    getKnowledgeStats(pool, serverId),
    getKnowledgeEntries(pool, {
      serverId,
      status: status || undefined,
      type: type || undefined,
      search: q || undefined,
      pinnedOnly: pinned === 'true',
      limit: 20,
    }),
  ]);

  const avgConfidencePct = Math.round((stats.avg_confidence ?? 0) * 100);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-text-muted text-sm mt-1">Extracted facts, decisions, and entities from server conversations</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Published" value={stats.published} />
        <StatCard
          label="Pending Review"
          value={stats.pending_review}
          highlight={stats.pending_review > 0}
          href={stats.pending_review > 0 ? `?status=pending_review` : undefined}
        />
        <StatCard label="This Week" value={stats.created_this_week} />
        <StatCard label="Avg Confidence" value={`${avgConfidencePct}%`} />
      </div>

      <KnowledgeList
        serverId={serverId}
        entries={result.entries}
        nextCursor={result.nextCursor}
        isAdmin={membership.is_admin}
        currentFilters={{ status: status || '', type: type || '', q: q || '', pinned: pinned || '' }}
      />
    </div>
  );
}

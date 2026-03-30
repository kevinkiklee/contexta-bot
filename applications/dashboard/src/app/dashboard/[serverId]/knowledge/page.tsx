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
      <div className="border border-border rounded-lg p-6 bg-bg-raised flex items-center gap-3">
        <svg className="w-5 h-5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-sm text-text-muted">You need admin permissions to access this page.</p>
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

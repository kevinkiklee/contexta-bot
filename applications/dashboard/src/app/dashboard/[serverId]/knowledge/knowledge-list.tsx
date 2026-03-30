'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import type { KnowledgeEntryRow } from '@/lib/queries';

interface KnowledgeListProps {
  serverId: string;
  entries: KnowledgeEntryRow[];
  nextCursor: string | null;
  isAdmin: boolean;
  currentFilters: { status: string; type: string; q: string; pinned: string };
}

const TYPE_BADGES: Record<string, string> = {
  topic:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  decision:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  entity:      'bg-purple-500/10 text-purple-400 border-purple-500/20',
  action_item: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  reference:   'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const STATUS_BADGES: Record<string, string> = {
  published:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rejected:       'bg-red-500/10 text-red-400 border-red-500/20',
};

const TYPE_LABELS: Record<string, string> = {
  topic: 'Topic',
  decision: 'Decision',
  entity: 'Entity',
  action_item: 'Action Item',
  reference: 'Reference',
};

const STATUS_LABELS: Record<string, string> = {
  published: 'Published',
  pending_review: 'Pending',
  rejected: 'Rejected',
};

function ConfidenceDots({ value }: { value: number }) {
  // value is 0-1; show 5 dots
  const filled = Math.round(value * 5);
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i < filled ? 'bg-primary' : 'bg-border'
          }`}
        />
      ))}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function KnowledgeList({
  serverId,
  entries,
  nextCursor,
  isAdmin,
  currentFilters,
}: KnowledgeListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(currentFilters.q);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = {
        status: currentFilters.status,
        type: currentFilters.type,
        q: currentFilters.q,
        pinned: currentFilters.pinned,
        ...overrides,
      };
      for (const [k, v] of Object.entries(merged)) {
        if (v) params.set(k, v);
      }
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, currentFilters]
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ q: search, before: '' }));
  }

  async function handleAction(entryId: string, action: string) {
    setLoadingId(`${entryId}:${action}`);
    try {
      await fetch(`/api/knowledge/${serverId}/${entryId}/${action}`, { method: 'PUT' });
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="7" cy="7" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search knowledge..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-bg-raised border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition shadow-sm shadow-primary/20"
          >
            Search
          </button>
          {currentFilters.q && (
            <button
              type="button"
              onClick={() => { setSearch(''); router.push(buildUrl({ q: '', before: '' })); }}
              className="px-3 py-2 text-sm text-text-muted hover:text-text bg-bg-overlay rounded-lg transition"
            >
              Clear
            </button>
          )}
        </form>

        <select
          value={currentFilters.status}
          onChange={(e) => router.push(buildUrl({ status: e.target.value, before: '' }))}
          className="text-xs bg-bg-raised border border-border rounded-lg px-2.5 py-1.5 text-text focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="pending_review">Pending Review</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={currentFilters.type}
          onChange={(e) => router.push(buildUrl({ type: e.target.value, before: '' }))}
          className="text-xs bg-bg-raised border border-border rounded-lg px-2.5 py-1.5 text-text focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">All types</option>
          <option value="topic">Topic</option>
          <option value="decision">Decision</option>
          <option value="entity">Entity</option>
          <option value="action_item">Action Item</option>
          <option value="reference">Reference</option>
        </select>

        <button
          onClick={() => router.push(buildUrl({ pinned: currentFilters.pinned === 'true' ? '' : 'true', before: '' }))}
          className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
            currentFilters.pinned === 'true'
              ? 'bg-primary text-white border-primary'
              : 'bg-bg-raised text-text-muted border-border hover:text-text'
          }`}
        >
          📌 Pinned only
        </button>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-border border-dashed bg-bg-raised p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-bg-overlay flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-text-muted" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <p className="text-text-subtle font-medium text-sm">
            {currentFilters.q ? 'No entries match your search' : 'No knowledge entries yet'}
          </p>
          <p className="text-text-muted text-xs mt-1.5">
            {currentFilters.q
              ? 'Try a different search term or clear filters.'
              : 'Knowledge will be extracted automatically from conversations.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-bg-raised overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-overlay/50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Confidence</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Date</th>
                  {isAdmin && (
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => {
                  const typeBadge = TYPE_BADGES[entry.type] ?? TYPE_BADGES.reference;
                  const statusBadge = STATUS_BADGES[entry.status] ?? STATUS_BADGES.rejected;
                  const shortId = `KE-${entry.id.slice(-4).toUpperCase()}`;

                  return (
                    <tr key={entry.id} className="hover:bg-bg-overlay/50 transition-colors">
                      {/* ID */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-text-muted">{shortId}</span>
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3 max-w-[240px]">
                        <span className="text-[13px] font-medium text-text truncate block">
                          {entry.is_pinned && <span className="mr-1.5">📌</span>}
                          {entry.title}
                        </span>
                      </td>

                      {/* Type badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${typeBadge}`}>
                          {TYPE_LABELS[entry.type] ?? entry.type}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusBadge}`}>
                          {STATUS_LABELS[entry.status] ?? entry.status}
                        </span>
                      </td>

                      {/* Confidence dots */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ConfidenceDots value={entry.confidence} />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-text-muted tabular-nums">{formatDate(entry.created_at)}</span>
                      </td>

                      {/* Actions */}
                      {isAdmin && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {entry.status === 'pending_review' && (
                              <>
                                <ActionButton
                                  label="Approve"
                                  color="emerald"
                                  loading={loadingId === `${entry.id}:approve`}
                                  onClick={() => handleAction(entry.id, 'approve')}
                                />
                                <ActionButton
                                  label="Reject"
                                  color="red"
                                  loading={loadingId === `${entry.id}:reject`}
                                  onClick={() => handleAction(entry.id, 'reject')}
                                />
                              </>
                            )}
                            <ActionButton
                              label={entry.is_pinned ? 'Unpin' : 'Pin'}
                              color="amber"
                              loading={loadingId === `${entry.id}:pin`}
                              onClick={() => handleAction(entry.id, 'pin')}
                            />
                            <ActionButton
                              label="Archive"
                              color="gray"
                              loading={loadingId === `${entry.id}:archive`}
                              onClick={() => handleAction(entry.id, 'archive')}
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {nextCursor && (
            <div className="border-t border-border p-3 text-center">
              <a
                href={buildUrl({ before: nextCursor })}
                className="btn-press inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition font-medium"
              >
                Load more
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 6 8 10 12 6" />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  color: 'emerald' | 'red' | 'amber' | 'gray';
  loading: boolean;
  onClick: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
  red:     'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
  amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
  gray:    'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20',
};

function ActionButton({ label, color, loading, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`btn-press inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-50 ${ACTION_COLORS[color]}`}
    >
      {loading ? '…' : label}
    </button>
  );
}

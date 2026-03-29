'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useCallback } from 'react';
import type { MessageRow, ChannelInfo } from '@/lib/queries';

interface MessageListProps {
  serverId: string;
  messages: MessageRow[];
  nextCursor: string | null;
  channels: ChannelInfo[];
  users: { user_id: string; display_name: string; is_bot: boolean }[];
  activeChannel: string;
  activeQuery: string;
  activeUserId: string;
  activeBotOnly: boolean;
}

export function MessageList({
  serverId,
  messages,
  nextCursor,
  channels,
  users,
  activeChannel,
  activeQuery,
  activeUserId,
  activeBotOnly,
}: MessageListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(activeQuery);

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = {
        channel: activeChannel,
        q: activeQuery,
        userId: activeUserId,
        botOnly: activeBotOnly ? 'true' : '',
        ...overrides,
      };
      for (const [k, v] of Object.entries(merged)) {
        if (v) params.set(k, v);
      }
      return `${pathname}?${params.toString()}`;
    },
    [pathname, activeChannel, activeQuery, activeUserId, activeBotOnly]
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ q: search, before: '' }));
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
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
            placeholder="Search messages..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-bg-raised border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition shadow-sm shadow-primary/20"
        >
          Search
        </button>
        {activeQuery && (
          <button
            type="button"
            onClick={() => { setSearch(''); router.push(buildUrl({ q: '', before: '' })); }}
            className="px-3 py-2 text-sm text-text-muted hover:text-text bg-bg-overlay rounded-lg transition"
          >
            Clear
          </button>
        )}
      </form>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={activeChannel}
          onChange={(e) => router.push(buildUrl({ channel: e.target.value, before: '' }))}
          className="text-xs bg-bg-raised border border-border rounded-lg px-2.5 py-1.5 text-text focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">All channels</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>#{ch.name}</option>
          ))}
        </select>

        <select
          value={activeUserId}
          onChange={(e) => router.push(buildUrl({ userId: e.target.value, before: '' }))}
          className="text-xs bg-bg-raised border border-border rounded-lg px-2.5 py-1.5 text-text focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">All users</option>
          {users.filter((u) => !u.is_bot).map((u) => (
            <option key={u.user_id} value={u.user_id}>{u.display_name}</option>
          ))}
        </select>

        <button
          onClick={() => router.push(buildUrl({ botOnly: activeBotOnly ? '' : 'true', before: '' }))}
          className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
            activeBotOnly
              ? 'bg-primary text-white border-primary'
              : 'bg-bg-raised text-text-muted border-border hover:text-text'
          }`}
        >
          Bot only
        </button>
      </div>

      {/* Message list */}
      {messages.length === 0 ? (
        <div className="rounded-2xl border border-border border-dashed bg-bg-raised p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-bg-overlay flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-text-muted" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-text-subtle font-medium text-sm">
            {activeQuery ? 'No messages match your search' : 'No messages yet'}
          </p>
          <p className="text-text-muted text-xs mt-1.5">
            {activeQuery ? 'Try a different search term or clear filters.' : 'Messages will appear here once the bot starts chatting.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-bg-raised overflow-hidden">
          <ul className="divide-y divide-border">
            {messages.map((msg) => (
              <li
                key={msg.id}
                className="px-4 py-3 hover:bg-bg-overlay/50 transition-colors"
              >
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-[13px] font-semibold ${msg.is_bot ? 'text-primary' : 'text-text'}`}>
                    {msg.display_name}
                  </span>
                  {msg.is_bot && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      Bot
                    </span>
                  )}
                  <span className="text-[11px] text-text-muted font-[family-name:var(--font-mono)] tabular-nums ml-auto">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <p className="text-[13px] text-text-subtle break-words">{msg.content}</p>
              </li>
            ))}
          </ul>

          {/* Load more */}
          {nextCursor && (
            <div className="border-t border-border p-3 text-center">
              <a
                href={buildUrl({ before: nextCursor })}
                className="btn-press inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition font-medium"
              >
                Load older messages
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

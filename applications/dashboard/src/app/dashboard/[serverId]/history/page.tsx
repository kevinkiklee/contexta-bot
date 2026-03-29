import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getServerChannels, getChannelHistory } from '@/lib/queries';
import { redis } from '@/lib/redis';

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ serverId: string }>;
  searchParams: Promise<{ channel?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const { channel, page } = await searchParams;

  const channels = await getServerChannels(redis, serverId);
  const selectedChannel = channel ?? channels[0] ?? null;
  const currentPage = Math.max(1, parseInt(page ?? '1', 10));
  const pageSize = 50;

  let messages: string[] = [];
  if (selectedChannel) {
    messages = await getChannelHistory(redis, selectedChannel, (currentPage - 1) * pageSize, pageSize);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Conversation History</h1>
        <p className="text-text-muted text-sm mt-1">Browse recent conversations by channel</p>
      </div>

      {channels.length === 0 ? (
        <div className="rounded-2xl border border-border border-dashed bg-bg-raised p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-bg-overlay flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-text-muted" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-text-subtle font-medium text-sm">No history found</p>
          <p className="text-text-muted text-xs mt-1.5">Conversation history will appear here once the bot starts chatting.</p>
        </div>
      ) : (
        <>
          {/* Channel tabs */}
          <div className="flex gap-1 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
            {channels.map((ch) => (
              <a
                key={ch}
                href={`?channel=${ch}&page=1`}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition ${
                  ch === selectedChannel
                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                    : 'text-text-muted hover:text-text hover:bg-bg-overlay'
                }`}
              >
                <span className="opacity-50 mr-0.5">#</span>{ch}
              </a>
            ))}
          </div>

          {/* Messages */}
          <div className="rounded-xl border border-border bg-bg-raised overflow-hidden">
            {messages.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-text-muted text-sm">No messages in this channel.</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {messages.map((msg, i) => (
                    <li key={i} className="px-4 py-3 text-[13px] font-[family-name:var(--font-mono)] break-all text-text-subtle hover:bg-bg-overlay/50 transition-colors">
                      {msg}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-bg-overlay/30">
                  <div>
                    {currentPage > 1 ? (
                      <a
                        href={`?channel=${selectedChannel}&page=${currentPage - 1}`}
                        className="btn-press inline-flex items-center gap-1 text-sm text-text-muted hover:text-text transition font-medium"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="10 12 6 8 10 4" /></svg>
                        Previous
                      </a>
                    ) : (
                      <span />
                    )}
                  </div>
                  <span className="text-xs text-text-muted font-[family-name:var(--font-mono)] tabular-nums">
                    Page {currentPage}
                  </span>
                  <div>
                    {messages.length === pageSize && (
                      <a
                        href={`?channel=${selectedChannel}&page=${currentPage + 1}`}
                        className="btn-press inline-flex items-center gap-1 text-sm text-text-muted hover:text-text transition font-medium"
                      >
                        Next
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 4 10 8 6 12" /></svg>
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

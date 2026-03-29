'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BotSelector } from './bot-selector';
import type { BotConfig } from '@/lib/bots';

interface ChannelInfo {
  id: string;
  name: string;
}

interface Server {
  server_id: string;
  server_name: string | null;
  is_admin: boolean;
}

interface SidebarProps {
  servers: Server[];
  userName: string;
  bots: BotConfig[];
  activeBotId: string;
}

function LogoMark() {
  return (
    <Link href="/dashboard" className="block">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm shadow-primary/20">
        C
      </div>
    </Link>
  );
}

function ServerIcon({ server, isActive }: { server: Server; isActive: boolean }) {
  const initial = (server.server_name || server.server_id).charAt(0).toUpperCase();
  return (
    <Link
      href={`/dashboard/${server.server_id}`}
      title={server.server_name || server.server_id}
      className={`icon-hover w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-semibold shrink-0 transition-all ${
        isActive
          ? 'bg-primary text-white shadow-sm shadow-primary/30'
          : 'bg-bg-overlay text-text-muted hover:text-text hover:bg-border'
      }`}
    >
      {initial}
    </Link>
  );
}

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all relative ${
        active
          ? 'bg-primary-muted text-text font-medium'
          : 'text-text-muted hover:text-text hover:bg-bg-overlay'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full animate-slide-in-left" />
      )}
      <span className="w-4 h-4 flex items-center justify-center opacity-70">{icon}</span>
      {label}
    </Link>
  );
}

const OverviewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="2.5" /><path d="M13.3 10a1.1 1.1 0 0 0 .2 1.2l.1.1a1.4 1.4 0 1 1-2 2l-.1-.1a1.1 1.1 0 0 0-1.9.8v.2a1.4 1.4 0 0 1-2.8 0V14a1.1 1.1 0 0 0-.7-1 1.1 1.1 0 0 0-1.2.2l-.1.1a1.4 1.4 0 1 1-2-2l.1-.1A1.1 1.1 0 0 0 3 10H2.8a1.4 1.4 0 0 1 0-2.8H3a1.1 1.1 0 0 0 1-.7 1.1 1.1 0 0 0-.2-1.2l-.1-.1a1.4 1.4 0 1 1 2-2l.1.1a1.1 1.1 0 0 0 1.2.2h.1A1.1 1.1 0 0 0 7.8 2.8V2.4a1.4 1.4 0 0 1 2.8 0v.2a1.1 1.1 0 0 0 .7 1 1.1 1.1 0 0 0 1.2-.2l.1-.1a1.4 1.4 0 1 1 2 2l-.1.1a1.1 1.1 0 0 0-.2 1.2V7a1.1 1.1 0 0 0 .7.7h.2a1.4 1.4 0 0 1 0 2.8H14a1.1 1.1 0 0 0-1 .7Z" />
  </svg>
);

const PersonalityIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="5" r="3" /><path d="M2 14c0-2.8 2.7-5 6-5s6 2.2 6 5" />
  </svg>
);

const LoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h1.5A2.5 2.5 0 0 1 6 5.5V14a1.5 1.5 0 0 0-1.5-1.5H2V3Z" /><path d="M14 3h-1.5A2.5 2.5 0 0 0 10 5.5V14a1.5 1.5 0 0 1 1.5-1.5H14V3Z" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 8.5a6 6 0 1 1-3-5.2" /><polyline points="14 3 14 7 10 7" />
  </svg>
);

const ServersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="12" height="12" rx="2" /><line x1="2" y1="8" x2="14" y2="8" />
  </svg>
);

export function Sidebar({ servers, userName, bots, activeBotId }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeServerId = pathname.match(/^\/dashboard\/([^/]+)/)?.[1] ?? null;
  const activeServer = servers.find((s) => s.server_id === activeServerId);

  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [historyOpen, setHistoryOpen] = useState(pathname.includes('/history'));

  useEffect(() => {
    if (!activeServerId) { setChannels([]); return; }
    fetch(`/api/channels/${activeServerId}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setChannels)
      .catch(() => setChannels([]));
  }, [activeServerId]);

  useEffect(() => {
    if (pathname.includes('/history')) setHistoryOpen(true);
  }, [pathname]);

  return (
    <aside className="flex h-screen shrink-0 sticky top-0">
      {/* Icon Rail */}
      <div className="w-[52px] bg-bg-raised border-r border-border flex flex-col items-center py-4 gap-2">
        <div className="mb-3">
          <LogoMark />
        </div>
        <div className="w-5 h-px bg-border mb-1" />
        {servers.map((server) => (
          <ServerIcon
            key={server.server_id}
            server={server}
            isActive={server.server_id === activeServerId}
          />
        ))}
      </div>

      {/* Nav Panel */}
      <div className="w-[190px] bg-bg border-r border-border flex flex-col">
        <BotSelector bots={bots} activeBotId={activeBotId} />
        <nav className="flex-1 p-3 space-y-0.5">
          {activeServer ? (
            <>
              <div className="px-3 py-2.5 mb-1">
                <div className="text-[13px] font-semibold truncate">{activeServer.server_name || activeServer.server_id}</div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {activeServer.is_admin ? 'Admin' : 'Member'}
                </div>
              </div>
              <NavItem
                href={`/dashboard/${activeServerId}`}
                label="Overview"
                icon={<OverviewIcon />}
                active={pathname === `/dashboard/${activeServerId}`}
              />
              {activeServer.is_admin && (
                <>
                  <NavItem
                    href={`/dashboard/${activeServerId}/settings`}
                    label="Settings"
                    icon={<SettingsIcon />}
                    active={pathname === `/dashboard/${activeServerId}/settings`}
                  />
                  <NavItem
                    href={`/dashboard/${activeServerId}/lore`}
                    label="Lore"
                    icon={<LoreIcon />}
                    active={pathname === `/dashboard/${activeServerId}/lore`}
                  />
                  <NavItem
                    href={`/dashboard/${activeServerId}/personality`}
                    label="Personality"
                    icon={<PersonalityIcon />}
                    active={pathname === `/dashboard/${activeServerId}/personality`}
                  />
                </>
              )}
              {/* History with nested channels */}
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all relative ${
                  pathname.includes('/history')
                    ? 'bg-primary-muted text-text font-medium'
                    : 'text-text-muted hover:text-text hover:bg-bg-overlay'
                }`}
              >
                {pathname.includes('/history') && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full" />
                )}
                <span className="w-4 h-4 flex items-center justify-center opacity-70"><HistoryIcon /></span>
                History
                <svg
                  width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                  className={`ml-auto transition-transform ${historyOpen ? 'rotate-90' : ''}`}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="6 4 10 8 6 12" />
                </svg>
              </button>
              {historyOpen && channels.length > 0 && (
                <div className="ml-4 pl-3 border-l border-border space-y-0.5 mt-0.5">
                  {channels.map((ch) => {
                    const isActive = pathname.includes('/history') && searchParams.get('channel') === ch.id;
                    return (
                      <Link
                        key={ch.id}
                        href={`/dashboard/${activeServerId}/history?channel=${ch.id}&page=1`}
                        className={`block px-2 py-1.5 rounded-md text-[12px] truncate transition-all ${
                          isActive
                            ? 'text-text font-medium bg-bg-overlay'
                            : 'text-text-muted hover:text-text hover:bg-bg-overlay'
                        }`}
                        title={ch.name}
                      >
                        <span className="opacity-40 mr-0.5">#</span>{ch.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <NavItem href="/dashboard" label="All Servers" icon={<ServersIcon />} active={pathname === '/dashboard'} />
          )}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 px-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-[11px] font-semibold text-text-subtle">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-text-subtle text-xs truncate font-medium">{userName}</span>
          </div>
          <div className="flex items-center justify-end px-2">
            <a href="/api/auth/signout" className="text-[11px] text-text-muted hover:text-text transition">
              Sign out
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}

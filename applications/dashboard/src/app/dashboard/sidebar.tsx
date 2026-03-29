'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@contexta/ui';

interface Server {
  server_id: string;
  server_name: string | null;
  is_admin: boolean;
}

interface SidebarProps {
  servers: Server[];
  userName: string;
}

function LogoMark() {
  return (
    <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
      C
    </div>
  );
}

function ServerIcon({ server, isActive }: { server: Server; isActive: boolean }) {
  const initial = (server.server_name || server.server_id).charAt(0).toUpperCase();
  return (
    <Link
      href={`/dashboard/${server.server_id}`}
      title={server.server_name || server.server_id}
      className={`icon-hover w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 transition-all ${
        isActive
          ? 'bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-bg'
          : 'bg-bg-overlay text-text-subtle hover:bg-border'
      }`}
    >
      {initial}
    </Link>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}

function NavItem({ href, label, icon, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-[13px] transition-all relative ${
        active
          ? 'bg-bg-raised text-text font-medium'
          : 'text-text-muted hover:text-text hover:bg-bg-raised/50'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full animate-slide-in-left" />
      )}
      <span className="text-sm">{icon}</span>
      {label}
    </Link>
  );
}

export function Sidebar({ servers, userName }: SidebarProps) {
  const pathname = usePathname();

  const activeServerId = pathname.match(/^\/dashboard\/([^/]+)/)?.[1] ?? null;
  const activeServer = servers.find((s) => s.server_id === activeServerId);

  return (
    <aside className="flex h-screen shrink-0 sticky top-0">
      {/* Icon Rail */}
      <div className="w-14 border-r border-border flex flex-col items-center py-4 gap-2">
        <Link href="/dashboard" className="mb-3">
          <LogoMark />
        </Link>
        {servers.map((server) => (
          <ServerIcon
            key={server.server_id}
            server={server}
            isActive={server.server_id === activeServerId}
          />
        ))}
      </div>

      {/* Nav Panel */}
      <div className="w-[180px] border-r border-border flex flex-col">
        <nav className="flex-1 p-3 space-y-1">
          {activeServer ? (
            <>
              <div className="px-3 py-2 text-[13px] font-semibold truncate">
                {activeServer.server_name || activeServer.server_id}
              </div>
              <NavItem
                href={`/dashboard/${activeServerId}`}
                label="Overview"
                icon="⌂"
                active={pathname === `/dashboard/${activeServerId}`}
              />
              {activeServer.is_admin && (
                <>
                  <NavItem
                    href={`/dashboard/${activeServerId}/settings`}
                    label="Settings"
                    icon="⚙"
                    active={pathname === `/dashboard/${activeServerId}/settings`}
                  />
                  <NavItem
                    href={`/dashboard/${activeServerId}/lore`}
                    label="Lore"
                    icon="📜"
                    active={pathname === `/dashboard/${activeServerId}/lore`}
                  />
                </>
              )}
              <NavItem
                href={`/dashboard/${activeServerId}/history`}
                label="History"
                icon="💬"
                active={pathname === `/dashboard/${activeServerId}/history`}
              />
            </>
          ) : (
            <>
              <NavItem href="/dashboard" label="All Servers" icon="☰" active={pathname === '/dashboard'} />
              <NavItem href="/dashboard" label="Account" icon="◉" active={false} />
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2 px-2">
            <div className="w-6 h-6 rounded-full bg-bg-overlay flex items-center justify-center text-[10px] font-semibold text-text-muted">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-text-muted text-xs truncate">{userName}</span>
          </div>
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
            <a href="/api/auth/signout" className="text-[11px] text-text-muted hover:text-text transition">
              Sign out
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}

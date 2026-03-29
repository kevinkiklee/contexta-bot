import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkServerMembership } from '@/lib/auth-helpers';
import { pool } from '@/lib/db';

export default async function ServerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const membership = await checkServerMembership(pool, session.user.id, serverId);

  if (!membership) {
    return (
      <div className="rounded-2xl border border-error/20 bg-error/5 p-8 text-center animate-fade-in">
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

  return <>{children}</>;
}

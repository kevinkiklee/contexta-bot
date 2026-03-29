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
      <div className="rounded-xl border border-border bg-bg-raised p-8 text-center animate-fade-in">
        <h1 className="text-xl font-bold text-error mb-2">Access Denied</h1>
        <p className="text-text-muted">You are not a member of this server.</p>
      </div>
    );
  }

  return <>{children}</>;
}

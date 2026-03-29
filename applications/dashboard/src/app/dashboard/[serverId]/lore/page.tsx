import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerLore, updateServerLore } from '@/lib/queries';
import { pool } from '@/lib/db';
import { getSelectedBotId } from '@/lib/bot-cookie';
import { LoreForm } from './lore-form';

export default async function LorePage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const isAdmin = await checkServerAdmin(pool, session.user.id, serverId);
  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-error/20 bg-error/5 p-8 text-center animate-fade-in">
        <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-error" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-error mb-1">Access Denied</h1>
        <p className="text-text-muted text-sm">Only server administrators can edit lore.</p>
      </div>
    );
  }

  const botId = await getSelectedBotId();
  const lore = await getServerLore(pool, serverId, botId);

  async function handleUpdateLore(formData: FormData) {
    'use server';
    const text = formData.get('lore') as string;
    if (!text || text.length > 10_000) return;
    await updateServerLore(pool, serverId, botId, text);
    revalidatePath(`/dashboard/${serverId}/lore`);
    redirect(`/dashboard/${serverId}/lore`);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Server Lore</h1>
        <p className="text-text-muted text-sm mt-1">Define the rules, themes, and personality for your server</p>
      </div>

      <LoreForm action={handleUpdateLore} defaultValue={lore ?? ''} />
    </div>
  );
}

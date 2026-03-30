import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerLore, updateServerLore } from '@/lib/queries';
import { pool } from '@/lib/db';
import { getSelectedBotId } from '@/lib/bot-cookie';
import { LoreForm } from './lore-form';
import { SavedBanner } from '@/components/saved-banner';

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
      <div className="border border-border rounded-lg p-6 bg-bg-raised flex items-center gap-3">
        <svg className="w-5 h-5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-sm text-text-muted">You need admin permissions to access this page.</p>
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
    redirect(`/dashboard/${serverId}/lore?saved=true`);
  }

  return (
    <div>
      <SavedBanner />

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Server Lore</h1>
        <p className="text-text-muted text-sm mt-1">Define the rules, themes, and personality for your server</p>
      </div>

      <LoreForm action={handleUpdateLore} defaultValue={lore ?? ''} />
    </div>
  );
}

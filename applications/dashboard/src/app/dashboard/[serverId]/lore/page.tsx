import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerLore, updateServerLore } from '@/lib/queries';
import { pool } from '@/lib/db';
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
      <div className="p-6">
        <h1 className="text-xl font-bold text-error">Access Denied</h1>
        <p className="text-text-muted mt-2">Only server administrators can edit lore.</p>
      </div>
    );
  }

  const lore = await getServerLore(pool, serverId);

  async function handleUpdateLore(formData: FormData) {
    'use server';
    const text = formData.get('lore') as string;
    if (!text || text.length > 10_000) return;
    await updateServerLore(pool, serverId, text);
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

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerSettings, updateServerModel } from '@/lib/queries';
import { pool } from '@/lib/db';

const AVAILABLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
];

export default async function SettingsPage({
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
        <p className="text-text-muted mt-2">Only server administrators can access settings.</p>
      </div>
    );
  }

  const settings = await getServerSettings(pool, serverId);

  async function handleUpdateModel(formData: FormData) {
    'use server';
    const model = formData.get('model') as string;
    if (AVAILABLE_MODELS.includes(model)) {
      await updateServerModel(pool, serverId, model);
    }
    revalidatePath(`/dashboard/${serverId}/settings`);
    redirect(`/dashboard/${serverId}/settings`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <form action={handleUpdateModel} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-text-muted mb-1">
            Active Model
          </label>
          <select
            name="model"
            id="model"
            defaultValue={settings?.active_model ?? 'gemini-2.5-flash'}
            className="w-full rounded-lg bg-bg-raised border border-border p-2 text-text"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-white font-medium hover:bg-primary-hover transition"
        >
          Save
        </button>
      </form>
    </div>
  );
}

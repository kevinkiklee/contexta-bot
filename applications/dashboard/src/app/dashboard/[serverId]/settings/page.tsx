import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerSettings, updateServerModel } from '@/lib/queries';
import { pool } from '@/lib/db';

const MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic' },
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
  const currentModel = settings?.active_model ?? 'gemini-2.5-flash';

  async function handleUpdateModel(formData: FormData) {
    'use server';
    const model = formData.get('model') as string;
    if (MODELS.some((m) => m.id === model)) {
      await updateServerModel(pool, serverId, model);
    }
    revalidatePath(`/dashboard/${serverId}/settings`);
    redirect(`/dashboard/${serverId}/settings`);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-text-muted text-sm mt-1">Configure your bot for this server</p>
      </div>

      <form action={handleUpdateModel}>
        <div className="rounded-xl border border-border bg-bg-raised p-6 max-w-lg">
          <h2 className="text-sm font-semibold mb-4">Model Selection</h2>
          <div className="space-y-2">
            {MODELS.map((model) => (
              <label
                key={model.id}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                  currentModel === model.id
                    ? 'border-primary bg-bg-overlay ring-2 ring-primary'
                    : 'border-border hover:border-accent'
                }`}
              >
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  defaultChecked={currentModel === model.id}
                  className="sr-only"
                />
                <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                  currentModel === model.id
                    ? 'border-primary bg-primary'
                    : 'border-border'
                }`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{model.name}</div>
                  <div className="text-xs text-text-muted">{model.provider}</div>
                </div>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="btn-press mt-6 rounded-lg bg-primary px-5 py-2 text-white text-sm font-medium hover:bg-primary-hover transition"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

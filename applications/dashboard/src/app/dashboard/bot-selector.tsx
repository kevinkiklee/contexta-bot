'use client';

import { useRouter } from 'next/navigation';
import type { BotConfig } from '@/lib/bots';

export function BotSelector({ bots, activeBotId }: { bots: BotConfig[]; activeBotId: string }) {
  const router = useRouter();

  if (bots.length <= 1) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    document.cookie = `bot_id=${e.target.value};path=/;max-age=31536000`;
    router.refresh();
  }

  return (
    <div className="px-3 mb-2">
      <label className="text-[10px] text-text-muted uppercase tracking-wider font-medium block mb-1">Bot</label>
      <select
        value={activeBotId}
        onChange={handleChange}
        className="w-full text-xs bg-bg-overlay border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
      >
        {bots.map((bot) => (
          <option key={bot.botId} value={bot.botId}>
            {bot.label}
          </option>
        ))}
      </select>
    </div>
  );
}

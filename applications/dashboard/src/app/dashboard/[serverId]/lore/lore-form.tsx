'use client';

import { useState } from 'react';

const MAX_LENGTH = 10_000;
const WARN_THRESHOLD = 9_500;

interface LoreFormProps {
  action: (formData: FormData) => void;
  defaultValue: string;
}

export function LoreForm({ action, defaultValue }: LoreFormProps) {
  const [length, setLength] = useState(defaultValue.length);

  return (
    <form action={action}>
      <div className="max-w-2xl">
        <div className="rounded-xl border border-border bg-bg-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-bg-overlay/50 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Lore Content</h2>
            <span className={`text-xs font-[family-name:var(--font-mono)] tabular-nums ${length > WARN_THRESHOLD ? 'text-error font-medium' : 'text-text-muted'}`}>
              {length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
            </span>
          </div>
          <textarea
            name="lore"
            rows={16}
            defaultValue={defaultValue}
            onChange={(e) => setLength(e.target.value.length)}
            placeholder="Enter your server's lore, rules, and themes..."
            className="w-full bg-transparent p-4 text-text text-sm resize-y focus:outline-none min-h-[200px] placeholder:text-text-muted/50"
          />
        </div>
        <div className="flex justify-end mt-4">
          <button
            type="submit"
            className="btn-press rounded-xl bg-primary px-5 py-2.5 text-white text-sm font-semibold hover:bg-primary-hover transition shadow-sm shadow-primary/20"
          >
            Save Lore
          </button>
        </div>
      </div>
    </form>
  );
}

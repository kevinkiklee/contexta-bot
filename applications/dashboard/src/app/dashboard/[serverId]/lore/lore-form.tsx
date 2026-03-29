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
      <div className="rounded-xl border border-border bg-bg-raised p-6 max-w-2xl">
        <h2 className="text-sm font-semibold mb-4">Lore Content</h2>
        <textarea
          name="lore"
          rows={14}
          defaultValue={defaultValue}
          onChange={(e) => setLength(e.target.value.length)}
          placeholder="Enter your server's lore, rules, and themes..."
          className="w-full rounded-lg bg-bg border border-border p-3 text-text text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
        <div className="flex items-center justify-between mt-3">
          <span className={`text-xs ${length > WARN_THRESHOLD ? 'text-error' : 'text-text-muted'}`}>
            {length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
          </span>
          <button
            type="submit"
            className="btn-press rounded-lg bg-primary px-5 py-2 text-white text-sm font-medium hover:bg-primary-hover transition"
          >
            Save Lore
          </button>
        </div>
      </div>
    </form>
  );
}

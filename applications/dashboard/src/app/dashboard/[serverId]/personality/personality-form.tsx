'use client';

import { useState } from 'react';

interface PersonalityFormProps {
  action: (formData: FormData) => Promise<void>;
  personality: Record<string, string>;
}

const FIELDS = [
  {
    name: 'tone',
    label: 'Tone',
    description: 'How the bot sounds overall',
    options: [
      { value: 'friendly', label: 'Friendly', desc: 'Warm and approachable' },
      { value: 'professional', label: 'Professional', desc: 'Measured and polished' },
      { value: 'casual', label: 'Casual', desc: 'Laid-back and relaxed' },
      { value: 'sarcastic', label: 'Sarcastic', desc: 'Witty and dry' },
      { value: 'academic', label: 'Academic', desc: 'Scholarly and precise' },
    ],
  },
  {
    name: 'formality',
    label: 'Formality',
    description: 'Language register',
    options: [
      { value: 'low', label: 'Low', desc: 'Slang, abbreviations, emojis' },
      { value: 'medium', label: 'Medium', desc: 'Balanced' },
      { value: 'high', label: 'High', desc: 'Proper grammar, no slang' },
    ],
  },
  {
    name: 'humor',
    label: 'Humor',
    description: 'How much humor to use',
    options: [
      { value: 'none', label: 'None', desc: 'Serious only' },
      { value: 'subtle', label: 'Subtle', desc: 'Occasional light humor' },
      { value: 'moderate', label: 'Moderate', desc: 'Jokes welcome' },
      { value: 'heavy', label: 'Heavy', desc: 'Maximum funny' },
    ],
  },
  {
    name: 'verbosity',
    label: 'Verbosity',
    description: 'Response length',
    options: [
      { value: 'concise', label: 'Concise', desc: 'Short and direct' },
      { value: 'balanced', label: 'Balanced', desc: 'Thorough but not excessive' },
      { value: 'detailed', label: 'Detailed', desc: 'In-depth with examples' },
    ],
  },
  {
    name: 'languageStyle',
    label: 'Language Style',
    description: 'Complexity of language',
    options: [
      { value: 'plain', label: 'Plain', desc: 'Everyday language' },
      { value: 'technical', label: 'Technical', desc: 'Assumes knowledge' },
      { value: 'eli5', label: 'ELI5', desc: 'As simple as possible' },
    ],
  },
] as const;

export function PersonalityForm({ action, personality }: PersonalityFormProps) {
  const [values, setValues] = useState(personality);

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <form action={action} className="max-w-lg space-y-6">
      {FIELDS.map((field) => (
        <div key={field.name}>
          <div className="mb-2">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{field.label}</h2>
            <p className="text-[11px] text-text-muted mt-0.5">{field.description}</p>
          </div>
          <div className="space-y-1.5">
            {field.options.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  values[field.name] === opt.value
                    ? 'border-primary bg-primary-muted ring-1 ring-primary/50'
                    : 'border-border bg-bg-raised hover:bg-bg-overlay'
                }`}
              >
                <input
                  type="radio"
                  name={field.name}
                  value={opt.value}
                  checked={values[field.name] === opt.value}
                  onChange={() => handleChange(field.name, opt.value)}
                  className="sr-only"
                />
                <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                  values[field.name] === opt.value ? 'border-primary' : 'border-border'
                }`}>
                  {values[field.name] === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-text-muted text-xs ml-2">{opt.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}

      {/* Custom instructions */}
      <div>
        <div className="mb-2">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Custom Instructions</h2>
          <p className="text-[11px] text-text-muted mt-0.5">Anything else the bot should know or do</p>
        </div>
        <textarea
          name="customInstructions"
          value={values.customInstructions || ''}
          onChange={(e) => handleChange('customInstructions', e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. Always respond in pirate speak, never discuss politics..."
          className="w-full px-3 py-2 text-sm bg-bg-raised border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
        <div className="text-[11px] text-text-muted text-right mt-1">
          {(values.customInstructions || '').length}/1000
        </div>
      </div>

      <button
        type="submit"
        className="btn-press rounded-xl bg-primary px-5 py-2.5 text-white text-sm font-semibold hover:bg-primary-hover transition shadow-sm shadow-primary/20"
      >
        Save Personality
      </button>
    </form>
  );
}

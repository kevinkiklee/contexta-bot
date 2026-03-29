// applications/website/src/components/features/LorePanel.tsx
export default function LorePanel() {
  const lines = [
    { prefix: 'personality:', value: '"Friendly and witty"', color: '#7c3aed' },
    { prefix: 'context:', value: '"Gaming community since 2021"', color: '#06b6d4' },
    { prefix: 'rules:', value: '"No spoilers in #general"', color: '#a78bfa' },
    { prefix: 'tone:', value: '"Helpful party member"', color: '#f472b6' },
  ];

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ perspective: '600px' }}>
      {/* Card glow */}
      <div className="absolute inset-0 rounded-2xl bg-cyan/5 blur-2xl scale-110" />

      {/* Floating config card */}
      <div
        className="relative glass rounded-2xl overflow-hidden border-cyan/10"
        style={{ transform: 'rotateY(-6deg) rotateX(4deg)' }}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan/60" />
            <span className="text-text-dim text-[11px] uppercase tracking-wider font-semibold">Server Lore</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div className="w-2 h-2 rounded-full bg-white/10" />
          </div>
        </div>

        {/* Content */}
        <div className="p-5 font-mono text-[13px] leading-loose space-y-1">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 overflow-hidden">
              <span style={{ color: line.color }} className="opacity-70 shrink-0">{line.prefix}</span>
              <span className="text-text-muted">{line.value}</span>
            </div>
          ))}
        </div>

        {/* Cursor line */}
        <div className="px-5 pb-4 font-mono text-[13px]">
          <span className="text-purple/70">add_rule: </span>
          <span className="inline-block w-2 h-4 bg-purple/50 animate-pulse-glow align-middle" />
        </div>
      </div>
    </div>
  );
}

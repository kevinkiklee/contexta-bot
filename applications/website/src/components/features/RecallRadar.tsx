// applications/website/src/components/features/RecallRadar.tsx
export default function RecallRadar() {
  const matches = [
    { angle: 30, distance: 0.55, label: '94%', color: '#7c3aed' },
    { angle: 150, distance: 0.7, label: '82%', color: '#a78bfa' },
    { angle: 260, distance: 0.85, label: '71%', color: '#06b6d4' },
  ];

  const dimNodes = [
    { angle: 80, distance: 0.9 },
    { angle: 190, distance: 0.6 },
    { angle: 310, distance: 0.75 },
    { angle: 350, distance: 0.5 },
    { angle: 120, distance: 0.95 },
  ];

  const cx = 200;
  const cy = 200;
  const maxR = 160;

  return (
    <div className="relative w-full max-w-md mx-auto">
      <svg viewBox="0 0 400 400" fill="none" className="w-full">
        {/* Sonar pulse rings */}
        {[1, 2, 3].map((i) => (
          <circle key={i} cx={cx} cy={cy} r="30" fill="none" stroke="#7c3aed" strokeWidth="0.5" opacity="0.3">
            <animate attributeName="r" values="30;160;30" dur="4s" repeatCount="indefinite" begin={`${i * 1.3}s`} />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="4s" repeatCount="indefinite" begin={`${i * 1.3}s`} />
          </circle>
        ))}

        {/* Background grid rings */}
        {[0.33, 0.66, 1].map((pct, i) => (
          <circle key={i} cx={cx} cy={cy} r={maxR * pct} fill="none" stroke="white" strokeWidth="0.3" opacity="0.05" />
        ))}

        {/* Center search node */}
        <circle cx={cx} cy={cy} r="16" fill="#7c3aed" opacity="0.2" />
        <circle cx={cx} cy={cy} r="8" fill="#7c3aed" opacity="0.6" />
        <circle cx={cx - 2} cy={cy - 2} r="4" fill="none" stroke="white" strokeWidth="1.5" opacity="0.8" />
        <line x1={cx + 1} y1={cy + 1} x2={cx + 4} y2={cy + 4} stroke="white" strokeWidth="1.5" opacity="0.8" strokeLinecap="round" />

        {/* Dim nodes */}
        {dimNodes.map((n, i) => {
          const rad = (n.angle * Math.PI) / 180;
          const nx = cx + maxR * n.distance * Math.cos(rad);
          const ny = cy + maxR * n.distance * Math.sin(rad);
          return <circle key={`dim-${i}`} cx={nx} cy={ny} r="3" fill="#6b5a85" opacity="0.2" />;
        })}

        {/* Matching nodes */}
        {matches.map((m, i) => {
          const rad = (m.angle * Math.PI) / 180;
          const nx = cx + maxR * m.distance * Math.cos(rad);
          const ny = cy + maxR * m.distance * Math.sin(rad);
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={m.color} strokeWidth="1" opacity="0.3" strokeDasharray="4 4">
                <animate attributeName="opacity" values="0.1;0.4;0.1" dur="3s" repeatCount="indefinite" begin={`${i * 0.5}s`} />
              </line>
              <circle cx={nx} cy={ny} r="12" fill={m.color} opacity="0.1">
                <animate attributeName="opacity" values="0.05;0.2;0.05" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={nx} cy={ny} r="5" fill={m.color} opacity="0.8" />
              <rect x={nx + 8} y={ny - 10} width="30" height="16" rx="4" fill={m.color} fillOpacity="0.15" stroke={m.color} strokeOpacity="0.3" strokeWidth="0.5" />
              <text x={nx + 23} y={ny + 1} textAnchor="middle" fill={m.color} fontSize="9" fontFamily="var(--font-sans)" fontWeight="bold">{m.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

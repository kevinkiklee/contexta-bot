// applications/website/src/components/features/MemoryTimeline.tsx
export default function MemoryTimeline() {
  const nodes = [
    { y: 30, label: '2 weeks ago', size: 8, text: 'movie night debate...', color: '#7c3aed' },
    { y: 100, label: '1 week ago', size: 10, text: 'Sam recommended ramen', color: '#a78bfa' },
    { y: 170, label: '3 days ago', size: 13, text: 'hiking trip photos 🏔️', color: '#06b6d4' },
    { y: 240, label: 'yesterday', size: 15, text: 'karaoke plans Friday', color: '#7c3aed' },
    { y: 310, label: 'now', size: 18, text: 'asking about plans...', color: '#06b6d4' },
  ];

  return (
    <div className="relative w-full max-w-md mx-auto h-[380px]">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 380" fill="none">
        <defs>
          <linearGradient id="timeline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Timeline line */}
        <line x1="80" y1="20" x2="80" y2="360" stroke="url(#timeline-grad)" strokeWidth="2" />

        {/* Nodes */}
        {nodes.map((n, i) => (
          <g key={i} opacity="0" className="animate-fade-in-up" style={{ animationDelay: `${i * 200}ms`, animationFillMode: 'forwards' }}>
            {/* Glow */}
            <circle cx="80" cy={n.y + 15} r={n.size * 1.5} fill={n.color} opacity="0.1">
              <animate attributeName="opacity" values="0.05;0.15;0.05" dur={`${3 + i}s`} repeatCount="indefinite" />
            </circle>
            {/* Core dot */}
            <circle cx="80" cy={n.y + 15} r={n.size / 2} fill={n.color} opacity="0.8" />
            {/* Connection dashes to card */}
            <line x1={80 + n.size / 2 + 4} y1={n.y + 15} x2="140" y2={n.y + 15} stroke={n.color} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
            {/* Card */}
            <rect x="140" y={n.y} width="220" height="30" rx="8" fill="white" fillOpacity="0.03" stroke="white" strokeOpacity="0.06" strokeWidth="1" />
            <text x="152" y={n.y + 19} fill="#e8e0f0" fontSize="11" fontFamily="var(--font-sans)">{n.text}</text>
            {/* Timestamp */}
            <text x="82" y={n.y + 35} fill="#6b5a85" fontSize="9" fontFamily="var(--font-sans)">{n.label}</text>
          </g>
        ))}

        {/* Pulse at bottom */}
        <circle cx="80" cy="325" r="18" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.4">
          <animate attributeName="r" values="18;28;18" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Memory bank glow at bottom */}
        <rect x="30" y="340" width="100" height="24" rx="12" fill="none" stroke="#7c3aed" strokeWidth="1" opacity="0.3">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" />
        </rect>
        <text x="80" y="356" textAnchor="middle" fill="#7c3aed" fontSize="8" fontFamily="var(--font-sans)" opacity="0.6">MEMORY STORED</text>
      </svg>
    </div>
  );
}

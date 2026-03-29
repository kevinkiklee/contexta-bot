export default function BrainIllustration({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'w-64 h-64 sm:w-80 sm:h-80' : 'w-32 h-32 sm:w-40 sm:h-40';
  const viewBox = '0 0 300 300';

  return (
    <div className={`relative ${dim} mx-auto`} style={{ perspective: '800px' }}>
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full bg-purple/10 blur-3xl scale-[1.8] animate-pulse-glow" />
      <div className="absolute inset-4 rounded-full bg-cyan/8 blur-2xl scale-150 animate-float-slow" />

      {/* Rotating ring assembly */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={viewBox}
        fill="none"
        style={{ transform: 'rotateX(20deg) rotateY(-15deg)', transformStyle: 'preserve-3d' }}
      >
        <defs>
          <linearGradient id="ring1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="ring2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="ring3" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <radialGradient id="coreGlow">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Core glow */}
        <circle cx="150" cy="150" r="80" fill="url(#coreGlow)" />

        {/* Ring 1 - outer */}
        <ellipse cx="150" cy="150" rx="130" ry="130" stroke="url(#ring1)" strokeWidth="1.5" opacity="0.4" strokeDasharray="8 12">
          <animateTransform attributeName="transform" type="rotate" from="0 150 150" to="360 150 150" dur="30s" repeatCount="indefinite" />
        </ellipse>

        {/* Ring 2 - middle */}
        <ellipse cx="150" cy="150" rx="100" ry="60" stroke="url(#ring2)" strokeWidth="1" opacity="0.3" strokeDasharray="6 10">
          <animateTransform attributeName="transform" type="rotate" from="60 150 150" to="420 150 150" dur="25s" repeatCount="indefinite" />
        </ellipse>

        {/* Ring 3 - inner tilted */}
        <ellipse cx="150" cy="150" rx="70" ry="100" stroke="url(#ring3)" strokeWidth="1" opacity="0.35" strokeDasharray="4 8">
          <animateTransform attributeName="transform" type="rotate" from="120 150 150" to="480 150 150" dur="20s" repeatCount="indefinite" />
        </ellipse>

        {/* Orbiting nodes */}
        {[
          { rx: 130, ry: 130, dur: '12s', r: 4, color: '#7c3aed', startAngle: 0 },
          { rx: 130, ry: 130, dur: '12s', r: 3, color: '#06b6d4', startAngle: 180 },
          { rx: 100, ry: 60, dur: '8s', r: 3.5, color: '#a78bfa', startAngle: 90 },
          { rx: 70, ry: 100, dur: '15s', r: 3, color: '#06b6d4', startAngle: 270 },
          { rx: 100, ry: 60, dur: '8s', r: 2.5, color: '#7c3aed', startAngle: 45 },
        ].map((node, i) => {
          const rad = (node.startAngle * Math.PI) / 180;
          const cx = 150 + node.rx * Math.cos(rad);
          const cy = 150 + node.ry * Math.sin(rad);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={node.r} fill={node.color} opacity="0.8">
                <animateTransform attributeName="transform" type="rotate" from={`${node.startAngle} 150 150`} to={`${node.startAngle + 360} 150 150`} dur={node.dur} repeatCount="indefinite" />
              </circle>
              <circle cx={cx} cy={cy} r={node.r * 2.5} fill={node.color} opacity="0.15">
                <animateTransform attributeName="transform" type="rotate" from={`${node.startAngle} 150 150`} to={`${node.startAngle + 360} 150 150`} dur={node.dur} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.1;0.25;0.1" dur="3s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {/* Intersection glow nodes (stationary) */}
        {[
          [150, 20], [280, 150], [150, 280], [20, 150],
          [220, 90], [80, 210], [220, 210], [80, 90],
        ].map(([x, y], i) => (
          <circle key={`glow-${i}`} cx={x} cy={y} r="2" fill="#a78bfa" opacity="0.5">
            <animate attributeName="opacity" values="0.2;0.7;0.2" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" begin={`${i * 0.4}s`} />
            <animate attributeName="r" values="1.5;3;1.5" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" begin={`${i * 0.4}s`} />
          </circle>
        ))}

        {/* Central core orb */}
        <circle cx="150" cy="150" r="25" fill="#0a0612" stroke="url(#ring1)" strokeWidth="1.5" opacity="0.8" />
        <circle cx="150" cy="150" r="18" fill="url(#ring1)" opacity="0.15" />
        <text x="150" y="157" textAnchor="middle" fontSize="22" className="select-none">🧠</text>
      </svg>
    </div>
  );
}

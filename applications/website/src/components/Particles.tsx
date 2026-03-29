export default function Particles({
  count = 20,
  color = '#7c3aed',
  className = '',
}: {
  count?: number;
  color?: string;
  className?: string;
}) {
  const particles = Array.from({ length: count }, (_, i) => ({
    left: `${(i * 37 + 13) % 100}%`,
    top: `${(i * 53 + 7) % 100}%`,
    size: 1.5 + (i % 3),
    duration: 6 + (i % 5) * 2,
    delay: (i % 7) * 0.8,
    opacity: 0.15 + (i % 4) * 0.1,
  }));

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float-slow"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

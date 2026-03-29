export default function GlowBlob({
  color = 'purple',
  size = 400,
  className = '',
}: {
  color?: 'purple' | 'cyan';
  size?: number;
  className?: string;
}) {
  const colorClass = color === 'purple' ? 'bg-purple/8' : 'bg-cyan/6';
  return (
    <div
      className={`absolute rounded-full ${colorClass} pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        filter: `blur(${Math.round(size * 0.3)}px)`,
      }}
    />
  );
}

// applications/website/src/components/features/ProfileStack.tsx
export default function ProfileStack() {
  const profiles = [
    { name: 'Alex', tags: ['Loves hiking', 'Night owl'], color: '#7c3aed', z: 30, rotate: -8 },
    { name: 'Sam', tags: ['Python dev', 'Foodie'], color: '#06b6d4', z: 15, rotate: 0 },
    { name: 'Jordan', tags: ['Casual gamer', 'Pun lover'], color: '#f472b6', z: 0, rotate: 6 },
  ];

  return (
    <div className="relative w-full max-w-sm mx-auto h-[320px]" style={{ perspective: '800px' }}>
      {profiles.map((p, i) => (
        <div
          key={p.name}
          className="absolute left-1/2 glass rounded-2xl p-5 w-52 transition-transform duration-500 hover:-translate-y-2"
          style={{
            transform: `translateX(-50%) rotateX(8deg) rotateY(${p.rotate}deg) translateZ(${p.z}px)`,
            top: `${i * 70 + 20}px`,
            zIndex: profiles.length - i,
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: p.color }}
            >
              {p.name[0]}
            </div>
            <div>
              <p className="text-text font-semibold text-sm">{p.name}</p>
              <p className="text-text-dim text-[10px]">Member</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: `${p.color}15`, color: p.color }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

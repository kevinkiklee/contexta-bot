export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="h-7 w-36 skeleton-shimmer rounded-lg mb-2" />
      <div className="h-4 w-64 skeleton-shimmer rounded-md mb-6" />

      {/* Filter bar placeholder */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 h-9 skeleton-shimmer rounded-lg" />
        <div className="h-9 w-28 skeleton-shimmer rounded-lg" />
        <div className="h-9 w-28 skeleton-shimmer rounded-lg" />
        <div className="h-9 w-24 skeleton-shimmer rounded-lg" />
      </div>

      {/* Message rows */}
      <div className="rounded-xl border border-border overflow-hidden bg-bg-raised">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 h-12 border-b border-border last:border-b-0"
          >
            <div className="w-7 h-7 rounded-full skeleton-shimmer shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 skeleton-shimmer rounded w-3/4" />
              <div className="h-2.5 skeleton-shimmer rounded w-1/2" />
            </div>
            <div className="h-3 w-16 skeleton-shimmer rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

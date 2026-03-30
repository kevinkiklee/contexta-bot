export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="h-7 w-44 skeleton-shimmer rounded-lg mb-2" />
      <div className="h-4 w-72 skeleton-shimmer rounded-md mb-8" />

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-bg-raised p-4">
            <div className="h-3 w-20 skeleton-shimmer rounded mb-3" />
            <div className="h-7 w-12 skeleton-shimmer rounded" />
          </div>
        ))}
      </div>

      {/* Search/filter bar placeholder */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 h-9 skeleton-shimmer rounded-lg" />
        <div className="h-9 w-20 skeleton-shimmer rounded-lg" />
        <div className="h-9 w-28 skeleton-shimmer rounded-lg" />
        <div className="h-9 w-24 skeleton-shimmer rounded-lg" />
      </div>

      {/* Table rows */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="h-10 skeleton-shimmer border-b border-border" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-bg-raised border-b border-border last:border-b-0 flex items-center px-4 gap-4">
            <div className="h-3 w-16 skeleton-shimmer rounded" />
            <div className="h-3 w-40 skeleton-shimmer rounded flex-1" />
            <div className="h-5 w-16 skeleton-shimmer rounded-md" />
            <div className="h-5 w-16 skeleton-shimmer rounded-md" />
            <div className="h-3 w-12 skeleton-shimmer rounded" />
            <div className="h-3 w-20 skeleton-shimmer rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

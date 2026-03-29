export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="h-7 w-40 skeleton-shimmer rounded-lg mb-2" />
      <div className="h-4 w-56 skeleton-shimmer rounded-md mb-8" />
      <div className="space-y-2">
        <div className="h-[68px] skeleton-shimmer rounded-xl" />
        <div className="h-[68px] skeleton-shimmer rounded-xl" />
        <div className="h-[68px] skeleton-shimmer rounded-xl" />
      </div>
    </div>
  );
}

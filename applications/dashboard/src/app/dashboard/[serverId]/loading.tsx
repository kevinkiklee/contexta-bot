export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="h-7 w-32 skeleton-shimmer rounded-lg mb-2" />
      <div className="h-4 w-52 skeleton-shimmer rounded-md mb-8" />
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="h-[100px] skeleton-shimmer rounded-xl" />
        <div className="h-[100px] skeleton-shimmer rounded-xl" />
      </div>
      <div className="h-3 w-24 skeleton-shimmer rounded-md mb-4" />
      <div className="space-y-2">
        <div className="h-[68px] skeleton-shimmer rounded-xl" />
        <div className="h-[68px] skeleton-shimmer rounded-xl" />
      </div>
    </div>
  );
}

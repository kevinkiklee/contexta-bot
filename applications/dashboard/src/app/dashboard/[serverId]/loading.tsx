export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="h-6 w-48 bg-bg-raised rounded animate-pulse mb-4" />
      <div className="h-4 w-64 bg-bg-raised rounded animate-pulse mb-8" />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="h-24 bg-bg-raised rounded-xl animate-pulse" />
        <div className="h-24 bg-bg-raised rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

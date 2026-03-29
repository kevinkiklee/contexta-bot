export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="h-6 w-48 bg-bg-raised rounded animate-pulse mb-4" />
      <div className="h-4 w-64 bg-bg-raised rounded animate-pulse mb-8" />
      <div className="space-y-3">
        <div className="h-16 bg-bg-raised rounded-lg animate-pulse" />
        <div className="h-16 bg-bg-raised rounded-lg animate-pulse" />
        <div className="h-16 bg-bg-raised rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

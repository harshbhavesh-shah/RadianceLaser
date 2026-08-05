import Skeleton from "@/components/ui/Skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-7 w-32" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-64 w-full rounded-xl" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

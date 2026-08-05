import Skeleton from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="h-5 w-36" />
          <div className="mt-2 mb-3 h-[2px] w-8 bg-gold-500" />
          <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`px-5 py-4 ${i !== 3 ? "border-b border-beige-300" : ""}`}>
                <Skeleton className="h-4 w-56" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="h-5 w-32" />
          <div className="mt-2 mb-3 h-[2px] w-8 bg-gold-500" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>

      <div>
        <Skeleton className="h-5 w-44" />
        <div className="mt-2 mb-4 h-[2px] w-8 bg-gold-500" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

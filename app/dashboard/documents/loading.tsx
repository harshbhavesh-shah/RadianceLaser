import Skeleton from "@/components/ui/Skeleton";

export default function DocumentsLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-1 rounded-lg bg-surface p-1 shadow-soft ring-1 ring-beige-300 w-fit">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-3 w-64" />
          </div>
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>
        <Skeleton className="mb-4 h-10 w-full rounded-md" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

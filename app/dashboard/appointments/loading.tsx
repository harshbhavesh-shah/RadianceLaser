import Skeleton from "@/components/ui/Skeleton";

export default function AppointmentsLoading() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-soft ring-1 ring-beige-300">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-4 w-full" />
          ))}
          {Array.from({ length: 28 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

import Skeleton from "@/components/ui/Skeleton";

export default function PatientDetailLoading() {
  return (
    <div>
      <Skeleton className="h-4 w-24" />

      <div className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-48" />
          <div className="mt-2 h-[2px] w-8 bg-gold-500" />
        </div>
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>

      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <Skeleton className="h-5 w-32" />
        <div className="mt-2 mb-4 h-[2px] w-8 bg-gold-500" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

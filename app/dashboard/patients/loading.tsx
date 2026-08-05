import Skeleton from "@/components/ui/Skeleton";

export default function PatientsLoading() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-28" />
          <div className="mt-2 h-[2px] w-8 bg-gold-500" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      <Skeleton className="mb-5 h-11 w-full rounded-md" />

      <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-5 py-4 ${i !== 6 ? "border-b border-beige-300" : ""}`}
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

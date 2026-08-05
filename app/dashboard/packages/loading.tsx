import Skeleton from "@/components/ui/Skeleton";

export default function PackagesLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-32" />
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-5 py-4 ${i !== 5 ? "border-b border-beige-300" : ""}`}
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

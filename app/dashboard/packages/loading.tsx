import Skeleton from "@/components/ui/Skeleton";

export default function PackagesLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-2 h-4 w-96" />
      <div className="mt-2 mb-8 h-[2px] w-8 bg-rust-600" />

      <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-2 h-4 w-40" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

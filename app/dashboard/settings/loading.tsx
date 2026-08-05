import Skeleton from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-10 w-full rounded-md" />
          <Skeleton className="mt-3 h-10 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

import Skeleton from "@/components/ui/Skeleton";

export default function CommunicationLoading() {
  return (
    <div className="max-w-3xl space-y-6">
      <Skeleton className="h-7 w-40" />
      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-4 h-24 w-full rounded-lg" />
      </div>
      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}

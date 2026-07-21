import { getSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getSession();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Overview</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <p className="text-sm text-brown-600">
          Signed in as <span className="font-medium text-brown-900">{session?.email}</span>.
        </p>
        <p className="mt-2 text-sm text-brown-600">
          Head to <span className="font-medium text-brown-900">Patients</span> in the
          sidebar to get started.
        </p>
      </div>
    </div>
  );
}

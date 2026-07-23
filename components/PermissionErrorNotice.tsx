"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * Shown wherever a Firestore write can fail with "permission-denied". The
 * most common real cause isn't a rules bug — it's that Firebase custom
 * claims (clinicId, role) are baked into the ID token at sign-in and cached
 * client-side for its lifetime (see scripts/createClinic.mjs). If a
 * clinic/staff record's claims were set or changed after the current browser
 * session started, the cached token is stale and every write this rule
 * depends on gets rejected — signing out and back in fetches a fresh token
 * with the current claims. Putting the fix one click away here, instead of
 * just describing it in text, means someone hitting this doesn't have to go
 * hunt down the sidebar's Log Out link mid-task.
 */
export default function PermissionErrorNotice({ message }: { message: string }) {
  const router = useRouter();

  async function handleReauth() {
    await signOut(auth).catch(() => {});
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
      <p>{message}</p>
      <button
        type="button"
        onClick={handleReauth}
        className="mt-2 font-semibold underline hover:no-underline"
      >
        Sign out &amp; sign back in
      </button>
    </div>
  );
}

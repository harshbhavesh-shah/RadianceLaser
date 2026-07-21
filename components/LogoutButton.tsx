"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth).catch(() => {});
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs font-medium text-brown-400 transition-colors hover:text-gold-500"
    >
      Log Out
    </button>
  );
}

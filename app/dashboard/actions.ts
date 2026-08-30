"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { updateStaffFlags } from "@/lib/db/staff";

/** Called once the guided product tour finishes or is skipped, so it never
 * auto-launches again for this person — see components/onboarding/. */
export async function completeTourAction(): Promise<{ error?: string }> {
  try {
    const session = await getSession();
    if (!session) throw new Error("Not signed in.");

    await updateStaffFlags(session.uid, { tourCompleted: true });
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    console.error("Failed to mark tour completed:", err);
    return { error: "Couldn't save that. Please try again." };
  }
}

/** Called when someone closes the setup checklist — permanent per person,
 * regardless of how many steps were actually finished (see
 * types/index.ts StaffMember.onboardingDismissed). */
export async function dismissOnboardingAction(): Promise<{ error?: string }> {
  try {
    const session = await getSession();
    if (!session) throw new Error("Not signed in.");

    await updateStaffFlags(session.uid, { onboardingDismissed: true });
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    console.error("Failed to dismiss onboarding checklist:", err);
    return { error: "Couldn't save that. Please try again." };
  }
}

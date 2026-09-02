"use server";

import { getVisitFeedbackByToken, submitVisitFeedback } from "@/lib/db/visitFeedback";

// Deliberately no getSession()/auth check here — the token itself (an
// unguessable id, see prisma/schema.prisma's VisitFeedback comment) is
// what authorizes a patient to submit against it, the same way a
// password-reset link works. This is called from a page a patient reaches
// straight off a WhatsApp message, with no account to sign into.

export interface SubmitFeedbackState {
  error?: string;
  success?: boolean;
}

export async function submitFeedbackAction(
  token: string,
  _prevState: SubmitFeedbackState,
  formData: FormData
): Promise<SubmitFeedbackState> {
  const ratingRaw = formData.get("rating");
  const rating = Number(ratingRaw);
  if (!ratingRaw || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Pick a rating from 1 to 5." };
  }

  const comment = (formData.get("comment") as string)?.trim();

  try {
    const feedback = await getVisitFeedbackByToken(token);
    if (!feedback) return { error: "This feedback link isn't valid." };

    await submitVisitFeedback(token, rating, comment || undefined);
    return { success: true };
  } catch (err) {
    console.error("Failed to submit visit feedback:", err);
    return { error: "Something went wrong submitting this. Please try again." };
  }
}

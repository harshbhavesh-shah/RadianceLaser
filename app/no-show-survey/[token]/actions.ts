"use server";

import { getNoShowSurveyByToken, submitNoShowSurveyResponse } from "@/lib/db/noShowSurvey";
import type { NoShowReason } from "@/types";

// Deliberately no getSession()/auth check — the token itself is what
// authorizes a patient to submit against it, same as
// app/feedback/[token]/actions.ts's submitFeedbackAction.

const VALID_REASONS: NoShowReason[] = ["forgot", "schedule_conflict", "found_elsewhere", "cost", "other"];

export interface SubmitNoShowSurveyState {
  error?: string;
  success?: boolean;
}

export async function submitNoShowSurveyAction(
  token: string,
  _prevState: SubmitNoShowSurveyState,
  formData: FormData
): Promise<SubmitNoShowSurveyState> {
  const reason = formData.get("reason") as string;
  if (!VALID_REASONS.includes(reason as NoShowReason)) {
    return { error: "Pick a reason." };
  }

  const comment = (formData.get("comment") as string)?.trim();

  try {
    const survey = await getNoShowSurveyByToken(token);
    if (!survey) return { error: "This link isn't valid." };

    await submitNoShowSurveyResponse(token, reason as NoShowReason, comment || undefined);
    return { success: true };
  } catch (err) {
    console.error("Failed to submit no-show survey:", err);
    return { error: "Something went wrong submitting this. Please try again." };
  }
}

"use server";

import { verifyPasswordResetToken, consumePasswordResetToken, type PasswordResetTokenError } from "@/lib/auth/passwordReset";

function describeError(error: PasswordResetTokenError): string {
  switch (error) {
    case "expired":
      return "This link has expired. Request a new one.";
    case "used":
      return "This link has already been used. Request a new one.";
    case "invalid":
      return "This link is invalid. Request a new one.";
  }
}

export async function checkResetTokenAction(token: string): Promise<{ valid: boolean; error?: string }> {
  const result = await verifyPasswordResetToken(token);
  if ("error" in result) return { valid: false, error: describeError(result.error) };
  return { valid: true };
}

export async function resetPasswordAction(token: string, password: string): Promise<{ success?: boolean; error?: string }> {
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const result = await consumePasswordResetToken(token, password);
  if ("error" in result) return { error: describeError(result.error) };
  return { success: true };
}

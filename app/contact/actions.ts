"use server";

import { sendEmail } from "@/lib/email/resend";

const CONTACT_INBOX = "admin@radiancelaser.in";

export interface ContactFormState {
  error?: string;
  success?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function submitContactAction(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  // Honeypot: a field real visitors never see or fill (hidden off-screen in
  // ContactForm), so anything filling it in is a bot. Report success
  // without sending, rather than an error that would tip off a scraper.
  if ((formData.get("company") as string)?.trim()) {
    return { success: true };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  if (!name) return { error: "Enter your name." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!message || message.length < 10) return { error: "Tell us a bit more about what's going on." };

  try {
    await sendEmail({
      to: CONTACT_INBOX,
      subject: `Contact form: ${name}`,
      html: `
        <p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
        <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
      `,
      replyTo: email,
    });
    return { success: true };
  } catch (err) {
    console.error("Failed to send contact form email:", err);
    return { error: `Something went wrong sending this. Please email ${CONTACT_INBOX} directly.` };
  }
}

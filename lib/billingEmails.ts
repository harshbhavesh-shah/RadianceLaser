// Dunning email templates for the Razorpay Subscriptions auto-renew flow
// (see app/api/webhooks/razorpay/route.ts) — same inline-CSS, brand-colors
// style as app/api/cron/send-renewal-reminders' template, deliberately not
// shared/abstracted with it since that one is about a deadline approaching
// and these are about a charge attempt itself failing; different trigger,
// different content, coincidentally similar markup.

function emailShell(bodyHtml: string): string {
  return `
    <div style="background:#FBF8F3;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
      <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E8DDC9;border-radius:12px;padding:32px;">
        <div style="font-size:22px;font-weight:bold;color:#2C1D14;">Radiance Laser</div>
        <div style="height:2px;width:32px;background:#A9812F;margin:12px 0 24px;"></div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function paragraph(text: string): string {
  return `<p style="font-family:Arial,sans-serif;font-size:14px;color:#4A342A;margin:0 0 16px;">${text}</p>`;
}

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#FBF8F3;background:#2C1D14;border-radius:8px;padding:12px 24px;text-decoration:none;">${label}</a>`;
}

/** Sent once when a subscription enters "pending" — a charge attempt just
 * failed and Razorpay is automatically retrying on its own schedule (no
 * action needed unless the payment method itself is the problem). */
export function paymentRetryingEmailHtml(input: { clinicName: string; billingUrl: string }): string {
  return emailShell(
    paragraph(`We couldn't process ${input.clinicName}'s auto-renewal payment on the card/UPI mandate on file.`) +
      paragraph(
        "This is often temporary — an expired card, insufficient balance, or a bank decline. Razorpay will automatically retry the charge over the next few days; no action is needed unless the retries keep failing."
      ) +
      paragraph("If you'd rather update your payment method now, you can do that from Billing:") +
      button("Go to Billing", input.billingUrl)
  );
}

/** Sent once when Razorpay gives up retrying and halts the subscription —
 * auto-renew has effectively stopped, though the clinic's already-paid-for
 * access is untouched until its existing subscriptionRenewsAt passes. */
export function autoRenewHaltedEmailHtml(input: { clinicName: string; renewsAt: number; billingUrl: string }): string {
  const renewsAtStr = new Date(input.renewsAt).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return emailShell(
    paragraph(
      `After several failed attempts, ${input.clinicName}'s auto-renewal payment has stopped retrying and won't charge again automatically.`
    ) +
      paragraph(
        `Your access is safe through <b>${renewsAtStr}</b>, but nothing will renew it after that unless you update your payment method and re-enable auto-renew, or renew manually.`
      ) +
      button("Fix billing", input.billingUrl)
  );
}

/** Sent once when a subscription is cancelled (owner-initiated, or by
 * Razorpay after the mandate itself is no longer valid) — lower urgency
 * than the halted email since this path is expected/deliberate more often
 * than not. */
export function autoRenewCancelledEmailHtml(input: { clinicName: string; billingUrl: string }): string {
  return emailShell(
    paragraph(`Auto-renewal has been turned off for ${input.clinicName}.`) +
      paragraph(
        "Your subscription will need to be renewed manually from now on — the usual reminder emails as your renewal date approaches still apply."
      ) +
      button("Go to Billing", input.billingUrl)
  );
}

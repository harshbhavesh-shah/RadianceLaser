import { notFound } from "next/navigation";
import { getVisitFeedbackByToken } from "@/lib/db/visitFeedback";
import { getClinic } from "@/lib/db/clinics";
import FeedbackForm from "./FeedbackForm";

// Public page, no auth, reached from the WhatsApp message a patient gets
// after a visit. The token in the URL is what authorizes this, not a
// session.
export default async function FeedbackPage({ params }: { params: { token: string } }) {
  const feedback = await getVisitFeedbackByToken(params.token);
  if (!feedback) notFound();

  const clinic = await getClinic(feedback.clinicId);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md rounded-xl bg-surface p-8 shadow-card ring-1 ring-beige-300">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
          {clinic?.name || "Your Clinic"}
        </p>
        <h1 className="mt-2 text-center font-display text-2xl font-medium text-brown-900">
          How was your visit?
        </h1>
        <p className="mt-2 text-center text-sm text-brown-600">
          Hi {feedback.patientName.split(" ")[0]}, we'd love to hear how your recent session went.
        </p>

        <FeedbackForm
          token={feedback.token}
          alreadyResponded={feedback.rating != null}
          initialRating={feedback.rating}
          initialComment={feedback.comment}
        />
      </div>
    </div>
  );
}

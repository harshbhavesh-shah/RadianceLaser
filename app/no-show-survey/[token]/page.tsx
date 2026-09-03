import { notFound } from "next/navigation";
import { getNoShowSurveyByToken } from "@/lib/db/noShowSurvey";
import { getClinic } from "@/lib/db/clinics";
import NoShowSurveyForm from "./NoShowSurveyForm";

// Public page, no auth, reached from a "survey" kind NoShowFollowUp's
// WhatsApp message. Structurally a copy of app/feedback/[token]/page.tsx.
export default async function NoShowSurveyPage({ params }: { params: { token: string } }) {
  const survey = await getNoShowSurveyByToken(params.token);
  if (!survey) notFound();

  const clinic = await getClinic(survey.clinicId);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md rounded-xl bg-surface p-8 shadow-card ring-1 ring-beige-300">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
          {clinic?.name || "Your Clinic"}
        </p>
        <h1 className="mt-2 text-center font-display text-2xl font-medium text-brown-900">
          We missed you
        </h1>
        <p className="mt-2 text-center text-sm text-brown-600">
          Hi {survey.patientName.split(" ")[0]}, we noticed you weren&apos;t able to make your appointment.
          Mind telling us why? It helps us do better.
        </p>

        <NoShowSurveyForm
          token={survey.token}
          alreadyResponded={survey.reason != null}
          initialReason={survey.reason}
          initialComment={survey.comment}
        />
      </div>
    </div>
  );
}

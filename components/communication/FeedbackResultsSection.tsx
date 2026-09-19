import { Star } from "lucide-react";
import type { VisitFeedback } from "@/types";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} className={rating >= n ? "fill-rust-600 text-rust-600" : "text-beige-300"} />
      ))}
    </div>
  );
}

/** Read-only — responses come in from the public app/feedback/[token] page,
 * nothing here is editable. A server component (no client state needed for
 * a plain list), rendered with whatever Settings > Communication already
 * fetched. */
export default function FeedbackResultsSection({ feedback }: { feedback: VisitFeedback[] }) {
  const average =
    feedback.length > 0
      ? (feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length).toFixed(1)
      : null;

  return (
    <div className="flex flex-col gap-4 rounded-[18px] bg-surface p-7 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[19px] font-extrabold text-brown-900">Patient Feedback</h2>
          <p className="text-[13px] font-medium text-brown-400">Responses to the post-visit survey, newest first.</p>
        </div>
        {average && (
          <span className="flex items-center gap-1.5 rounded-full bg-beige-200 px-3 py-1 text-xs font-bold text-rust-700">
            <Star size={12} className="fill-rust-700" />
            {average} average &middot; {feedback.length} response{feedback.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {feedback.length === 0 ? (
        <p className="rounded-xl border border-dashed border-beige-300 py-9 text-center text-sm font-semibold text-brown-400">
          No responses yet.
        </p>
      ) : (
        <div className="flex flex-col">
          {feedback.map((f, i) => (
            <div key={f.id} className={`py-3.5 ${i < feedback.length - 1 ? "border-b border-beige-100" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-brown-900">{f.patientName}</span>
                {f.rating != null && <StarRow rating={f.rating} />}
              </div>
              {f.comment && <p className="mt-1.5 text-sm font-medium text-brown-600">&quot;{f.comment}&quot;</p>}
              {f.respondedAt && (
                <p className="mt-1 text-xs font-semibold text-brown-400">
                  {new Date(f.respondedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

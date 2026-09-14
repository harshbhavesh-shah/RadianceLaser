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
    <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Patient Feedback</h2>
          <p className="mt-0.5 text-xs text-brown-400">Responses to the post-visit survey, newest first.</p>
        </div>
        {average && (
          <span className="flex items-center gap-1.5 rounded-full bg-rust-100 px-3 py-1 text-xs font-semibold text-rust-700">
            <Star size={12} className="fill-rust-700" />
            {average} average · {feedback.length} response{feedback.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {feedback.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-beige-300 py-6 text-center text-sm text-brown-400">
          No responses yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {feedback.map((f) => (
            <div key={f.id} className="rounded-lg border border-beige-300 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-brown-900">{f.patientName}</span>
                {f.rating != null && <StarRow rating={f.rating} />}
              </div>
              {f.comment && <p className="mt-1.5 text-sm text-brown-600">&quot;{f.comment}&quot;</p>}
              {f.respondedAt && (
                <p className="mt-1 text-xs text-brown-400">
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

import { CheckCheck } from "lucide-react";
import FadeInBubble from "./FadeInBubble";

/** A single chat bubble, shaped like WhatsApp's own: a near-square corner
 * on the side the tail sticks out from, a small triangular tail on that
 * corner, and the timestamp (plus read ticks for clinic-sent messages)
 * tucked inline at the end of the bubble instead of floating outside it.
 * Colors stay on-brand (rust-600 for sent, white for received) rather
 * than WhatsApp's actual green/white. */
function ChatBubble({
  text,
  time,
  sent,
}: {
  text: string;
  time: string;
  sent: boolean;
}) {
  return (
    <div className="relative max-w-[85%] md:max-w-[70%]">
      <div
        className={`relative rounded-[7.5px] px-2.5 py-[6px] shadow-sm md:px-3 md:py-2 ${
          sent ? "rounded-br-[2px] bg-rust-600" : "rounded-bl-[2px] border border-beige-300/80 bg-white"
        }`}
      >
        <p
          className={`text-lg font-medium leading-relaxed md:text-xl ${sent ? "text-white" : "text-brown-900"}`}
        >
          {text}
        </p>
        <div className={`mt-1 flex items-center justify-end gap-1 ${sent ? "text-white/70" : "text-brown-400"}`}>
          <span className="text-[11px] font-medium">{time}</span>
          {sent && <CheckCheck className="h-[15px] w-[15px] text-sky-300" strokeWidth={2} />}
        </div>
        {/* Tail, clipped to a small triangle on the squared-off corner. */}
        <span
          className={`absolute bottom-0 h-[13px] w-2 ${sent ? "-right-2 bg-rust-600" : "-left-2 bg-white"}`}
          style={{
            clipPath: sent ? "polygon(0 0, 100% 100%, 0 100%)" : "polygon(100% 0, 100% 100%, 0 100%)",
          }}
        />
      </div>
    </div>
  );
}

/** A scripted WhatsApp exchange that fades each bubble in as it scrolls
 * into view, illustrating the kind of automated reminder/feedback/
 * follow-up messages Radiance actually sends. Decorative only, per the
 * design brief, not wired to any real conversation or backend. */
export default function WhatsAppScrollSection() {
  return (
    <section className="mx-auto mb-32 flex w-full flex-col items-center px-4 md:mb-48 md:px-6">
      <div className="mb-12 flex max-w-2xl flex-col items-center text-center">
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-brown-900 md:text-3xl">
          Runs on WhatsApp. Your number, not ours.
        </h2>
        <p className="text-base font-medium text-brown-400 md:text-lg">
          Patients already have WhatsApp open. Radiance sends from your clinic&apos;s own number,
          so replies land like this.
        </p>
      </div>

      <span className="mb-12 text-center text-xs font-bold uppercase tracking-widest text-brown-400">
        Not a mockup. This is what actually sends.
      </span>

      <div className="flex w-full max-w-[800px] flex-col gap-6 md:gap-10">
        <FadeInBubble delay={0} align="right">
          <ChatBubble
            sent
            time="10:00 AM"
            text="Hi Priya! Reminder for your Full Body SHR session tomorrow at 11:00 AM with Dr. Smith. Reply CONFIRM or RESCHEDULE."
          />
        </FadeInBubble>

        <FadeInBubble delay={150} align="left">
          <ChatBubble sent={false} time="10:15 AM" text="Confirm" />
        </FadeInBubble>

        <FadeInBubble delay={0} align="right">
          <ChatBubble
            sent
            time="12:30 PM"
            text="Thanks for visiting today! How was your session? Reply 1 to 5."
          />
        </FadeInBubble>

        <FadeInBubble delay={150} align="left">
          <ChatBubble sent={false} time="12:35 PM" text="5, barely felt anything this time" />
        </FadeInBubble>

        <FadeInBubble delay={0} align="center">
          <span className="my-4 rounded-full border border-beige-300 bg-beige-100 px-4 py-1.5 text-xs font-bold text-brown-400 shadow-soft">
            Friday
          </span>
        </FadeInBubble>

        <FadeInBubble delay={0} align="right">
          <ChatBubble
            sent
            time="03:00 PM"
            text="We noticed you missed your appointment today. Want to reschedule? 10 percent off if you rebook this week."
          />
        </FadeInBubble>
      </div>

      <p className="mt-24 max-w-xl text-center text-base font-medium leading-relaxed text-brown-400 md:text-lg">
        Reminders before. Feedback after. Follow-ups when someone does not show. All automatic,
        from your own number. Every reply lands in a built-in two-way inbox, so your front desk can
        read and answer patients without ever leaving Radiance.
      </p>
    </section>
  );
}

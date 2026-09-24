import { Eyebrow, H2_CLASS, Wrap } from "./ui";

const FEATURES = [
  { key: "A", title: "Appointment reminders", note: "Confirm or reschedule in one reply" },
  { key: "B", title: "Feedback after every session", note: "Hear it before Google does" },
  { key: "C", title: "No-show follow-ups", note: "Win back the missed sitting" },
  { key: "D", title: "Two-way inbox", note: "Every conversation, one screen" },
];

type Bubble = { from: "clinic" | "patient"; text: string } | { divider: string };

// Illustrative conversation, not tied to any real patient or backend.
const CHAT: Bubble[] = [
  { divider: "TODAY" },
  {
    from: "clinic",
    text: "Hi Ananya, a reminder for your laser session tomorrow at 10:00 AM. Reply 1 to confirm or 2 to reschedule.",
  },
  { from: "patient", text: "1" },
  { from: "clinic", text: "Confirmed. See you tomorrow at 10:00 AM." },
  { divider: "AFTER SESSION" },
  { from: "clinic", text: "How was your session today? Rate us from 1 to 5." },
  { from: "patient", text: "5, very comfortable. Thank you!" },
];

/** The "clinic" side here is the clinic's own WhatsApp number, so those
 * bubbles sit on the left (received by the patient) like in a real phone;
 * the patient's replies sit on the right, tinted with the accent. */
export default function WhatsAppSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20">
      <Wrap className="flex flex-col items-center gap-14 py-16 md:py-[120px] lg:flex-row lg:gap-24 lg:pt-[140px]">
        <div className="flex flex-col gap-7 lg:flex-grow">
          <Eyebrow>MESSAGING</Eyebrow>
          <h2 className={H2_CLASS}>Runs on WhatsApp. Your number, not ours.</h2>
          <p className="max-w-[540px] text-base leading-relaxed text-lumi-soft md:text-lg md:leading-[1.6]">
            Reminders, confirmations and feedback go out from your clinic&apos;s own WhatsApp number, so patients reply
            to a name they already know and trust. Every reply lands in a built-in two-way inbox, so your front desk can
            read and answer patients without ever leaving Lumière.
          </p>
          <ul className="mt-2 flex flex-col border-t border-lumi-ink/15">
            {FEATURES.map((f) => (
              <li
                key={f.key}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-1 border-b border-lumi-ink/15 py-[18px] sm:grid-cols-[auto_1fr_auto]"
              >
                <span className="font-landing-mono text-[11px] text-lumi-mute">{f.key}</span>
                <span className="text-lg font-medium">{f.title}</span>
                <span className="col-start-2 text-[15px] text-lumi-mute sm:col-start-3">{f.note}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex h-[620px] w-full max-w-[470px] shrink-0 items-center justify-center rounded-3xl bg-lumi-sand md:h-[660px]">
          <span className="absolute left-6 top-5 font-landing-mono text-[10px] tracking-[0.12em] text-lumi-mute">
            PATIENT VIEW
          </span>
          <div className="mt-7 h-[560px] w-[min(320px,86%)] rounded-[40px] bg-lumi-ink p-2.5 shadow-[0_40px_60px_-30px_rgba(60,30,10,0.5)] md:h-[580px]">
            <div className="flex h-full flex-col overflow-hidden rounded-[31px] bg-[#F7F2EA]">
              <div className="flex items-center gap-2.5 border-b border-lumi-ink/[0.08] bg-white px-4 pb-3 pt-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lumi-accent">
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-white" />
                </span>
                <div className="flex flex-col gap-px">
                  <span className="text-[13px] font-semibold">Skin &amp; Laser Clinic</span>
                  <span className="text-[10px] text-lumi-mute">Business account</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-hidden px-3 py-3.5 text-xs leading-[1.45]">
                {CHAT.map((b, i) =>
                  "divider" in b ? (
                    <span
                      key={i}
                      className="mt-1.5 self-center rounded bg-[#EFE9DE] px-2 py-[3px] font-landing-mono text-[9px] tracking-[0.08em] text-lumi-faint first:mt-0"
                    >
                      {b.divider}
                    </span>
                  ) : b.from === "clinic" ? (
                    <div key={i} className="max-w-[230px] self-start rounded-[4px_12px_12px_12px] bg-white px-[11px] py-[9px]">
                      {b.text}
                    </div>
                  ) : (
                    <div key={i} className="self-end rounded-[12px_4px_12px_12px] bg-[#F2DDD0] px-3 py-2">
                      {b.text}
                    </div>
                  )
                )}
              </div>
              <div className="mx-2.5 mb-3 flex h-[38px] items-center rounded-full bg-white px-3.5 text-[11px] text-lumi-faint">
                Message
              </div>
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}

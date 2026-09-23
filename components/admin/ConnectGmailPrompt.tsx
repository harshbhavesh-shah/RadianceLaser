import { Mail } from "lucide-react";

export default function ConnectGmailPrompt() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-beige-300 bg-surface p-10 text-center shadow-soft">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rust-100">
        <Mail size={22} className="text-rust-700" />
      </div>
      <h2 className="mt-4 font-display text-lg font-medium text-brown-900">Connect Gmail</h2>
      <p className="mt-2 max-w-sm text-sm text-brown-600">
        admin@lumiereradiance.in forwards into a Gmail inbox. Connect it once so you can read, send, and reply to
        that address right here.
      </p>
      <a
        href="/api/oauth/google/start"
        className="mt-5 rounded-md bg-rust-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rust-700"
      >
        Connect with Google
      </a>
    </div>
  );
}

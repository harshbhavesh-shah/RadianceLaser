import { Mail } from "lucide-react";

export default function ConnectGmailPrompt() {
  return (
    <div className="flex flex-col items-center rounded-xl bg-surface p-10 text-center shadow-soft ring-1 ring-beige-300">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-100">
        <Mail size={22} className="text-gold-600" />
      </div>
      <h2 className="mt-4 font-display text-lg font-medium text-brown-900">Connect Gmail</h2>
      <p className="mt-2 max-w-sm text-sm text-brown-600">
        admin@radiancelaser.in forwards into a Gmail inbox. Connect it once so you can read, send, and reply to
        that address right here.
      </p>
      <a
        href="/api/oauth/google/start"
        className="mt-5 rounded-md bg-brown-900 px-5 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
      >
        Connect with Google
      </a>
    </div>
  );
}

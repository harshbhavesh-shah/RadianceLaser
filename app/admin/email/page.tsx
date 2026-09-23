import { getEmailConnection } from "@/lib/db/emailConnection";
import { listThreads } from "@/lib/gmail/client";
import EmailInboxClient from "@/components/admin/EmailInboxClient";
import ConnectGmailPrompt from "@/components/admin/ConnectGmailPrompt";

export default async function AdminEmailPage({
  searchParams,
}: {
  searchParams: { error?: string; to?: string; subject?: string };
}) {
  const connection = await getEmailConnection();

  // Set by the Clinics page's "Email" action (components/admin/
  // ClinicsTable.tsx) to open straight into a pre-filled compose form for
  // that clinic's owner, instead of landing on the plain inbox view.
  const initialCompose = searchParams.to ? { to: searchParams.to, subject: searchParams.subject ?? "" } : undefined;

  return (
    <div>
      <h1 className="inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
        Email
      </h1>
      <p className="mt-3 text-sm text-brown-400">Read, send, and reply as admin@lumiereradiance.in.</p>

      {searchParams.error && (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {searchParams.error}
        </p>
      )}

      <div className="mt-8">
        {!connection ? (
          <ConnectGmailPrompt />
        ) : (
          <EmailInboxClientLoader gmailAccount={connection.gmailAccount} initialCompose={initialCompose} />
        )}
      </div>
    </div>
  );
}

async function EmailInboxClientLoader({
  gmailAccount,
  initialCompose,
}: {
  gmailAccount: string;
  initialCompose?: { to: string; subject: string };
}) {
  // A connected-but-failing Gmail grant (revoked access, expired refresh
  // token) shouldn't 500 the whole page — surface it as an inline error
  // with a way to reconnect instead.
  try {
    const threads = await listThreads();
    return <EmailInboxClient initialThreads={threads} gmailAccount={gmailAccount} initialCompose={initialCompose} />;
  } catch (err) {
    console.error("Failed to load initial email threads:", err);
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Couldn&apos;t load the inbox. The Gmail connection may have expired or been revoked.{" "}
        <a href="/api/oauth/google/start" className="font-medium underline">
          Reconnect Gmail
        </a>
        .
      </div>
    );
  }
}

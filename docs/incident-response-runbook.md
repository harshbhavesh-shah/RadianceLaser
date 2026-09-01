# Incident Response Runbook

This exists to satisfy two legal notification clocks that start the moment a
security incident is *detected*, not when it's confirmed:

- **CERT-In Directions, 2022** — report to CERT-In within **6 hours** of
  detecting an incident involving unauthorised access, data breach, or
  similar. This is the binding one; every action below is paced to make that
  deadline, not DPDP's looser one.
- **DPDP Act 2023, Rule 7** — notify the Data Protection Board within
  **72 hours**, and notify every affected patient **without delay**. No
  materiality threshold — a breach affecting one patient's record triggers
  this the same as one affecting the whole clinic.

If you're reading this because something has actually happened, skip to
**Step 1** now and read the rest as you go.

## What counts as a reportable incident

Any of: unauthorised access to the database or a staff account, a lost/stolen
staff device with an active session, data exposed via a misconfigured
permission or a bug, a ransomware/malware event touching any system that
stores or displays patient data, or a third-party vendor (Firebase, AWS,
Resend, Razorpay) reporting a breach on their end that could have exposed our
data.

## Step 1 — Contain (start immediately)

1. If a specific account is compromised: revoke its session and disable it.
   `firebase auth:export`-adjacent — in practice, use the Firebase console
   (Authentication → Users → Disable) or `adminAuth().revokeRefreshTokens(uid)`
   / `updateUser(uid, { disabled: true })` via a one-off script.
2. If the database itself is suspected compromised: rotate the RDS
   `postgres` password immediately (AWS Console → RDS → Modify), then update
   `DATABASE_URL` in Vercel and redeploy.
3. If a Razorpay/Resend/Firebase API key is suspected leaked: rotate it in
   that provider's dashboard and update the corresponding Vercel env var.

Note the exact time you detected the incident (not when it started) — this
is what both 6-hour and 72-hour clocks count from.

## Step 2 — Scope it

Query the `AuditLog` table (see [lib/db/auditLog.ts](../lib/db/auditLog.ts))
for the affected window:

```sql
select * from "auditLogs"
where "clinicId" = '<clinic id>'
  and "createdAt" between <window-start-ms> and <window-end-ms>
order by "createdAt" desc;
```

This tells you which patient records were created, updated, or erased during
the window — cross-reference `targetId` against the `patients` table to get
names/contact info for Step 4. If the incident predates the audit log's
existence, or the audit log itself doesn't cover what was touched (e.g. a raw
database dump, not an app-mediated write), scope from Vercel's request logs
and AWS RDS logs instead — both are less precise, so err toward
over-notifying rather than under-notifying.

## Step 3 — Report to CERT-In (within 6 hours of detection)

File at [cert-in.org.in/incident-reporting](https://www.cert-in.org.in) or
email `incident@cert-in.org.in`. Include: what happened, when detected, what
data/systems were affected, containment steps already taken, and a contact.
Don't wait for full scoping (Step 2) to finish before filing — an initial
report with "still investigating scope" is fine; CERT-In accepts follow-ups.

## Step 4 — Report to the Data Protection Board and affected patients (within 72 hours)

- **Data Protection Board**: file per the process the Board publishes under
  the DPDP Rules (portal not yet live as of this writing — check
  [dpdpa.com](https://www.dpdpa.com) for the current filing mechanism ahead
  of the Act's substantive provisions taking effect). Include the same
  detail as the CERT-In report plus DPDP-specific fields once the Board's
  form is live.
- **Affected patients**: notify by whatever contact method is on file
  (phone/email from their `Patient` record) — no set format required, but
  say what happened, what of theirs was involved, and what they can do
  (contact the clinic, request more detail). "Without delay" is not defined
  as a fixed number of hours — treat it as "as soon as Step 2's scoping
  identifies them," not "whenever convenient."

## Step 5 — Close out

Once contained and reported, write a short internal note (a plain text file
or an email to the clinic owner is enough) covering: what happened, root
cause, what was reported to whom and when, and what changed to prevent a
repeat. Keep it — it's what demonstrates DPDP/CERT-In compliance if either
body ever asks after the fact.

## Who does what

This is a small operation, so all of the above sits with whoever holds
`owner`-role access plus the developer maintaining the app — there's no
dedicated security team to hand this off to. Rotate this section if that
changes.

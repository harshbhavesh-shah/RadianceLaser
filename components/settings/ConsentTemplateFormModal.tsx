"use client";

import { useRef, useState } from "react";
import { addDoc, collection, deleteDoc, deleteField, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { CONSENT_STARTER_TEMPLATES, CONSENT_VARIABLES } from "@/lib/consentForms";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import type { ConsentFormTemplate, SessionType } from "@/types";

export default function ConsentTemplateFormModal({
  clinicId,
  editing,
  onClose,
  onSaved,
  onDeleted,
}: {
  clinicId: string;
  editing?: ConsentFormTemplate | null;
  onClose: () => void;
  onSaved: (template: ConsentFormTemplate) => void;
  onDeleted?: (id: string) => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const isEditing = !!editing;

  const [title, setTitle] = useState(editing?.title || "");
  const [sessionType, setSessionType] = useState<SessionType | "">(editing?.sessionType || "");
  const [body, setBody] = useState(editing?.body || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!editing) return;
    if (!confirm(`Delete "${editing.title}"? Forms already signed from it are kept.`)) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "consentFormTemplates", editing.id));
      onDeleted?.(editing.id);
    } catch (err) {
      console.error("Failed to delete consent template:", err);
      setError("Couldn't delete this template. Please try again.");
      setDeleting(false);
    }
  }

  function insertVariable(token: string) {
    const el = textareaRef.current;
    const snippet = `{{${token}}}`;
    if (!el) {
      setBody((prev) => prev + snippet);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + snippet + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function applyStarter(starter: (typeof CONSENT_STARTER_TEMPLATES)[number]) {
    setTitle(starter.title);
    setBody(starter.body);
  }

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return setError("Title is required.");
    if (!body.trim()) return setError("Form text can't be empty.");

    setSaving(true);
    setError(null);

    try {
      let saved: ConsentFormTemplate;
      if (isEditing && editing) {
        // Firestore's updateDoc only touches fields you name — clearing
        // sessionType back to "General" needs an explicit deleteField(),
        // otherwise the stale value would silently stay on the document.
        const updatePayload = { title: trimmedTitle, body, sessionType: sessionType || deleteField() };
        await updateDoc(doc(db, "consentFormTemplates", editing.id), updatePayload);
        saved = { ...editing, title: trimmedTitle, body, sessionType: sessionType || undefined };
      } else {
        const payload = {
          clinicId,
          title: trimmedTitle,
          body,
          ...(sessionType ? { sessionType } : {}),
          createdAt: Date.now(),
        };
        const docRef = await addDoc(collection(db, "consentFormTemplates"), payload);
        saved = { id: docRef.id, ...payload };
      }
      onSaved(saved);
    } catch (err) {
      console.error("Failed to save consent template:", err);
      const code = (err as { code?: string })?.code;
      setError(
        code === "permission-denied"
          ? "You don't have permission to save this. Check that Firestore rules are deployed and try signing in again."
          : "Couldn't save this template. Please try again."
      );
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">
          {isEditing ? "Edit Consent Form Template" : "New Consent Form Template"}
        </h2>
        <p className="mt-1 text-sm text-brown-400">
          Write once, sign many times — variables like {"{{patientName}}"} get filled in
          automatically for each patient when they sign.
        </p>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        {!isEditing && (
          <div className="mb-5">
            <div className="mb-1.5 text-sm font-medium text-brown-700">Start from a template</div>
            <div className="flex flex-wrap gap-2">
              {CONSENT_STARTER_TEMPLATES.map((starter) => (
                <button
                  key={starter.title}
                  type="button"
                  onClick={() => applyStarter(starter)}
                  className="rounded-md border border-beige-300 px-3 py-1.5 text-xs font-medium text-brown-700 transition-colors hover:border-gold-500 hover:text-gold-600"
                >
                  {starter.title}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-brown-400">
              These are starting points, not legal advice — review and adjust before relying on
              them.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Laser Hair Removal Consent"
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Applies To <span className="text-brown-400">(optional)</span>
              </label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              >
                <option value="">General / Any treatment</option>
                {Object.keys(SESSION_TYPE_CONFIG).map((type) => (
                  <option key={type} value={type}>
                    {SESSION_TYPE_CONFIG[type].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-brown-700">Form Text</label>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {CONSENT_VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => insertVariable(v.token)}
                  title={v.description}
                  className="rounded-full bg-beige-200 px-2.5 py-1 text-xs font-medium text-brown-600 transition-colors hover:bg-gold-100 hover:text-gold-600"
                >
                  + {v.label}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Write the consent form text here. Click a variable above to insert it at the cursor."
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2.5 font-mono text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
              >
                {deleting ? "Removing…" : "Delete Template"}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

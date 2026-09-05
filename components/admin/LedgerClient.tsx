"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { createLedgerEntryAction, deleteLedgerEntryAction } from "@/app/admin/ledger/actions";
import { todayLocalStr, parseDateStr } from "@/lib/calendar";
import type { LedgerEntry, LedgerEntryType } from "@/types";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatDate(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function LedgerClient({ initialEntries }: { initialEntries: LedgerEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [type, setType] = useState<LedgerEntryType>("cost");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayLocalStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    let totalCost = 0;
    let totalProfit = 0;
    for (const e of entries) {
      if (e.type === "cost") totalCost += e.amountInr;
      else totalProfit += e.amountInr;
    }
    return { totalCost, totalProfit, net: totalProfit - totalCost };
  }, [entries]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const parsedAmount = Number(amount);
    const result = await createLedgerEntryAction({ type, amountInr: parsedAmount, description, date });
    setSaving(false);

    if (result.error || !result.entry) {
      setError(result.error || "Something went wrong. Please try again.");
      return;
    }
    setEntries((prev) => [result.entry!, ...prev].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)));
    setAmount("");
    setDescription("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await deleteLedgerEntryAction(id);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-surface p-5 shadow-soft ring-1 ring-beige-300">
          <div className="flex items-center gap-2 text-red-700">
            <TrendingDown size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Total Cost</span>
          </div>
          <p className="mt-2 font-display text-2xl font-medium text-red-700">{formatCurrency(summary.totalCost)}</p>
        </div>
        <div className="rounded-xl bg-surface p-5 shadow-soft ring-1 ring-beige-300">
          <div className="flex items-center gap-2 text-green-700">
            <TrendingUp size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Total Profit</span>
          </div>
          <p className="mt-2 font-display text-2xl font-medium text-green-700">{formatCurrency(summary.totalProfit)}</p>
        </div>
        <div className="rounded-xl bg-surface p-5 shadow-soft ring-1 ring-beige-300">
          <div className={`flex items-center gap-2 ${summary.net >= 0 ? "text-green-700" : "text-red-700"}`}>
            <Wallet size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Net</span>
          </div>
          <p className={`mt-2 font-display text-2xl font-medium ${summary.net >= 0 ? "text-green-700" : "text-red-700"}`}>
            {summary.net >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(summary.net))}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <h2 className="font-display text-base font-medium text-brown-900">Add an entry</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("cost")}
              className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                type === "cost" ? "border-red-300 bg-red-50 text-red-700" : "border-beige-300 text-brown-600 hover:border-red-300"
              }`}
            >
              Cost
            </button>
            <button
              type="button"
              onClick={() => setType("profit")}
              className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                type === "profit"
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-beige-300 text-brown-600 hover:border-green-300"
              }`}
            >
              Profit
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Amount (₹)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                required
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "cost" ? "e.g. Vercel hosting, September" : "e.g. Annual renewal, Advanced Skin Clinic"}
              required
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-brown-900 px-5 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            <Plus size={15} />
            {saving ? "Adding…" : "Add Entry"}
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
        {entries.length === 0 ? (
          <div className="p-10 text-center text-sm text-brown-400">No entries yet.</div>
        ) : (
          <div className="divide-y divide-beige-300">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brown-900">{entry.description}</p>
                  <p className="mt-0.5 text-xs text-brown-400">
                    {formatDate(entry.date)}
                    {entry.createdByEmail ? ` · ${entry.createdByEmail}` : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <span className={`font-display text-base font-medium ${entry.type === "cost" ? "text-red-700" : "text-green-700"}`}>
                    {entry.type === "cost" ? "−" : "+"}
                    {formatCurrency(entry.amountInr)}
                  </span>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="rounded p-1.5 text-brown-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete entry"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

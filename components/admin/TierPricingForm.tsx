"use client";

import { useState, type FormEvent } from "react";
import { Tag } from "lucide-react";
import { updateTierPricingAction } from "@/app/admin/actions";
import type { TierPricing } from "@/lib/db/platformSettings";

export default function TierPricingForm({ initialPricing }: { initialPricing: TierPricing }) {
  const [basic, setBasic] = useState(String(initialPricing.basicPriceInr));
  const [standard, setStandard] = useState(String(initialPricing.standardPriceInr));
  const [pro, setPro] = useState(String(initialPricing.proPriceInr));
  const [enterpriseMin, setEnterpriseMin] = useState(String(initialPricing.enterpriseMinPriceInr));
  const [enterpriseMax, setEnterpriseMax] = useState(String(initialPricing.enterpriseMaxPriceInr));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const pricing: TierPricing = {
      basicPriceInr: Number(basic),
      standardPriceInr: Number(standard),
      proPriceInr: Number(pro),
      enterpriseMinPriceInr: Number(enterpriseMin),
      enterpriseMaxPriceInr: Number(enterpriseMax),
    };
    const result = await updateTierPricingAction(pricing);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="mt-6 max-w-2xl rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="flex items-center gap-2">
        <Tag size={16} className="text-gold-600" />
        <h2 className="font-display text-base font-medium text-brown-900">Tier Pricing</h2>
      </div>
      <p className="mt-1.5 text-sm text-brown-600">
        What the pricing section on the landing page advertises for each paid tier. Free is
        always ₹0 and isn't shown here.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Basic (₹/year)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={basic}
              onChange={(e) => setBasic(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Standard (₹/year)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Pro (₹/year)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={pro}
              onChange={(e) => setPro(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-brown-700">
            Enterprise (₹/year, 2 centers → 10 centers)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              step={1}
              value={enterpriseMin}
              onChange={(e) => setEnterpriseMin(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
            <span className="text-sm text-brown-400">to</span>
            <input
              type="number"
              min={1}
              step={1}
              value={enterpriseMax}
              onChange={(e) => setEnterpriseMax(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save tier pricing"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="mt-3 text-sm text-green-700">Saved. The landing page shows these now.</p>}
    </div>
  );
}

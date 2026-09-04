import type { Metadata } from "next";
import { Mail } from "lucide-react";
import SiteHeader from "@/components/marketing/SiteHeader";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact us · Radiance Laser",
  description: "Reach the Radiance Laser team, or report a problem with your account.",
};

export default function ContactPage() {
  return (
    <div className="bg-canvas">
      <SiteHeader forceSolid />

      <main className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <h1 className="font-display text-4xl font-extrabold leading-tight text-brown-900 sm:text-5xl">
          Contact us
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-brown-600">
          Question about the product, something not working right, or anything else on your mind.
          Write us a message and we&apos;ll get back to you by email, or reach us directly below.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-600">Direct</p>
            <a
              href="mailto:admin@radiancelaser.in"
              className="mt-3 flex items-center gap-2.5 font-display text-lg font-bold text-brown-900 hover:text-gold-600"
            >
              <Mail size={18} className="text-gold-600" />
              admin@radiancelaser.in
            </a>
            <p className="mt-4 text-sm leading-relaxed text-brown-600">
              For account or billing issues, mention your clinic&apos;s name so we can find your
              record quickly.
            </p>
          </div>

          <ContactForm />
        </div>
      </main>
    </div>
  );
}

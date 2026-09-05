import Link from "next/link";
import SiteHeader from "@/components/marketing/SiteHeader";

interface Section {
  heading: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    heading: "1. Our Services",
    body: [
      "The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation, or which would subject us to any registration requirement within that jurisdiction or country. Those who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws, where applicable.",
    ],
  },
  {
    heading: "2. Intellectual Property Rights",
    body: [
      "Our intellectual property. We are the owner or licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (the “Content”), as well as the trademarks, service marks, and logos contained in them (the “Marks”). Our Content and Marks are protected by copyright and trademark laws and treaties around the world, and are provided “as is” for your personal, non-commercial use only.",
      "Your use of our Services. Subject to your compliance with these Legal Terms, including the “Prohibited Activities” section below, we grant you a non-exclusive, non-transferable, revocable license to access the Services, and to download or print a copy of any portion of the Content to which you have properly gained access, solely for your personal, non-commercial use.",
      "Except as set out in this section, no part of the Services and no Content or Marks may be copied, reproduced, distributed, sold, or otherwise exploited for any commercial purpose without our express prior written permission. To request any other use, contact admin@radiancelaser.in. We reserve all rights not expressly granted to you. Any breach of these Intellectual Property Rights constitutes a material breach of these Legal Terms and will terminate your right to use the Services immediately.",
      "Your submissions. By directly sending us any question, comment, suggestion, idea, feedback, or other information about the Services, you agree to assign to us all intellectual property rights in it, and that we may use it for any lawful purpose without compensation to you. By sending us such submissions, you confirm you've read and agree with the “Prohibited Activities” section, waive any moral rights to it (to the extent permitted by law), warrant it's original to you (or that you have the rights to submit it), and warrant it isn't confidential information. You're solely responsible for what you submit, and agree to reimburse us for any losses we suffer from your breach of this section, a third party's intellectual property rights, or applicable law.",
    ],
  },
  {
    heading: "3. User Representations",
    body: [
      "By using the Services, you represent and warrant that: you have the legal capacity to agree to these Legal Terms; you are not a minor in your jurisdiction; you will not access the Services through automated or non-human means (bot, script, or otherwise); you will not use the Services for any illegal or unauthorized purpose; and your use will not violate any applicable law or regulation.",
      "If you provide information that is untrue, inaccurate, not current, or incomplete, we may suspend or terminate your account and refuse any current or future use of the Services.",
    ],
  },
  {
    heading: "4. Prohibited Activities",
    body: [
      "You may not access or use the Services for any purpose other than the one they're made available for, and may not use them in connection with any commercial endeavor except those we specifically endorse. As a user of the Services, you agree not to:",
      "Systematically retrieve data from the Services to build a collection or database without our written permission; trick, defraud, or mislead us or other users (especially to learn account information like passwords); circumvent, disable, or interfere with security-related features of the Services; disparage, tarnish, or otherwise harm us or the Services in our opinion; use information obtained from the Services to harass, abuse, or harm another person; misuse our support services or submit false reports of abuse; use the Services inconsistently with any applicable law; engage in unauthorized framing of or linking to the Services; upload or transmit viruses, Trojan horses, or similar material, or excessive/repetitive spam text, that interferes with anyone's use of the Services; use scripts or automated tools to send messages or mine data; delete copyright or proprietary notices from Content; impersonate another user; deploy passive or active tracking mechanisms (web bugs, 1×1 pixels, spyware); interfere with or place an undue burden on the Services or its networks; harass or threaten our employees or agents; attempt to bypass any access-restricting measures; copy or reverse-engineer the Services' software except where explicitly permitted by law; use bots, scrapers, or unauthorized scripts against the Services; use a buying/purchasing agent to make purchases on the Services; harvest usernames or email addresses for unsolicited email, or create accounts by automated means or false pretenses; or use the Services to compete with us or for any other revenue-generating or commercial enterprise not sanctioned by us.",
    ],
  },
  {
    heading: "5. User Generated Contributions",
    body: [
      "The Services do not currently offer users the ability to submit or post content generally. Where we do provide such an opportunity — content and materials you create, submit, post, or transmit through the Services (“Contributions”) — those Contributions may be viewable by other users. By making any Contributions available, you represent and warrant your compliance with Sections 4 and 6 of these Legal Terms.",
    ],
  },
  {
    heading: "6. Contribution License",
    body: [
      "You agree that we may access, store, process, and use any information and personal data you provide, consistent with your choices (including privacy settings). By submitting suggestions or feedback about the Services, you agree we may use and share it for any purpose without compensation to you.",
      "We do not assert ownership over your Contributions — you retain full ownership of them and any associated intellectual property rights. We are not liable for statements you make in your Contributions. You're solely responsible for them, and agree to hold us harmless from any legal action arising from them.",
    ],
  },
  {
    heading: "7. Services Management",
    body: [
      "We reserve the right, but not the obligation, to: monitor the Services for violations of these Legal Terms; take appropriate legal action against anyone who violates the law or these Legal Terms, including reporting them to law enforcement; refuse, restrict, or disable access to any Contributions at our discretion; remove or disable files and content that are excessive in size or burdensome to our systems; and otherwise manage the Services to protect our rights and property and keep them functioning properly.",
    ],
  },
  {
    heading: "8. Term and Termination",
    body: [
      "These Legal Terms remain in full force while you use the Services. We reserve the right, in our sole discretion and without notice or liability, to deny access to and use of the Services to any person for any reason, including breach of any representation, warranty, or covenant in these Legal Terms or of any applicable law. We may terminate your use of, or delete any content you've posted to, the Services at any time, without warning, at our sole discretion.",
      "If we terminate or suspend your account, you're prohibited from registering a new account under your name, a fake or borrowed name, or any third party's name. We may also pursue appropriate legal action, including civil, criminal, and injunctive redress.",
    ],
  },
  {
    heading: "9. Modifications and Interruptions",
    body: [
      "We reserve the right to change, modify, or remove the contents of the Services at any time, at our sole discretion and without notice, and have no obligation to update any information on them. We're not liable to you or any third party for any modification, price change, suspension, or discontinuance of the Services.",
      "We can't guarantee the Services will be available at all times — hardware, software, or maintenance issues may cause interruptions, delays, or errors. We have no liability for any loss or inconvenience caused by your inability to access the Services during downtime.",
    ],
  },
  {
    heading: "10. Governing Law",
    body: [
      "These Legal Terms are governed by and defined following the laws of India. RadianceLaser and yourself irrevocably consent that the courts of Rajkot, Gujarat shall have exclusive jurisdiction to resolve any dispute arising in connection with these Legal Terms.",
    ],
  },
  {
    heading: "11. Dispute Resolution",
    body: [
      "Informal negotiations. To expedite resolution and control the cost of any dispute related to these Legal Terms (a “Dispute”), you and we agree to first attempt to negotiate any Dispute informally for at least thirty (30) days before initiating arbitration. Such informal negotiations begin upon written notice from one party to the other.",
      "Binding arbitration. If the parties can't resolve the Dispute through informal negotiation, it will be finally resolved by arbitration under the United Nations Commission on International Trade Law (UNCITRAL) Arbitration Rules in force at the time. There will be one arbitrator; the seat of arbitration will be Rajkot, Gujarat, India; the language of proceedings will be English; and the governing law will be the substantive law of India.",
      "Restrictions. Any arbitration is limited to the Dispute between the parties individually — to the fullest extent permitted by law, no arbitration will be joined with any other proceeding, there is no right to arbitrate on a class-action basis, and no Dispute may be brought in a representative capacity on behalf of the general public or other persons.",
      "Exceptions. Disputes seeking to enforce or protect intellectual property rights, disputes arising from theft, piracy, invasion of privacy, or unauthorized use, and any claim for injunctive relief are not subject to the above informal-negotiation/arbitration provisions, and will instead be decided by a court of competent jurisdiction as described in “Governing Law” above.",
    ],
  },
  {
    heading: "12. Corrections",
    body: [
      "The Services may contain typographical errors, inaccuracies, or omissions, including in descriptions, pricing, and availability. We reserve the right to correct these and to change or update information on the Services at any time, without prior notice.",
    ],
  },
  {
    heading: "13. Disclaimer",
    body: [
      "The Services are provided on an as-is and as-available basis. Your use of the Services is at your sole risk. To the fullest extent permitted by law, we disclaim all warranties, express or implied, in connection with the Services, including the implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We make no warranties about the accuracy or completeness of the Services' content, and assume no liability for errors or inaccuracies in it; personal injury or property damage resulting from your access to or use of the Services; unauthorized access to our secure servers or any personal or financial information stored there; any interruption of transmission to or from the Services; bugs or viruses transmitted through the Services by any third party; or any errors, omissions, or losses resulting from content posted or made available via the Services. We don't warrant or assume responsibility for any product or service advertised by a third party through the Services or any linked website — exercise your own judgment and caution.",
    ],
  },
  {
    heading: "14. Limitations of Liability",
    body: [
      "In no event will we or our directors, employees, or agents be liable to you or any third party for any direct, indirect, consequential, exemplary, incidental, special, or punitive damages — including lost profit, lost revenue, or loss of data — arising from your use of the Services, even if we've been advised of the possibility of such damages. Our liability to you for any cause, regardless of the form of action, will at all times be limited to the amount you paid us, if any, in the twelve (12) months before the claim arose. Some jurisdictions don't allow limitations on implied warranties or the exclusion of certain damages — if those laws apply to you, some or all of the above may not apply, and you may have additional rights.",
    ],
  },
  {
    heading: "15. Indemnification",
    body: [
      "You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, officers, agents, partners, and employees, from any loss, damage, liability, claim, or demand — including reasonable attorneys' fees — made by any third party due to or arising from: your use of the Services; your breach of these Legal Terms; any breach of your representations and warranties in these Legal Terms; your violation of the rights of a third party (including intellectual property rights); or any harmful act toward another user of the Services you connected with through them. We reserve the right, at your expense, to assume exclusive defense of any matter you're required to indemnify us for, and you agree to cooperate with our defense.",
    ],
  },
  {
    heading: "16. User Data",
    body: [
      "We maintain certain data you transmit to the Services for the purpose of managing their performance, as well as data relating to your use of them. Although we perform regular routine backups, you are solely responsible for all data you transmit or that relates to any activity you've undertaken using the Services. We have no liability to you for any loss or corruption of such data.",
    ],
  },
  {
    heading: "17. Electronic Communications, Transactions, and Signatures",
    body: [
      "Visiting the Services, sending us emails, and completing online forms all constitute electronic communications. You consent to receive them, and agree that electronic agreements, notices, disclosures, and other communications we provide satisfy any legal requirement that such communication be in writing. You agree to the use of electronic signatures, contracts, orders, and other records, and to electronic delivery of notices and records of transactions initiated or completed via the Services, waiving any right to require an original (non-electronic) signature or record where applicable law would otherwise require one.",
    ],
  },
  {
    heading: "18. Miscellaneous",
    body: [
      "These Legal Terms, together with any policies or operating rules we post on the Services, constitute the entire agreement between you and us. Our failure to exercise or enforce any right or provision here won't operate as a waiver of it. We may assign any or all of our rights and obligations to others at any time. We aren't responsible for any loss, damage, delay, or failure to act caused by anything beyond our reasonable control. If any provision of these Legal Terms is found unlawful, void, or unenforceable, that provision is severable and doesn't affect the enforceability of the rest. Nothing here creates a joint venture, partnership, employment, or agency relationship between you and us. You waive any defense based on the electronic form of these Legal Terms or the lack of a physically signed copy.",
    ],
  },
  {
    heading: "19. Contact Us",
    body: [
      "To resolve a complaint regarding the Services, or for more information about using them, contact us at:",
      "admin@radiancelaser.in\n\nRadianceLaser\n208 City Plaza\nYagnik Road\nRajkot, Gujarat 360001\nIndia",
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="bg-canvas">
      <SiteHeader forceSolid />

      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">Terms of Service</p>
        <h1 className="mt-4 font-display text-3xl font-medium leading-tight text-brown-900 sm:text-4xl">
          Agreement to our legal terms
        </h1>
        <p className="mt-3 text-sm text-brown-400">Last updated September 5, 2026</p>

        <p className="mt-6 max-w-2xl text-brown-600">
          We are RadianceLaser (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). We
          operate radiancelaser.in, as well as any other related products and services that refer or link to these
          legal terms (collectively, the &ldquo;Services&rdquo;). You can contact us by email at{" "}
          <a href="mailto:admin@radiancelaser.in" className="text-gold-600 hover:underline">
            admin@radiancelaser.in
          </a>{" "}
          or by mail at 208 City Plaza, Yagnik Road, Rajkot, Gujarat 360001, India.
        </p>
        <p className="mt-4 max-w-2xl text-brown-600">
          These Legal Terms constitute a legally binding agreement between you, whether personally or on behalf of an
          entity (&ldquo;you&rdquo;), and RadianceLaser, concerning your access to and use of the Services. By
          accessing the Services, you agree that you have read, understood, and agreed to be bound by all of these
          Legal Terms. If you do not agree, you are expressly prohibited from using the Services and must discontinue
          use immediately.
        </p>
        <p className="mt-4 max-w-2xl text-brown-600">
          We may make changes or modifications to these Legal Terms at any time, indicated by an updated &ldquo;Last
          updated&rdquo; date above. Your continued use of the Services after any revised Legal Terms are posted
          means you accept those changes.
        </p>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-medium text-brown-900">{section.heading}</h2>
              <div className="mt-3 max-w-2xl space-y-3 text-brown-600">
                {section.body.map((paragraph, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <Link href="/" className="mt-14 inline-block text-sm font-medium text-gold-600 transition-colors hover:text-gold-500">
          ← Back to home
        </Link>
      </main>

      <footer className="border-t border-beige-300 py-8 text-center text-sm text-brown-400">
        <p>© {new Date().getFullYear()} Radiance Laser</p>
      </footer>
    </div>
  );
}

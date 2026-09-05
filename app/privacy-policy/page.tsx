import Link from "next/link";
import SiteHeader from "@/components/marketing/SiteHeader";

interface Section {
  heading: string;
  inShort?: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    heading: "1. What Information Do We Collect?",
    inShort: "We collect personal information that you provide to us.",
    body: [
      "We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.",
      "The personal information we collect may include: names, phone numbers, and email addresses.",
      "Sensitive Information. We do not process sensitive information.",
      "Payment Data. We may collect data necessary to process your payment if you choose to make purchases, such as your payment instrument number and its associated security code. All payment data is handled and stored by Razorpay — see their privacy notice at razorpay.com/privacy-policy.",
      "Social Media Login Data. We may let you register using an existing social media account (e.g. Google). If you do, we collect certain profile information from that provider, as described in “How Do We Handle Your Social Logins?” below.",
      "All personal information you provide to us must be true, complete, and accurate, and you must notify us of any changes to it.",
      "Google API: our use of information received from Google APIs adheres to the Google API Services User Data Policy, including its Limited Use requirements.",
    ],
  },
  {
    heading: "2. How Do We Process Your Information?",
    inShort:
      "We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.",
    body: [
      "We process your personal information for a variety of reasons, depending on how you interact with our Services, including:",
      "To facilitate account creation and authentication and otherwise manage user accounts — so you can create and log in to your account, and keep it in working order.",
      "To deliver and facilitate delivery of our Services — to provide you with our clinic management software, so you can schedule appointments, manage patients, and process payments.",
    ],
  },
  {
    heading: "3. When and With Whom Do We Share Your Personal Information?",
    inShort: "We may share information in specific situations described in this section and/or with specific third parties.",
    body: [
      "Business Transfers. We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.",
    ],
  },
  {
    heading: "4. Do We Use Cookies and Other Tracking Technologies?",
    inShort: "We may use cookies and similar tracking technologies to collect and store your information.",
    body: [
      "Some online tracking technologies help us maintain the security of our Services and your account, prevent crashes, fix bugs, save your preferences, and assist with basic site functions.",
      "We also permit third parties and service providers to use online tracking technologies on our Services for analytics and advertising, including to help manage and display advertisements or to tailor them to your interests.",
    ],
  },
  {
    heading: "5. How Do We Handle Your Social Logins?",
    inShort: "If you register or log in using a social media account, we may have access to certain information about you.",
    body: [
      "Where you choose to register using a third-party account (like Google), we receive certain profile information from that provider — often your name, email address, and profile picture, along with anything else you've made public on that platform.",
      "We use that information only for the purposes described in this Privacy Notice. We don't control, and aren't responsible for, other uses of your personal information by your social media provider — we recommend reviewing their own privacy notice too.",
    ],
  },
  {
    heading: "6. How Long Do We Keep Your Information?",
    inShort: "We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice, unless otherwise required by law.",
    body: [
      "No purpose in this notice requires us to keep your personal information for longer than the period you have an account with us. When we have no ongoing legitimate business need to process it, we delete or anonymize it — or, where that isn't possible (e.g. data held in backup archives), we securely isolate it from further processing until deletion is possible.",
    ],
  },
  {
    heading: "7. How Do We Keep Your Information Safe?",
    inShort: "We aim to protect your personal information through a system of organizational and technical security measures.",
    body: [
      "We've implemented appropriate technical and organizational security measures designed to protect the personal information we process. That said, no method of transmission over the internet or electronic storage is 100% secure, so we cannot guarantee that unauthorized third parties will never be able to defeat our security. Transmission of personal information to and from our Services is at your own risk.",
    ],
  },
  {
    heading: "8. Do We Collect Information From Minors?",
    inShort: "We do not knowingly collect data from or market to children under 18 years of age.",
    body: [
      "By using the Services, you represent that you are at least 18, or that you are the parent or guardian of a minor and consent to their use of the Services. If we learn that we've collected personal information from someone under 18, we will deactivate the account and take reasonable steps to promptly delete that data. If you're aware of any such data, contact us at admin@radiancelaser.in.",
    ],
  },
  {
    heading: "9. What Are Your Privacy Rights?",
    inShort: "You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.",
    body: [
      "Withdrawing your consent: where we rely on your consent to process your personal information, you may withdraw it at any time by emailing admin@radiancelaser.in. This won't affect the lawfulness of processing carried out before your withdrawal.",
      "Opting out of marketing: you can unsubscribe from marketing communications at any time via the link in those emails, or by contacting us directly. We may still send you service-related messages necessary for your account.",
      "Account information: to review, change, or terminate your account, contact us at admin@radiancelaser.in. On request, we'll deactivate or delete your account and information from our active databases, though we may retain some information where needed to prevent fraud, troubleshoot, assist investigations, or comply with legal requirements.",
      "Cookies: most browsers accept cookies by default; you can usually set yours to remove or reject them, though this may affect certain features of our Services.",
      "Questions about your privacy rights can be sent to admin@radiancelaser.in.",
    ],
  },
  {
    heading: "10. Controls for Do-Not-Track Features",
    body: [
      "No uniform technology standard for recognizing and honoring Do-Not-Track (DNT) signals has been finalized yet, so we do not currently respond to DNT browser signals. If a standard we must follow is adopted in the future, we'll describe that in a revised version of this notice.",
    ],
  },
  {
    heading: "11. Do We Make Updates to This Notice?",
    inShort: "Yes, we will update this notice as necessary to stay compliant with relevant laws.",
    body: [
      "The updated version will be indicated by a revised “Last updated” date at the top of this page. If we make material changes, we may notify you by prominently posting a notice or sending you a direct notification.",
    ],
  },
  {
    heading: "12. How Can You Contact Us About This Notice?",
    body: [
      "Email us at admin@radiancelaser.in, or write to us at:",
      "RadianceLaser\n208 City Plaza\nYagnik Road\nRajkot, Gujarat 360001\nIndia",
    ],
  },
  {
    heading: "13. How Can You Review, Update, or Delete the Data We Collect From You?",
    body: [
      "Depending on the laws that apply to you, you may have the right to request access to the personal information we've collected, details on how we've processed it, correction of inaccuracies, or deletion of your data — and you may have the right to withdraw your consent to our processing of it. To make such a request, email admin@radiancelaser.in.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-canvas">
      <SiteHeader forceSolid />

      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">Privacy Policy</p>
        <h1 className="mt-4 font-display text-3xl font-medium leading-tight text-brown-900 sm:text-4xl">
          How Radiance Laser handles your personal information
        </h1>
        <p className="mt-3 text-sm text-brown-400">Last updated September 5, 2026</p>

        <p className="mt-6 max-w-2xl text-brown-600">
          This notice describes how and why RadianceLaser (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) may
          access, collect, store, use, and share your personal information when you visit radiancelaser.in, use our
          clinic management software, or otherwise interact with us. If you don&apos;t agree with our policies and
          practices, please don&apos;t use our Services. Questions or concerns can be sent to{" "}
          <a href="mailto:admin@radiancelaser.in" className="text-gold-600 hover:underline">
            admin@radiancelaser.in
          </a>
          .
        </p>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-medium text-brown-900">{section.heading}</h2>
              {section.inShort && (
                <p className="mt-2 text-sm italic text-brown-500">In short: {section.inShort}</p>
              )}
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

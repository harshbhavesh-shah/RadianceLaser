import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getClinic } from "@/lib/db/clinics";
import { getClinicAccess } from "@/lib/subscription";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import BookingClient from "@/components/booking/BookingClient";

// The patient-facing counterpart to app/dashboard/appointments — no auth,
// reached from a link the clinic shares (website, WhatsApp, a QR code at
// reception). Branded with the clinic's own name today; the logo/wordmark
// stays Radiance Laser's until a client wants their own swapped in (see
// ClinicBrandHeader below).

export async function generateMetadata({ params }: { params: { clinicId: string } }): Promise<Metadata> {
  const clinic = await getClinic(params.clinicId);
  return { title: clinic ? `Book an Appointment — ${clinic.name}` : "Book an Appointment" };
}

function ClinicBrandHeader({ clinicName }: { clinicName: string }) {
  return (
    <div className="flex flex-col items-center pt-12 text-center sm:pt-16">
      <Image src="/logo.png" alt="" width={44} height={44} />
      <p className="mt-4 font-display text-xl font-medium text-brown-900 sm:text-2xl">{clinicName}</p>
      <div className="mt-3 h-[2px] w-10 bg-gold-500" />
    </div>
  );
}

export default async function BookingPage({ params }: { params: { clinicId: string } }) {
  const clinic = await getClinic(params.clinicId);
  if (!clinic) notFound();

  const access = getClinicAccess(clinic);

  if (access.status === "locked") {
    return (
      <div className="min-h-screen bg-canvas px-4">
        <ClinicBrandHeader clinicName={clinic.name} />
        <div className="mx-auto mt-10 max-w-md rounded-xl bg-surface p-8 text-center shadow-card ring-1 ring-beige-300">
          <h1 className="font-display text-lg font-medium text-brown-900">Online booking is unavailable</h1>
          <p className="mt-2 text-sm text-brown-600">
            {clinic.name} isn&apos;t taking online bookings right now. Please call the clinic directly to book your
            appointment.
          </p>
        </div>
      </div>
    );
  }

  const customTypes = await getClinicSessionTypeDefs(clinic.id);
  const sessionTypeConfig = buildSessionTypeConfig(customTypes);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <ClinicBrandHeader clinicName={clinic.name} />
      <div className="mx-auto mt-8 max-w-md px-4">
        <BookingClient clinicId={clinic.id} sessionTypeConfig={sessionTypeConfig} />
      </div>
    </div>
  );
}

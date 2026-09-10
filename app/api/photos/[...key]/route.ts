import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getFromR2 } from "@/lib/r2";

// The only place R2 objects get read back out. Keys are always shaped
// "<category>/<clinicId>/...rest" (see createPatientPhoto/createConsentForm
// in lib/db/*.ts), so the clinicId segment doubles as the access check —
// this keeps the R2 bucket itself fully private with no public/presigned
// URLs ever handed to a browser.
export async function GET(_req: NextRequest, { params }: { params: { key: string[] } }) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const clinicId = params.key[1];
  if (!clinicId || clinicId !== session.clinicId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const object = await getFromR2(params.key.join("/"));
  if (!object) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(object.body), {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

import "server-only";
import { metaCloudApiProvider } from "@/lib/whatsapp/providers/metaCloudApi";
import type { WhatsAppProvider } from "@/lib/whatsapp/types";

// The one provider currently wired up. Every caller (webhook route, reply
// action, cron sends) imports this instead of a specific provider module —
// switching providers later is changing this one line, not touching any of
// those call sites.
export const activeProvider: WhatsAppProvider = metaCloudApiProvider;

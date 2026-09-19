"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { registerPushTokenAction } from "@/app/actions/push";

// Matches anything the app treats as tappable — covers every button and
// nav link without needing a shared <Button> component or per-page wiring.
// Deliberately excludes plain text inputs/textareas: focusing a field to
// type isn't a "navigating the UI" tap.
const TAPPABLE_SELECTOR =
  'button, a[href], [role="button"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], select';

/** Wires Android's hardware back button to the app's own navigation, taps
 * to haptic feedback, and push notification registration — all no-ops on
 * web (isNativePlatform() is false there), but this component is mounted
 * on every route including the public marketing site, so the three
 * Capacitor plugin packages this needs (@capacitor/app,
 * @capacitor/push-notifications, and lib/haptics's own
 * @capacitor/haptics) are all dynamically imported instead of imported at
 * module scope — only @capacitor/core (a thin platform-detection shim)
 * loads eagerly. A web visitor's bundle never has to fetch, parse, or
 * execute the actual plugin code for a platform they're not on. */
export default function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let removeListener: (() => void) | undefined;

    import("@capacitor/app").then(({ App }) => {
      if (cancelled) return;
      const listenerPromise = App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.minimizeApp();
        }
      });
      removeListener = () => {
        listenerPromise.then((listener) => listener.remove());
      };
    });

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Capture phase so this still fires even if a component's own click
    // handler calls stopPropagation on the way back up.
    function onClick(e: MouseEvent) {
      const target = (e.target as HTMLElement | null)?.closest(TAPPABLE_SELECTOR);
      if (!target) return;
      if (target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") return;
      import("@/lib/haptics").then(({ hapticTap }) => hapticTap());
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    import("@capacitor/push-notifications").then(({ PushNotifications }) => {
      if (cancelled) return;

      const registrationListener = PushNotifications.addListener("registration", (token) => {
        // Best-effort — a session might not exist yet (e.g. this fires while
        // still on /login before signing in); registerPushTokenAction just
        // rejects harmlessly, and the next cold start after signing in
        // tries again since register() is called unconditionally on every
        // launch.
        registerPushTokenAction(token.value).catch(() => {});
      });

      const errorListener = PushNotifications.addListener("registrationError", (err) => {
        console.error("Push registration failed:", err);
      });

      // Tapping a delivered notification can carry a path to jump straight
      // to (e.g. the Inbox thread the notification was about) via a `path`
      // data field — anything without one just opens the app normally.
      const actionListener = PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const path = action.notification.data?.path;
        if (typeof path === "string") router.push(path);
      });

      (async () => {
        const permStatus = await PushNotifications.checkPermissions();
        let receive = permStatus.receive;
        if (receive === "prompt" || receive === "prompt-with-rationale") {
          const requested = await PushNotifications.requestPermissions();
          receive = requested.receive;
        }
        if (!cancelled && receive === "granted") {
          await PushNotifications.register();
        }
      })();

      cleanup = () => {
        registrationListener.then((l) => l.remove());
        errorListener.then((l) => l.remove());
        actionListener.then((l) => l.remove());
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);

  return null;
}

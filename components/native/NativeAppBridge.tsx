"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { hapticTap } from "@/lib/haptics";
import { registerPushTokenAction } from "@/app/actions/push";

// Matches anything the app treats as tappable — covers every button and
// nav link without needing a shared <Button> component or per-page wiring.
// Deliberately excludes plain text inputs/textareas: focusing a field to
// type isn't a "navigating the UI" tap.
const TAPPABLE_SELECTOR =
  'button, a[href], [role="button"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], select';

/** Wires Android's hardware back button to the app's own navigation —
 * without this, Capacitor's default (no JS listener registered) only goes
 * back in WebView history and does nothing at all once there's no history
 * left, so the back button would appear to just stop working at the root
 * of a stack instead of backgrounding the app like every other Android app.
 * A no-op on web and iOS (isNativePlatform() is false there). */
export default function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.minimizeApp();
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
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
      hapticTap();
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    const registrationListener = PushNotifications.addListener("registration", (token) => {
      // Best-effort — a session might not exist yet (e.g. this fires while
      // still on /login before signing in); registerPushTokenAction just
      // rejects harmlessly, and the next cold start after signing in tries
      // again since register() is called unconditionally on every launch.
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

    return () => {
      cancelled = true;
      registrationListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
      actionListener.then((l) => l.remove());
    };
  }, [router]);

  return null;
}

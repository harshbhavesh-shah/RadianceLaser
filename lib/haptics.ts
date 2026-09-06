"use client";

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// No-ops on web/iOS-in-browser — only real on a native Android/iOS shell.
// Callers never need their own isNativePlatform() check.
const isNative = () => Capacitor.isNativePlatform();

/** Light tap feedback — the default for any button/link press. Wired
 * automatically for every interactive element by NativeAppBridge, but
 * exported for call sites that want it on a non-click interaction. */
export function hapticTap() {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** A more deliberate tap — for actions with real consequence (extend
 * access, terminate, delete-confirm) that deserve to feel heavier than a
 * plain nav tap. */
export function hapticImpact() {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

export function hapticSuccess() {
  if (!isNative()) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}

export function hapticError() {
  if (!isNative()) return;
  Haptics.notification({ type: NotificationType.Error }).catch(() => {});
}

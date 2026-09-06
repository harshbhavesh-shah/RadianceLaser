import type { CapacitorConfig } from "@capacitor/cli";

// The Android app has no landing page — it's a wrapper around the same
// Next.js deployment the browser uses, just pointed straight at /login
// instead of "/". Everything else (dashboard, admin, all server actions)
// loads from the live server exactly like the web app does.
//
const PRODUCTION_URL = "https://www.radiancelaser.in";

const config: CapacitorConfig = {
  appId: "in.radiancelaser.app",
  appName: "Radiance Laser",
  webDir: "public",
  server: {
    url: `${PRODUCTION_URL}/login`,
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      // Almost every screen in the app sits on the canvas color, so this
      // is the color visible for the (often brief) gap between the native
      // splash disappearing and the remote page's own background painting.
      backgroundColor: "#FBF8F3",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      // Remote-loaded content can take longer than a bundled app's, so this
      // is a floor, not a fixed delay — launchAutoHide still dismisses it
      // the moment the page finishes loading if that happens sooner.
      launchShowDuration: 2000,
      launchAutoHide: true,
    },
    StatusBar: {
      // overlaysWebView:false reserves real layout space for the status
      // bar instead of drawing under it, so pages don't need their own
      // safe-area padding to avoid content sitting under the clock/icons.
      overlaysWebView: false,
      backgroundColor: "#FBF8F3",
      style: "DARK", // dark icons/text — every screen sits on a light background
    },
  },
};

export default config;

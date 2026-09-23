import type { CapacitorConfig } from "@capacitor/cli";

// The Android app has no landing page — it's a wrapper around the same
// Next.js deployment the browser uses, just pointed straight at /login
// instead of "/". Everything else (dashboard, admin, all server actions)
// loads from the live server exactly like the web app does.
//
const PRODUCTION_URL = "https://www.lumiereradiance.in";

const config: CapacitorConfig = {
  appId: "in.lumiereradiance.app",
  appName: "Lumière by Radiance",
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
    SocialLogin: {
      // Native Google Sign-In (Android's own Credential Manager account
      // picker) instead of the web popup flow, which Google blocks inside
      // an embedded WebView — see lib/authFlow.ts signInWithGoogleNative().
      // webClientId is the Web application OAuth client (GOOGLE_CLIENT_ID),
      // the same one the server verifies ID tokens against — NOT the
      // separate Android-type client Google Cloud Console also needs
      // (registered there only, by package name + signing SHA-1, never
      // referenced in code). See @capgo/capacitor-social-login's README
      // for why Credential Manager requires exactly this split.
      google: {
        webClientId: "1010631493574-5gpchvg3dj2k5si2aairtv9lpojhresa.apps.googleusercontent.com",
      },
    },
  },
};

export default config;

package in.radiancelaser.app;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        useHighestAvailableRefreshRate();
    }

    /** Without this, Android renders at its default 60Hz mode even on a
     * 90/120Hz-capable screen — a WebView doesn't opt into a high refresh
     * rate on its own, an app has to request it explicitly. Picks the
     * fastest mode at the display's CURRENT resolution (never a different
     * one) so this can only smooth out animations/scrolling, not change
     * anything the user would notice as a resolution switch. */
    @SuppressWarnings("deprecation") // getDefaultDisplay() has no replacement before API 30
    private void useHighestAvailableRefreshRate() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return; // Display.Mode API is 23+

        Display display = getWindowManager().getDefaultDisplay();
        if (display == null) return;

        Display.Mode currentMode = display.getMode();
        Display.Mode bestMode = currentMode;
        for (Display.Mode mode : display.getSupportedModes()) {
            boolean sameResolution = mode.getPhysicalWidth() == currentMode.getPhysicalWidth()
                && mode.getPhysicalHeight() == currentMode.getPhysicalHeight();
            if (sameResolution && mode.getRefreshRate() > bestMode.getRefreshRate()) {
                bestMode = mode;
            }
        }

        if (bestMode.getModeId() != currentMode.getModeId()) {
            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.preferredDisplayModeId = bestMode.getModeId();
            getWindow().setAttributes(params);
        }
    }
}

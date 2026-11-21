package com.aurapulse.musicvisualizer;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

/**
 * Always-On Display (AOD) Edge Lighting Activity.
 * When the user locks the phone or presses the power button, this Activity is launched
 * by EdgeLightingService to wake the AMOLED display in pure black (#000000) and illuminate
 * the screen borders with the dynamic RGB music glow.
 */
public class AodEdgeLightingActivity extends Activity {

    public static final String ACTION_DISMISS_AOD = "com.aurapulse.ACTION_DISMISS_AOD";
    private static AodEdgeLightingActivity currentInstance = null;
    // Set when the service itself dismisses the AOD (notification Cancel /
    // screen-on): in that case the activity must NOT ask the service to
    // resume the overlay, or a Cancel would restart the lights.
    private static boolean suppressResumeOnDismiss = false;

    private EdgeLightingService.EdgeLightView aodView;
    private PowerManager.WakeLock wakeLock;

    // Dismiss ONLY on an explicit dismiss, or on unlock (user present).
    // NEVER on ACTION_SCREEN_OFF: this activity is the screen-off AOD
    // itself, so finishing on screen-off would kill the lights at once.
    private final BroadcastReceiver dismissReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent != null && (ACTION_DISMISS_AOD.equals(intent.getAction())
                    || Intent.ACTION_USER_PRESENT.equals(intent.getAction()))) {
                dismissAod();
            }
        }
    };

    public static boolean isActive() {
        return currentInstance != null;
    }

    public static void dismissIfActive() {
        if (currentInstance != null) {
            suppressResumeOnDismiss = true;
            currentInstance.dismissAod();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentInstance = this;

        // Configure full screen and show over lock screen
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        Window window = getWindow();
        window.setBackgroundDrawableResource(android.R.color.black);

        // Wake the screen ONCE and keep it on while this AOD is showing.
        // Without this, the activity is created while the screen is off and
        // the user sees nothing at all. This is a single wake lock held by
        // this activity (released on dismiss), not a wake loop: nothing
        // re-acquires it, and the service never re-launches the activity
        // while it is already active.
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                        "AuraPulse:AodWakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
            }
        } catch (Exception ignored) {}

        // Modern Android API 27+ setShowWhenLocked + setTurnScreenOn
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        // WindowManager flags to display over keyguard, turn the screen on
        // once, and keep it on while the AOD lights are showing.
        int flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                | WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;

        window.addFlags(flags);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        }

        // Hide navigation bars and status bar for complete edge-to-edge glow
        hideSystemUi();

        // Extract effect configuration from Intent
        Intent intent = getIntent();
        String preset = intent != null ? intent.getStringExtra(EdgeLightingService.EXTRA_PRESET) : "dynamic-rainbow";
        String color = intent != null ? intent.getStringExtra(EdgeLightingService.EXTRA_COLOR) : "#00f0ff";
        int thickness = intent != null ? intent.getIntExtra(EdgeLightingService.EXTRA_THICKNESS, 6) : 6;
        int speed = intent != null ? intent.getIntExtra(EdgeLightingService.EXTRA_SPEED, 3) : 3;
        String mode = intent != null ? intent.getStringExtra(EdgeLightingService.EXTRA_MODE) : "all-edges";

        // Create the Edge Lighting View on a pitch-black canvas
        aodView = new EdgeLightingService.EdgeLightView(this);
        aodView.setAodBlackBackdrop(true);
        aodView.updateParams(preset, color, thickness, speed, mode);
        setContentView(aodView);

        // Register receiver for dismiss events (explicit dismiss or user unlock only).
        // The screen is woken exactly once in onCreate above; nothing here
        // re-wakes it.
        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_DISMISS_AOD);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(dismissReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(dismissReceiver, filter);
        }
    }

    private void hideSystemUi() {
        View decorView = getWindow().getDecorView();
        int uiOptions = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        decorView.setSystemUiVisibility(uiOptions);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        // Any tap on the screen dismisses AOD so user can access lockscreen / phone
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            dismissAod();
            return true;
        }
        return super.onTouchEvent(event);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_POWER) {
            dismissAod();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    public void dismissAod() {
        // If the user tapped the AOD while the screen is on, the normal
        // overlay was hidden on screen-off, so ask the service to show it
        // again. Never do this when the service dismissed the AOD itself
        // (notification Cancel / screen-on), and never when the screen is
        // off - the lights stay off until the next screen-on.
        boolean resumeOverlay = !suppressResumeOnDismiss;
        suppressResumeOnDismiss = false;
        if (resumeOverlay) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && pm.isInteractive()) {
                    Intent resume = new Intent(this, EdgeLightingService.class);
                    resume.setAction(EdgeLightingService.ACTION_AOD_DISMISSED);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(resume);
                    } else {
                        startService(resume);
                    }
                }
            } catch (Exception ignored) {}
        }
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
        finish();
        overridePendingTransition(0, android.R.anim.fade_out);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (currentInstance == this) {
            currentInstance = null;
        }
        try {
            unregisterReceiver(dismissReceiver);
        } catch (Exception ignored) {}
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
        if (aodView != null) {
            aodView.stopAnimation();
        }
    }
}

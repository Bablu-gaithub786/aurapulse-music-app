package com.aurapulse.musicvisualizer;

import android.animation.ValueAnimator;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.LinearInterpolator;

public class EdgeLightingService extends Service {

    public static final String ACTION_START = "com.aurapulse.ACTION_START_OVERLAY";
    public static final String ACTION_STOP = "com.aurapulse.ACTION_STOP_OVERLAY";
    public static final String EXTRA_PRESET = "extra_preset";
    public static final String EXTRA_COLOR = "extra_color";
    public static final String EXTRA_THICKNESS = "extra_thickness";
    public static final String EXTRA_SPEED = "extra_speed";
    public static final String EXTRA_MODE = "extra_mode";

    private static final String CHANNEL_ID = "aurapulse_edge_lights_channel";
    private static final int NOTIFICATION_ID = 78601;

    private WindowManager windowManager;
    private EdgeLightView overlayView;
    private WindowManager.LayoutParams currentParams;
    private boolean isOverlayAttached = false;

    private PowerManager.WakeLock wakeLock;
    private boolean isReceiverRegistered = false;

    // BroadcastReceiver to trigger Always-On Display (AOD) mode when hardware screen turns off
    private final BroadcastReceiver screenStateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null) return;
            String action = intent.getAction();
            if (Intent.ACTION_SCREEN_OFF.equals(action)) {
                enableScreenOffAodMode();
            } else if (Intent.ACTION_SCREEN_ON.equals(action) || Intent.ACTION_USER_PRESENT.equals(action)) {
                disableScreenOffAodMode();
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannel();

        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(screenStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(screenStateReceiver, filter);
        }
        isReceiverRegistered = true;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        // Must check overlay permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String preset = intent != null ? intent.getStringExtra(EXTRA_PRESET) : "dynamic-rainbow";
        String color = intent != null ? intent.getStringExtra(EXTRA_COLOR) : "#00f0ff";
        int thickness = intent != null ? intent.getIntExtra(EXTRA_THICKNESS, 6) : 6;
        int speed = intent != null ? intent.getIntExtra(EXTRA_SPEED, 3) : 3;
        String mode = intent != null ? intent.getStringExtra(EXTRA_MODE) : "all-edges";

        Notification notification = buildForegroundNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Throwable t) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Throwable ignored) {}
        }

        attachOrUpdateOverlay(preset, color, thickness, speed, mode);

        return START_STICKY;
    }

    private void attachOrUpdateOverlay(String preset, String color, int thickness, int speed, String mode) {
        if (overlayView == null) {
            overlayView = new EdgeLightView(this);
        }

        overlayView.updateParams(preset, color, thickness, speed, mode);

        if (!isOverlayAttached) {
            int layoutFlag;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
            } else {
                layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
            }

            // Query physical real screen dimensions so bottom borders reach the absolute physical edge of the glass
            DisplayMetrics dm = new DisplayMetrics();
            windowManager.getDefaultDisplay().getRealMetrics(dm);

            currentParams = new WindowManager.LayoutParams(
                    dm.widthPixels,
                    dm.heightPixels,
                    layoutFlag,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                            | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT
            );
            currentParams.gravity = Gravity.TOP | Gravity.START;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                currentParams.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
            }

            try {
                windowManager.addView(overlayView, currentParams);
                isOverlayAttached = true;
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else if (currentParams != null) {
            // Re-sync physical display bounds on rotation or display change
            DisplayMetrics dm = new DisplayMetrics();
            windowManager.getDefaultDisplay().getRealMetrics(dm);
            currentParams.width = dm.widthPixels;
            currentParams.height = dm.heightPixels;
            try {
                windowManager.updateViewLayout(overlayView, currentParams);
            } catch (Exception ignored) {}
        }
    }

    private void enableScreenOffAodMode() {
        if (overlayView == null || windowManager == null || currentParams == null) return;
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (wakeLock == null && pm != null) {
                wakeLock = pm.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                        "AuraPulse:EdgeLightsAOD"
                );
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(15 * 60 * 1000L); // 15 min safeguard
            }

            // Draw OLED pure black backdrop on locked screen with shining borders
            overlayView.setAodBlackBackdrop(true);

            currentParams.flags |= (WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

            windowManager.updateViewLayout(overlayView, currentParams);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void disableScreenOffAodMode() {
        if (overlayView == null || windowManager == null || currentParams == null) return;
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }

            // Restore transparent overlay over apps
            overlayView.setAodBlackBackdrop(false);

            currentParams.flags &= ~(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

            windowManager.updateViewLayout(overlayView, currentParams);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void removeOverlay() {
        if (isOverlayAttached && overlayView != null) {
            try {
                overlayView.stopAnimation();
                windowManager.removeView(overlayView);
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                isOverlayAttached = false;
                overlayView = null;
                currentParams = null;
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (isReceiverRegistered) {
            try {
                unregisterReceiver(screenStateReceiver);
            } catch (Exception ignored) {}
            isReceiverRegistered = false;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        removeOverlay();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Edge Lighting Overlay",
                    NotificationManager.IMPORTANCE_MIN
            );
            channel.setDescription("Shows active AuraPulse edge lighting over other apps");
            channel.setShowBadge(false);
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildForegroundNotification() {
        Intent appIntent = new Intent(this, MainActivity.class);
        appIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPending = PendingIntent.getActivity(
                this,
                0,
                appIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Intent stopIntent = new Intent(this, EdgeLightingService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
                this,
                1,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle("AuraPulse Edge Lights Active")
                .setContentText("Displaying edge glow over apps and screen off AOD")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(contentPending)
                .setOngoing(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
            builder.addAction(
                    android.R.drawable.ic_menu_close_clear_cancel,
                    "Turn Off",
                    stopPending
            );
        }

        return builder.build();
    }

    // Custom View that renders the edge lighting
    private static class EdgeLightView extends View {
        private final Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint glowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Matrix shaderMatrix = new Matrix();
        private ValueAnimator animator;
        private float animationProgress = 0f;

        private String preset = "dynamic-rainbow";
        private int primaryColor = Color.parseColor("#00f0ff");
        private float thicknessDp = 6f;
        private int speed = 3;
        private boolean isSidesOnly = false;
        private boolean isAodBlackBackdrop = false;

        public EdgeLightView(Context context) {
            super(context);
            init();
        }

        private void init() {
            borderPaint.setStyle(Paint.Style.STROKE);
            glowPaint.setStyle(Paint.Style.STROKE);
            glowPaint.setStrokeCap(Paint.Cap.ROUND);
            borderPaint.setStrokeCap(Paint.Cap.ROUND);

            startAnimation();
        }

        public void setAodBlackBackdrop(boolean enabled) {
            this.isAodBlackBackdrop = enabled;
            invalidate();
        }

        public void updateParams(String preset, String colorHex, int thickness, int speedVal, String mode) {
            this.preset = preset != null ? preset : "dynamic-rainbow";
            try {
                this.primaryColor = Color.parseColor(colorHex);
            } catch (Exception e) {
                this.primaryColor = Color.parseColor("#00f0ff");
            }
            this.thicknessDp = Math.max(3, thickness);
            this.speed = Math.max(1, Math.min(5, speedVal));
            this.isSidesOnly = "vivo-music".equals(mode)
                    || (preset != null && (preset.startsWith("vivo-") || preset.contains("soundwave")));

            startAnimation();
            invalidate();
        }

        private void startAnimation() {
            if (animator != null) {
                animator.cancel();
            }

            // Duration: 1 (fast: 1.5s) to 5 (smoothest 3.5s)
            long duration = (long) (6000 / Math.max(1, speed));
            animator = ValueAnimator.ofFloat(0f, 1f);
            animator.setDuration(duration);
            animator.setRepeatCount(ValueAnimator.INFINITE);
            animator.setInterpolator(new LinearInterpolator());
            animator.addUpdateListener(animation -> {
                animationProgress = (float) animation.getAnimatedValue();
                invalidate();
            });
            animator.start();
        }

        public void stopAnimation() {
            if (animator != null) {
                animator.cancel();
                animator = null;
            }
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);

            int width = getWidth();
            int height = getHeight();
            if (width <= 0 || height <= 0) return;

            // When in Screen-Off AOD mode, fill pure OLED black (#000000) so AMOLED display stays black
            if (isAodBlackBackdrop) {
                canvas.drawColor(Color.BLACK);
            }

            float density = getResources().getDisplayMetrics().density;
            float strokeW = thicknessDp * density;
            float glowW = strokeW * 2.8f;

            borderPaint.setStrokeWidth(strokeW);
            glowPaint.setStrokeWidth(glowW);

            float halfStroke = strokeW / 2f;

            if (isSidesOnly) {
                // Vivo Silk Soundwave / Left & Right Edges Only
                drawSidesOnly(canvas, width, height, strokeW);
            } else {
                // Full screen 4-border continuous animated dynamic RGB glow
                drawAllBorders(canvas, width, height, halfStroke);
            }
        }

        private void drawAllBorders(Canvas canvas, int width, int height, float halfStroke) {
            // Proportional smooth corner curve that hugs curved smartphone displays
            float cornerRadius = 32f * getResources().getDisplayMetrics().density;
            // Draw rectangle from (halfStroke, halfStroke) all the way to (width - halfStroke, height - halfStroke)
            RectF rect = new RectF(halfStroke, halfStroke, width - halfStroke, height - halfStroke);

            int[] colors;
            if ("toxic-aurora".equals(preset)) {
                colors = new int[]{
                        Color.parseColor("#39ff14"),
                        Color.parseColor("#00ff88"),
                        Color.parseColor("#00ffcc"),
                        Color.parseColor("#ccff00"),
                        Color.parseColor("#39ff14")
                };
            } else if ("sunset-glow".equals(preset)) {
                colors = new int[]{
                        Color.parseColor("#ff0033"),
                        Color.parseColor("#ff5500"),
                        Color.parseColor("#ffaa00"),
                        Color.parseColor("#ffee00"),
                        Color.parseColor("#ff0033")
                };
            } else {
                // 7-color Dynamic Rainbow Flow
                colors = new int[]{
                        Color.parseColor("#ff0077"),
                        Color.parseColor("#9900ff"),
                        Color.parseColor("#00f0ff"),
                        Color.parseColor("#00ff66"),
                        Color.parseColor("#ffff00"),
                        Color.parseColor("#ff5500"),
                        Color.parseColor("#ff0077")
                };
            }

            float cx = width / 2f;
            float cy = height / 2f;

            SweepGradient sweep = new SweepGradient(cx, cy, colors, null);
            shaderMatrix.reset();
            shaderMatrix.postRotate(animationProgress * 360f, cx, cy);
            sweep.setLocalMatrix(shaderMatrix);

            borderPaint.setShader(sweep);
            glowPaint.setShader(sweep);
            glowPaint.setAlpha(140);
            borderPaint.setAlpha(255);

            // Draw fixed rounded rectangle on screen edges (corners follow screen curvature)
            canvas.drawRoundRect(rect, cornerRadius, cornerRadius, glowPaint);
            canvas.drawRoundRect(rect, cornerRadius, cornerRadius, borderPaint);
        }

        private void drawSidesOnly(Canvas canvas, int width, int height, float strokeW) {
            int c1 = primaryColor;
            int c2 = Color.parseColor("#9900ff");
            int c3 = Color.parseColor("#00ffea");

            int[] sideColors = new int[]{ c1, c2, c3, c1 };

            LinearGradient gradient = new LinearGradient(
                    0, 0, 0, height,
                    sideColors,
                    new float[]{ 0f, 0.33f, 0.66f, 1f },
                    Shader.TileMode.REPEAT
            );

            shaderMatrix.reset();
            shaderMatrix.postTranslate(0, animationProgress * height);
            gradient.setLocalMatrix(shaderMatrix);

            borderPaint.setShader(gradient);
            glowPaint.setShader(gradient);
            glowPaint.setAlpha(150);
            borderPaint.setAlpha(255);

            // Left Edge
            float lx = strokeW / 2f;
            canvas.drawLine(lx, 0, lx, height, glowPaint);
            canvas.drawLine(lx, 0, lx, height, borderPaint);

            // Right Edge
            float rx = width - (strokeW / 2f);
            canvas.drawLine(rx, 0, rx, height, glowPaint);
            canvas.drawLine(rx, 0, rx, height, borderPaint);
        }
    }
}

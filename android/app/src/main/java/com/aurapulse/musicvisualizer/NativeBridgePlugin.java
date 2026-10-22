package com.aurapulse.musicvisualizer;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "NativeBridge")
public class NativeBridgePlugin extends Plugin {

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                boolean canDraw = Settings.canDrawOverlays(getContext());
                ret.put("granted", canDraw);
            } else {
                ret.put("granted", true);
            }
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("granted", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(getContext())) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    ret.put("requested", true);
                } else {
                    ret.put("alreadyGranted", true);
                }
            } else {
                ret.put("alreadyGranted", true);
            }
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("error", e.getMessage());
            call.reject("Failed to open overlay settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startSystemEdgeOverlay(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            call.reject("Overlay permission not granted. Please allow Display Over Other Apps first.");
            return;
        }

        String preset = call.getString("preset", "dynamic-rainbow");
        String color = call.getString("color", "#00f0ff");
        int thickness = call.getInt("thickness", 6);
        int speed = call.getInt("speed", 3);
        String mode = call.getString("mode", "all-edges");

        Intent serviceIntent = new Intent(context, EdgeLightingService.class);
        serviceIntent.setAction(EdgeLightingService.ACTION_START);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_PRESET, preset);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_COLOR, color);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_THICKNESS, thickness);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_SPEED, speed);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_MODE, mode);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start EdgeLightingService: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopSystemEdgeOverlay(PluginCall call) {
        try {
            Context context = getContext();
            Intent serviceIntent = new Intent(context, EdgeLightingService.class);
            serviceIntent.setAction(EdgeLightingService.ACTION_STOP);
            context.stopService(serviceIntent);

            JSObject ret = new JSObject();
            ret.put("stopped", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop EdgeLightingService: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveVideoToGallery(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "video/mp4");
        long durationMs = 0;
        try {
            if (call.hasOption("durationMs")) {
                durationMs = call.getLong("durationMs");
            }
        } catch (Exception ignored) {
            try {
                durationMs = call.getInt("durationMs", 0);
            } catch (Exception ignored2) {}
        }

        if (base64Data == null || fileName == null) {
            call.reject("base64Data and fileName are required");
            return;
        }

        long finalDurationMs = durationMs;
        new Thread(() -> {
            try {
                // Remove data:video/...;base64, prefix if present
                String cleanBase64 = base64Data;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }
                byte[] videoBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                Context context = getContext();
                Uri savedUri = null;

                String cleanMime = mimeType != null && mimeType.contains("webm") ? "video/webm" : "video/mp4";

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Video.Media.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Video.Media.MIME_TYPE, cleanMime);
                    values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/AuraPulse");
                    if (finalDurationMs > 0) {
                        values.put(MediaStore.Video.Media.DURATION, finalDurationMs);
                    }
                    values.put(MediaStore.Video.Media.IS_PENDING, 1);

                    Uri collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    savedUri = context.getContentResolver().insert(collection, values);

                    if (savedUri != null) {
                        try (OutputStream out = context.getContentResolver().openOutputStream(savedUri)) {
                            if (out != null) {
                                out.write(videoBytes);
                                out.flush();
                            }
                        }
                        values.clear();
                        values.put(MediaStore.Video.Media.IS_PENDING, 0);
                        if (finalDurationMs > 0) {
                            values.put(MediaStore.Video.Media.DURATION, finalDurationMs);
                        }
                        context.getContentResolver().update(savedUri, values, null, null);
                    }
                } else {
                    File moviesDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES), "AuraPulse");
                    if (!moviesDir.exists()) {
                        moviesDir.mkdirs();
                    }
                    File file = new File(moviesDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(videoBytes);
                        fos.flush();
                    }
                    savedUri = Uri.fromFile(file);
                    MediaScannerConnection.scanFile(context, new String[]{file.getAbsolutePath()}, new String[]{cleanMime}, null);
                }

                new Handler(Looper.getMainLooper()).post(() -> {
                    Toast.makeText(context, "🎬 Video saved to Gallery / Movies!", Toast.LENGTH_LONG).show();
                });

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("fileName", fileName);
                ret.put("uri", savedUri != null ? savedUri.toString() : "");
                call.resolve(ret);

            } catch (Exception e) {
                call.reject("Error saving video: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName");

        if (base64Data == null || fileName == null) {
            call.reject("base64Data and fileName are required");
            return;
        }

        new Thread(() -> {
            try {
                String cleanBase64 = base64Data;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }
                byte[] imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                Context context = getContext();
                Uri savedUri = null;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/AuraPulse");
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);

                    Uri collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    savedUri = context.getContentResolver().insert(collection, values);

                    if (savedUri != null) {
                        try (OutputStream out = context.getContentResolver().openOutputStream(savedUri)) {
                            if (out != null) {
                                out.write(imageBytes);
                                out.flush();
                            }
                        }
                        values.clear();
                        values.put(MediaStore.Images.Media.IS_PENDING, 0);
                        context.getContentResolver().update(savedUri, values, null, null);
                    }
                } else {
                    File picsDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "AuraPulse");
                    if (!picsDir.exists()) {
                        picsDir.mkdirs();
                    }
                    File file = new File(picsDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(imageBytes);
                        fos.flush();
                    }
                    savedUri = Uri.fromFile(file);
                    MediaScannerConnection.scanFile(context, new String[]{file.getAbsolutePath()}, new String[]{"image/png"}, null);
                }

                new Handler(Looper.getMainLooper()).post(() -> {
                    Toast.makeText(context, "🖼️ Image saved to Gallery / Pictures!", Toast.LENGTH_SHORT).show();
                });

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("fileName", fileName);
                ret.put("uri", savedUri != null ? savedUri.toString() : "");
                call.resolve(ret);

            } catch (Exception e) {
                call.reject("Error saving image: " + e.getMessage());
            }
        }).start();
    }
}

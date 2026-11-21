package com.aurapulse.musicvisualizer;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(
        name = "NativeBridge",
        permissions = {
                @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
        }
)
public class NativeBridgePlugin extends Plugin {

    private static final String PREFS_NAME = "aurapulse_edge_lights";
    private static final String KEY_ACTIVE = "edge_overlay_active";

    static void setEdgeOverlayActive(Context context, boolean active) {
        try {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_ACTIVE, active).apply();
        } catch (Exception ignored) {}
    }

    static boolean isEdgeOverlayActive(Context context) {
        try {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getBoolean(KEY_ACTIVE, false);
        } catch (Exception e) {
            return false;
        }
    }

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

    // ---- POST_NOTIFICATIONS (Android 13+) ----

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                ret.put("granted", true);
            } else {
                boolean granted = ContextCompat.checkSelfPermission(
                        getContext(), Manifest.permission.POST_NOTIFICATIONS)
                        == PackageManager.PERMISSION_GRANTED;
                ret.put("granted", granted);
            }
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("granted", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        // Capacitor permission flow: shows the system runtime dialog and
        // resolves the call in notificationPermissionCallback below.
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PermissionState state = getPermissionState("notifications");
            ret.put("granted", state == PermissionState.GRANTED);
        } catch (Exception e) {
            ret.put("granted", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void isEdgeOverlayActive(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("active", isEdgeOverlayActive(getContext()));
        call.resolve(ret);
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
        // AOD mode: keep lights on after screen-off until the user turns them
        // off from the notification. Defaults to true; JS may pass false.
        boolean aodEnabled = true;
        try {
            Boolean aod = call.getBoolean("aodEnabled");
            if (aod != null) {
                aodEnabled = aod;
            }
        } catch (Exception ignored) {}

        Intent serviceIntent = new Intent(context, EdgeLightingService.class);
        serviceIntent.setAction(EdgeLightingService.ACTION_START);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_PRESET, preset);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_COLOR, color);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_THICKNESS, thickness);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_SPEED, speed);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_MODE, mode);
        serviceIntent.putExtra(EdgeLightingService.EXTRA_AOD_ENABLED, aodEnabled);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            setEdgeOverlayActive(context, true);
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
            // Use stopService, NOT startForegroundService with ACTION_STOP.
            // stopService is a safe no-op when the service is not running,
            // and App.tsx calls this on every launch when lights are off.
            // Starting a foreground service just to stop it can crash on
            // Android 12+ / Vivo (ForegroundServiceDidNotStartInTime) and
            // was the likely 1-second launch crash. The notification Cancel
            // button still uses ACTION_STOP via PendingIntent.getService,
            // and EdgeLightingService.onDestroy() dismisses the AOD and
            // clears the active flag, so no state is lost.
            context.stopService(new Intent(context, EdgeLightingService.class));
            setEdgeOverlayActive(context, false);

            JSObject ret = new JSObject();
            ret.put("stopped", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop EdgeLightingService: " + e.getMessage());
        }
    }

    // ---- Song upload: native file picker (Files app only) ----
    // The WebView <input type="file" accept="audio/*"> uses Capacitor's
    // file chooser, which launches ACTION_GET_CONTENT directly - so if the
    // user once tapped "Always" on the Recorder app, every upload opens
    // the Recorder instead of Files. This picker uses ACTION_OPEN_DOCUMENT
    // wrapped in Intent.createChooser, so Android always shows the system
    // Files picker and no app default can hijack it.
    @PluginMethod
    public void pickAudioFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4",
                "audio/flac", "audio/ogg", "audio/aac", "audio/x-aac"
        });
        Intent chooser = Intent.createChooser(intent, "Choose a song");
        startActivityForResult(call, chooser, "pickAudioFileCallback");
    }

    @ActivityCallback
    private void pickAudioFileCallback(PluginCall call, ActivityResult result) {
        if (result == null || result.getResultCode() != Activity.RESULT_OK
                || result.getData() == null || result.getData().getData() == null) {
            call.reject("No file selected");
            return;
        }
        Uri uri = result.getData().getData();
        try {
            Context context = getContext();
            String fileName = "song.mp3";
            long size = -1;
            try (Cursor cursor = context.getContentResolver().query(
                    uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIdx >= 0) {
                        String n = cursor.getString(nameIdx);
                        if (n != null && !n.isEmpty()) fileName = n;
                    }
                    int sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE);
                    if (sizeIdx >= 0) size = cursor.getLong(sizeIdx);
                }
            }
            if (size > 25L * 1024 * 1024) {
                call.reject("File too large. Please pick a song under 25 MB.");
                return;
            }
            String mimeType = context.getContentResolver().getType(uri);
            if (mimeType == null || mimeType.isEmpty()) mimeType = "audio/mpeg";
            byte[] bytes;
            try (InputStream in = context.getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                if (in == null) {
                    call.reject("Could not read the selected file");
                    return;
                }
                copyStream(in, out);
                bytes = out.toByteArray();
            }
            if (bytes.length > 25L * 1024 * 1024) {
                call.reject("File too large. Please pick a song under 25 MB.");
                return;
            }
            String dataUrl = "data:" + mimeType + ";base64,"
                    + Base64.encodeToString(bytes, Base64.NO_WRAP);
            JSObject ret = new JSObject();
            ret.put("dataUrl", dataUrl);
            ret.put("fileName", fileName);
            ret.put("mimeType", mimeType);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read the selected file: " + e.getMessage());
        }
    }

    private static void copyStream(InputStream in, OutputStream out) throws java.io.IOException {
        byte[] buffer = new byte[32 * 1024];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }

    private static boolean isWebmHeader(File file) {
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] header = new byte[4];
            int read = fis.read(header);
            return read == 4 && header[0] == 0x1a && header[1] == 0x45
                    && header[2] == (byte) 0xdf && header[3] == (byte) 0xa3;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void saveVideoToGallery(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "video/mp4");

        long durationMs = 0;
        try {
            Double d = call.getDouble("durationMs");
            if (d != null && d > 0) {
                durationMs = d.longValue();
            }
        } catch (Exception ignored) {}

        if (durationMs <= 0) {
            try {
                durationMs = call.getInt("durationMs", 0);
            } catch (Exception ignored) {}
        }

        if (base64Data == null || fileName == null) {
            call.reject("base64Data and fileName are required");
            return;
        }

        long finalDurationMs = durationMs;
        String requestedMime = mimeType;
        new Thread(() -> {
            Context context = getContext();
            File tempInput = null;
            File convertedMp4 = null;
            Uri savedUri = null;
            try {
                String cleanBase64 = base64Data;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }
                // Decode once to a temp file on disk. The converted MP4 is
                // streamed out later, so a large video is never held twice in RAM.
                tempInput = new File(context.getCacheDir(), "save_in_" + System.currentTimeMillis()
                        + (requestedMime != null && requestedMime.contains("webm") ? ".webm" : ".mp4"));
                byte[] decoded = Base64.decode(cleanBase64, Base64.DEFAULT);
                try (FileOutputStream fos = new FileOutputStream(tempInput)) {
                    fos.write(decoded);
                    fos.flush();
                }
                decoded = null;

                boolean isWebm = isWebmHeader(tempInput)
                        || (requestedMime != null && requestedMime.contains("webm"))
                        || fileName.endsWith(".webm");

                // The file that will actually be written to the Gallery.
                File sourceFile = tempInput;
                String cleanMime = "video/mp4";
                String finalFileName = fileName;
                if (finalFileName.endsWith(".webm")) {
                    finalFileName = finalFileName.substring(0, finalFileName.length() - 5) + ".mp4";
                } else if (!finalFileName.endsWith(".mp4")) {
                    finalFileName = finalFileName + ".mp4";
                }

                if (isWebm) {
                    // WebM MUST be transcoded to H.264 + AAC first. If transcoding
                    // fails, reject instead of saving raw WebM bytes as ".mp4" -
                    // that is what caused silent videos and 1-2s durations on
                    // WhatsApp / Vivo Gallery / Google Files.
                    try {
                        convertedMp4 = UniversalVideoTranscoder.transcodeWebmToMp4(
                                context, tempInput, finalFileName, finalDurationMs);
                    } catch (Exception transcodeErr) {
                        Log.e("NativeBridge", "Video transcode failed, refusing to save raw WebM as MP4: "
                                + transcodeErr.getMessage());
                        call.reject("Video conversion failed: " + transcodeErr.getMessage()
                                + ". Please try exporting again.");
                        return;
                    }
                    if (convertedMp4 == null || !convertedMp4.exists() || convertedMp4.length() == 0) {
                        call.reject("Video conversion failed: no MP4 was produced. Please try exporting again.");
                        return;
                    }
                    sourceFile = convertedMp4;
                    cleanMime = "video/mp4";
                }

                final long sourceSize = sourceFile.length();

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Video.Media.DISPLAY_NAME, finalFileName);
                    values.put(MediaStore.Video.Media.MIME_TYPE, cleanMime);
                    values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/AuraPulse");
                    values.put(MediaStore.Video.Media.DATE_TAKEN, System.currentTimeMillis());
                    if (finalDurationMs > 0) {
                        values.put(MediaStore.Video.Media.DURATION, finalDurationMs);
                    }
                    values.put(MediaStore.Video.Media.IS_PENDING, 1);

                    Uri collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    savedUri = context.getContentResolver().insert(collection, values);
                    if (savedUri == null) {
                        call.reject("Could not create video entry in Gallery.");
                        return;
                    }

                    try (InputStream in = new FileInputStream(sourceFile);
                         OutputStream out = context.getContentResolver().openOutputStream(savedUri)) {
                        if (out == null) {
                            throw new java.io.IOException("Could not open Gallery output stream");
                        }
                        copyStream(in, out);
                    }

                    // Publish: clear IS_PENDING and write the real duration/size
                    // in the SAME update, so Gallery / WhatsApp never see a
                    // half-written file with a 1-2s duration.
                    ContentValues publish = new ContentValues();
                    publish.put(MediaStore.Video.Media.IS_PENDING, 0);
                    if (finalDurationMs > 0) {
                        publish.put(MediaStore.Video.Media.DURATION, finalDurationMs);
                    }
                    publish.put(MediaStore.MediaColumns.SIZE, sourceSize);
                    context.getContentResolver().update(savedUri, publish, null, null);
                    // No MediaScannerConnection.scanFile(savedUri.getPath()) here:
                    // a content:// Uri has no file path, and scanning it is a
                    // no-op at best. MediaStore already indexes the new entry.
                } else {
                    File moviesDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES), "AuraPulse");
                    if (!moviesDir.exists()) {
                        moviesDir.mkdirs();
                    }
                    File file = new File(moviesDir, finalFileName);
                    try (InputStream in = new FileInputStream(sourceFile);
                         FileOutputStream fos = new FileOutputStream(file)) {
                        copyStream(in, fos);
                    }
                    savedUri = Uri.fromFile(file);
                    MediaScannerConnection.scanFile(context, new String[]{file.getAbsolutePath()}, new String[]{cleanMime}, null);
                }

                final Uri resultUri = savedUri;
                final String resultName = finalFileName;
                new Handler(Looper.getMainLooper()).post(() -> {
                    Toast.makeText(context, "🎬 Video saved to Gallery / Movies!", Toast.LENGTH_LONG).show();
                });

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("fileName", resultName);
                ret.put("uri", resultUri != null ? resultUri.toString() : "");
                call.resolve(ret);

            } catch (Exception e) {
                // Remove the half-written Gallery entry so no broken video remains.
                if (savedUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        context.getContentResolver().delete(savedUri, null, null);
                    } catch (Exception ignored) {}
                }
                call.reject("Error saving video: " + e.getMessage());
            } finally {
                if (tempInput != null && tempInput.exists()) {
                    tempInput.delete();
                }
                if (convertedMp4 != null && convertedMp4.exists()) {
                    convertedMp4.delete();
                }
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

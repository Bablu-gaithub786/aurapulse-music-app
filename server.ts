import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { spawn, exec } from "child_process";
import fs from "fs";
import os from "os";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use temporary directory for uploads and outputs
  const upload = multer({ dest: os.tmpdir() });

  // API Route for converting WebM to MP4
  app.post("/api/convert-to-mp4", upload.single("video"), (req: any, res: any) => {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided" });
    }

    const inputPath = req.file.path;
    const outputPath = path.join(os.tmpdir(), `converted_${Date.now()}_${req.file.filename}.mp4`);

    console.log(`Received conversion request. Input: ${inputPath}, Output: ${outputPath}`);

    // Inspect input file to check if it contains audio tracks
    const ffprobeCmd = `ffprobe -v error -select_streams a -show_entries stream=codec_name -of default=nokey=1:noprint_wrappers=1 "${inputPath}"`;

    exec(ffprobeCmd, (probeErr, stdout) => {
      const hasAudio = !probeErr && stdout.trim().length > 0;
      console.log(`Input WebM audio stream present: ${hasAudio} (${stdout.trim()})`);

      let ffmpegArgs: string[] = [];

      if (hasAudio) {
        // High-compatibility FFmpeg MP4 flags for WhatsApp, Instagram Reels, Android & iOS Gallery:
        // -fflags +genpts+igndts: Rebuilds clean timeline timestamps, fixing 1-second duration glitch
        // -af aresample=async=1: Resynchronizes audio sample drift with video frames
        // -movflags +faststart: Moves moov header to beginning for immediate preview playback on WhatsApp
        ffmpegArgs = [
          "-y",
          "-fflags", "+genpts+igndts",
          "-i", inputPath,
          "-max_muxing_queue_size", "2048",
          "-r", "30",
          "-c:v", "libx264",
          "-preset", "superfast",
          "-crf", "22",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "192k",
          "-ac", "2",
          "-ar", "44100",
          "-af", "aresample=async=1:min_hard_comp=0.100000",
          "-movflags", "+faststart",
          outputPath
        ];
      } else {
        // If input video has no audio stream, generate silent AAC audio track so MP4 stays valid for WhatsApp
        ffmpegArgs = [
          "-y",
          "-fflags", "+genpts+igndts",
          "-i", inputPath,
          "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
          "-max_muxing_queue_size", "2048",
          "-r", "30",
          "-c:v", "libx264",
          "-preset", "superfast",
          "-crf", "22",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "128k",
          "-shortest",
          "-movflags", "+faststart",
          outputPath
        ];
      }

      const ffmpeg = spawn("ffmpeg", ffmpegArgs);

      let stderrData = "";
      ffmpeg.stderr.on("data", (data) => {
        stderrData += data.toString();
      });

      ffmpeg.on("close", (code) => {
        // Clean up uploaded WebM file
        try {
          fs.unlinkSync(inputPath);
        } catch (e) {
          console.error("Failed to delete input WebM file:", e);
        }

        if (code !== 0) {
          console.error(`ffmpeg failed with exit code ${code}. Error log:`, stderrData);
          return res.status(500).json({ error: "Video conversion failed on the server." });
        }

        console.log(`Video successfully transcoded to MP4: ${outputPath}`);

        // Send converted MP4 file and clean up temporary file afterwards
        res.download(outputPath, "AuraPulse_Studio_Video.mp4", (err: any) => {
          try {
            fs.unlinkSync(outputPath);
          } catch (e) {
            console.error("Failed to delete output MP4 file:", e);
          }
          if (err) {
            console.error("Error sending MP4 file to client:", err);
          }
        });
      });
    });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();

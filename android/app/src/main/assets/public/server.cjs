var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_multer = __toESM(require("multer"), 1);
var import_child_process = require("child_process");
var import_fs = __toESM(require("fs"), 1);
var import_os = __toESM(require("os"), 1);
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  const upload = (0, import_multer.default)({ dest: import_os.default.tmpdir() });
  app.post("/api/convert-to-mp4", upload.single("video"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided" });
    }
    const inputPath = req.file.path;
    const outputPath = import_path.default.join(import_os.default.tmpdir(), `converted_${Date.now()}_${req.file.filename}.mp4`);
    console.log(`Received conversion request. Input: ${inputPath}, Output: ${outputPath}`);
    const ffprobeCmd = `ffprobe -v error -select_streams a -show_entries stream=codec_name -of default=nokey=1:noprint_wrappers=1 "${inputPath}"`;
    (0, import_child_process.exec)(ffprobeCmd, (probeErr, stdout) => {
      const hasAudio = !probeErr && stdout.trim().length > 0;
      console.log(`Input WebM audio stream present: ${hasAudio} (${stdout.trim()})`);
      let ffmpegArgs = [];
      if (hasAudio) {
        ffmpegArgs = [
          "-y",
          "-fflags",
          "+genpts+igndts",
          "-i",
          inputPath,
          "-max_muxing_queue_size",
          "2048",
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-preset",
          "superfast",
          "-crf",
          "22",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-ac",
          "2",
          "-ar",
          "44100",
          "-af",
          "aresample=async=1:min_hard_comp=0.100000",
          "-movflags",
          "+faststart",
          outputPath
        ];
      } else {
        ffmpegArgs = [
          "-y",
          "-fflags",
          "+genpts+igndts",
          "-i",
          inputPath,
          "-f",
          "lavfi",
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=44100",
          "-max_muxing_queue_size",
          "2048",
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-preset",
          "superfast",
          "-crf",
          "22",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-shortest",
          "-movflags",
          "+faststart",
          outputPath
        ];
      }
      const ffmpeg = (0, import_child_process.spawn)("ffmpeg", ffmpegArgs);
      let stderrData = "";
      ffmpeg.stderr.on("data", (data) => {
        stderrData += data.toString();
      });
      ffmpeg.on("close", (code) => {
        try {
          import_fs.default.unlinkSync(inputPath);
        } catch (e) {
          console.error("Failed to delete input WebM file:", e);
        }
        if (code !== 0) {
          console.error(`ffmpeg failed with exit code ${code}. Error log:`, stderrData);
          return res.status(500).json({ error: "Video conversion failed on the server." });
        }
        console.log(`Video successfully transcoded to MP4: ${outputPath}`);
        res.download(outputPath, "AuraPulse_Studio_Video.mp4", (err) => {
          try {
            import_fs.default.unlinkSync(outputPath);
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
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map

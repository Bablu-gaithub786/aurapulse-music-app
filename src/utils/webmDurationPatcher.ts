/**
 * High-performance binary EBML WebM Duration Patcher.
 * MediaRecorder on Android Chrome and WebViews produces WebM files with missing
 * or partial duration headers (e.g. 1s or 4s matching initial chunk buffer),
 * causing Android Gallery, Google Photos, and media players to display truncated video duration.
 *
 * This patcher searches the WebM EBML binary structure directly in memory,
 * finds the Matroska Duration element (0x44 0x89) or Info element (0x15 0x49 0xA9 0x66),
 * and UNCONDITIONALLY injects/overwrites the true duration in milliseconds.
 */

export async function patchWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  if (durationMs <= 0 || !blob || blob.size === 0) {
    return blob;
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);

    // Verify EBML signature: 0x1A, 0x45, 0xDF, 0xA3
    if (bytes.length < 16 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
      console.warn('[WebmPatcher] Input is not valid EBML WebM');
      return blob;
    }

    const searchLimit = Math.min(bytes.length - 12, 16384);
    let patched = false;

    // 1. Search for existing Duration element (0x44, 0x89) in the header
    for (let i = 0; i < searchLimit; i++) {
      if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
        const lenByte = bytes[i + 2];
        if (lenByte === 0x84) {
          // 4-byte Float32 duration
          view.setFloat32(i + 3, durationMs, false); // big-endian
          patched = true;
          console.log(`[WebmPatcher] Overwrote 4-byte Float32 duration at offset ${i} to ${durationMs}ms`);
          break;
        } else if (lenByte === 0x88) {
          // 8-byte Float64 duration
          view.setFloat64(i + 3, durationMs, false); // big-endian
          patched = true;
          console.log(`[WebmPatcher] Overwrote 8-byte Float64 duration at offset ${i} to ${durationMs}ms`);
          break;
        }
      }
    }

    if (patched) {
      return new Blob([bytes], { type: blob.type || 'video/webm' });
    }

    // 2. If Duration element (0x44 0x89) is not yet present, locate Segment Info (0x15 0x49 0xA9 0x66)
    for (let i = 0; i < searchLimit; i++) {
      if (bytes[i] === 0x15 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0xa9 && bytes[i + 3] === 0x66) {
        // Read Info section length
        const lenByte = bytes[i + 4];
        let infoLen = 0;
        let insertOffset = 0;

        if ((lenByte & 0x80) !== 0) { // 1-byte length
          infoLen = lenByte & 0x7f;
          insertOffset = i + 5;
        } else if ((lenByte & 0x40) !== 0) { // 2-byte length
          infoLen = ((lenByte & 0x3f) << 8) | bytes[i + 5];
          insertOffset = i + 6;
        }

        if (insertOffset > 0) {
          // Prepare new 11-byte Duration element: [0x44, 0x89, 0x88, ...8 bytes Float64]
          const durElement = new Uint8Array(11);
          durElement[0] = 0x44;
          durElement[1] = 0x89;
          durElement[2] = 0x88;
          const durView = new DataView(durElement.buffer);
          durView.setFloat64(3, durationMs, false);

          const newBytes = new Uint8Array(bytes.length + 11);
          newBytes.set(bytes.subarray(0, insertOffset), 0);
          newBytes.set(durElement, insertOffset);
          newBytes.set(bytes.subarray(insertOffset), insertOffset + 11);

          // Update Info element's declared length if single-byte encoded
          const newInfoLen = infoLen + 11;
          if ((lenByte & 0x80) !== 0 && newInfoLen < 128) {
            newBytes[i + 4] = 0x80 | newInfoLen;
          }

          console.log(`[WebmPatcher] Injected Duration element (${durationMs}ms) into Segment Info at offset ${insertOffset}`);
          return new Blob([newBytes], { type: blob.type || 'video/webm' });
        }
      }
    }

    return blob;
  } catch (err) {
    console.error('[WebmPatcher] Error while patching WebM duration:', err);
    return blob;
  }
}

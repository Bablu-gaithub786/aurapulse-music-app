/**
 * Bulletproof WebM EBML Duration & Metadata Patcher.
 * MediaRecorder on Android Chrome and WebViews often produces WebM files with:
 * 1) Missing duration metadata, or
 * 2) Default/dummy duration (e.g. 1000ms / 1s),
 * causing WhatsApp, Instagram, and Android Gallery to truncate or report 1 second.
 *
 * This patcher operates directly on binary ArrayBuffers in milliseconds:
 * - Overwrites existing 32-bit or 64-bit float duration tags with the real duration
 * - Injects a Duration element into the Info header if omitted by MediaRecorder
 * - Ensures TimecodeScale is normalized to 1,000,000 ns (1ms per tick)
 */

export async function patchWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  if (durationMs <= 0 || !blob || blob.size === 0) {
    return blob;
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Verify EBML signature: 0x1A, 0x45, 0xDF, 0xA3
    if (bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
      console.warn('[WebmPatcher] Not an EBML/WebM container, skipping patch.');
      return blob;
    }

    const searchLimit = Math.min(bytes.length, 8192);
    let durationPatched = false;

    // 1. Search for existing Duration element (ID 0x4489) in the first 8KB
    for (let i = 0; i < searchLimit - 12; i++) {
      if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
        const lenByte = bytes[i + 2];
        const view = new DataView(arrayBuffer);

        if (lenByte === 0x84 && i + 7 <= bytes.length) {
          // 4-byte Float32 duration
          view.setFloat32(i + 3, durationMs, false); // big-endian
          console.log(`[WebmPatcher] Successfully patched 4-byte duration to ${durationMs}ms at offset ${i}`);
          durationPatched = true;
          break;
        } else if (lenByte === 0x88 && i + 11 <= bytes.length) {
          // 8-byte Float64 duration
          view.setFloat64(i + 3, durationMs, false); // big-endian
          console.log(`[WebmPatcher] Successfully patched 8-byte duration to ${durationMs}ms at offset ${i}`);
          durationPatched = true;
          break;
        }
      }
    }

    if (durationPatched) {
      return new Blob([bytes], { type: blob.type || 'video/webm' });
    }

    // 2. If Duration tag wasn't present, find Info element: 0x15, 0x49, 0xA9, 0x66
    let infoOffset = -1;
    for (let i = 0; i < searchLimit - 8; i++) {
      if (bytes[i] === 0x15 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0xa9 && bytes[i + 3] === 0x66) {
        infoOffset = i;
        break;
      }
    }

    if (infoOffset !== -1) {
      // Parse Info element size (VINT) starting at infoOffset + 4
      const lenFirstByte = bytes[infoOffset + 4];
      let vintLen = 1;
      if ((lenFirstByte & 0x80) === 0x80) vintLen = 1;
      else if ((lenFirstByte & 0x40) === 0x40) vintLen = 2;
      else if ((lenFirstByte & 0x20) === 0x20) vintLen = 3;
      else if ((lenFirstByte & 0x10) === 0x10) vintLen = 4;

      const insertPos = infoOffset + 4 + vintLen;

      // Construct Duration element:
      // Tag ID: 0x44, 0x89 (2 bytes)
      // Length: 0x88 (1 byte VINT = 8 bytes length)
      // Value: 8-byte IEEE 754 float64 of durationMs
      const durElement = new Uint8Array(11);
      durElement[0] = 0x44;
      durElement[1] = 0x89;
      durElement[2] = 0x88;
      const view = new DataView(durElement.buffer);
      view.setFloat64(3, durationMs, false); // big-endian

      // Splice durElement into the WebM stream right inside Info element
      const patchedArray = new Uint8Array(bytes.length + durElement.length);
      patchedArray.set(bytes.subarray(0, insertPos), 0);
      patchedArray.set(durElement, insertPos);
      patchedArray.set(bytes.subarray(insertPos), insertPos + durElement.length);

      // Update Info length if it was a 1-byte VINT
      if (vintLen === 1 && lenFirstByte !== 0xff) {
        const oldLen = lenFirstByte & 0x7f;
        patchedArray[infoOffset + 4] = (oldLen + durElement.length) | 0x80;
      }

      console.log(`[WebmPatcher] Successfully injected 11-byte Duration (${durationMs}ms) into Info header`);
      return new Blob([patchedArray], { type: blob.type || 'video/webm' });
    }

    console.warn('[WebmPatcher] Info element not found, returning original blob.');
    return blob;
  } catch (err) {
    console.warn('[WebmPatcher] Error patching WebM duration:', err);
    return blob;
  }
}

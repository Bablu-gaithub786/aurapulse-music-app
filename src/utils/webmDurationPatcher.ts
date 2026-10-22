/**
 * Bulletproof WebM EBML Duration & Metadata Patcher.
 * MediaRecorder on Android Chrome and WebViews produces WebM files with missing
 * or dummy duration headers (often 1000ms or 3000ms), causing Android Gallery,
 * Google Photos, WhatsApp, and mobile players to display 1s or 3s video length.
 *
 * This patcher directly locates and force-overwrites the EBML Duration element (0x4489)
 * with the exact duration in milliseconds, or injects it into the Segment Info container
 * if missing.
 */

function readVint(bytes: Uint8Array, offset: number): { value: number; length: number } | null {
  if (offset >= bytes.length) return null;
  const firstByte = bytes[offset];
  if (firstByte === 0) return null;

  let mask = 0x80;
  let length = 1;
  while ((firstByte & mask) === 0 && length <= 8) {
    mask >>= 1;
    length++;
  }

  if (length > 8 || offset + length > bytes.length) return null;

  let value = firstByte & (~mask);
  for (let i = 1; i < length; i++) {
    value = (value << 8) | bytes[offset + i];
  }

  return { value, length };
}

export async function patchWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  if (durationMs <= 0 || !blob || blob.size === 0) {
    return blob;
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Verify EBML Header signature: 0x1A, 0x45, 0xDF, 0xA3
    if (bytes.length < 16 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
      console.warn('[WebmPatcher] Not an EBML WebM file or header too short');
      return blob;
    }

    const searchLimit = Math.min(bytes.length, 65536);
    let patched = false;

    // First: Check if TimecodeScale is present to calculate exact duration ticks
    // TimecodeScale ID: 0x2AD7B1 (3 bytes)
    let timecodeScaleNs = 1000000; // default 1ms
    for (let i = 0; i < searchLimit - 8; i++) {
      if (bytes[i] === 0x2a && bytes[i + 1] === 0xd7 && bytes[i + 2] === 0xb1) {
        const vint = readVint(bytes, i + 3);
        if (vint && vint.length <= 8 && i + 3 + vint.length + vint.value <= bytes.length) {
          let scaleVal = 0;
          const valStart = i + 3 + vint.length;
          for (let k = 0; k < vint.value; k++) {
            scaleVal = (scaleVal << 8) | bytes[valStart + k];
          }
          if (scaleVal > 0) {
            timecodeScaleNs = scaleVal;
          }
        }
        break;
      }
    }

    // Duration value in WebM units = (durationMs * 1,000,000) / timecodeScaleNs
    const webmDurationValue = (durationMs * 1000000) / timecodeScaleNs;

    // Step 1: Scan for existing Duration element (ID 0x4489)
    for (let i = 0; i < searchLimit - 12; i++) {
      if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
        const vint = readVint(bytes, i + 2);
        if (vint) {
          const valOffset = i + 2 + vint.length;
          const view = new DataView(arrayBuffer);

          if (vint.value === 4 && valOffset + 4 <= bytes.length) {
            // 32-bit float
            view.setFloat32(valOffset, webmDurationValue, false);
            console.log(`[WebmPatcher] Force-overwrote existing Float32 Duration at offset ${valOffset} to ${durationMs}ms`);
            patched = true;
          } else if (vint.value === 8 && valOffset + 8 <= bytes.length) {
            // 64-bit float
            view.setFloat64(valOffset, webmDurationValue, false);
            console.log(`[WebmPatcher] Force-overwrote existing Float64 Duration at offset ${valOffset} to ${durationMs}ms`);
            patched = true;
          }
        }
      }
    }

    if (patched) {
      return new Blob([bytes], { type: blob.type || 'video/webm' });
    }

    // Step 2: Duration element was NOT present. Locate Info element (0x15, 0x49, 0xA9, 0x66) to inject it.
    let infoOffset = -1;
    for (let i = 0; i < searchLimit - 8; i++) {
      if (bytes[i] === 0x15 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0xa9 && bytes[i + 3] === 0x66) {
        infoOffset = i;
        break;
      }
    }

    if (infoOffset !== -1) {
      const lenFirstByte = bytes[infoOffset + 4];
      let vintLen = 1;
      if ((lenFirstByte & 0x80) === 0x80) vintLen = 1;
      else if ((lenFirstByte & 0x40) === 0x40) vintLen = 2;
      else if ((lenFirstByte & 0x20) === 0x20) vintLen = 3;
      else if ((lenFirstByte & 0x10) === 0x10) vintLen = 4;

      const insertPos = infoOffset + 4 + vintLen;

      // Create Duration element: ID 0x4489 + VINT length 0x88 (8 bytes) + Float64 (8 bytes) = 11 bytes
      const durElement = new Uint8Array(11);
      durElement[0] = 0x44;
      durElement[1] = 0x89;
      durElement[2] = 0x88; // 8 bytes float64
      const view = new DataView(durElement.buffer);
      view.setFloat64(3, webmDurationValue, false);

      const patchedArray = new Uint8Array(bytes.length + durElement.length);
      patchedArray.set(bytes.subarray(0, insertPos), 0);
      patchedArray.set(durElement, insertPos);
      patchedArray.set(bytes.subarray(insertPos), insertPos + durElement.length);

      // Update Info element length vint if it was 1-byte vint
      if (vintLen === 1 && lenFirstByte !== 0xff) {
        const oldLen = lenFirstByte & 0x7f;
        patchedArray[infoOffset + 4] = (oldLen + durElement.length) | 0x80;
      }

      console.log(`[WebmPatcher] Successfully injected 11-byte Duration header (${durationMs}ms) into Info section!`);
      return new Blob([patchedArray], { type: blob.type || 'video/webm' });
    }

    console.warn('[WebmPatcher] Could not find Info element in WebM header to patch duration');
    return blob;
  } catch (err) {
    console.error('[WebmPatcher] Error while patching WebM duration:', err);
    return blob;
  }
}

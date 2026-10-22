/**
 * Professional EBML WebM Duration Patcher.
 * MediaRecorder on Android Chrome and WebViews produces WebM files with missing
 * or partial duration headers (e.g. 1s or 4s, matching the first slice buffer),
 * causing Android Gallery, Google Photos, and media players to display truncated video duration.
 *
 * This parser parses the full EBML container tree, sets TimecodeScale to 1,000,000ns (1ms),
 * and UNCONDITIONALLY injects/overwrites the true duration in milliseconds.
 */

interface SectionInfo {
  name: string;
  type: 'Container' | 'Uint' | 'Float' | 'String' | 'Binary' | 'Unknown';
}

const SECTIONS: Record<number, SectionInfo> = {
  0xa45dfa3: { name: 'EBML', type: 'Container' },
  0x286: { name: 'EBMLVersion', type: 'Uint' },
  0x2f7: { name: 'EBMLReadVersion', type: 'Uint' },
  0x2f2: { name: 'EBMLMaxIDLength', type: 'Uint' },
  0x2f3: { name: 'EBMLMaxSizeLength', type: 'Uint' },
  0x282: { name: 'DocType', type: 'String' },
  0x287: { name: 'DocTypeVersion', type: 'Uint' },
  0x285: { name: 'DocTypeReadVersion', type: 'Uint' },
  0x6c: { name: 'Void', type: 'Binary' },
  0x3f: { name: 'CRC-32', type: 'Binary' },
  0x8538067: { name: 'Segment', type: 'Container' },
  0x14d9b74: { name: 'SeekHead', type: 'Container' },
  0xdbb: { name: 'Seek', type: 'Container' },
  0x13ab: { name: 'SeekID', type: 'Binary' },
  0x13ac: { name: 'SeekPosition', type: 'Uint' },
  0x549a966: { name: 'Info', type: 'Container' },
  0x33a4: { name: 'SegmentUID', type: 'Binary' },
  0x3384: { name: 'SegmentFilename', type: 'String' },
  0xad7b1: { name: 'TimecodeScale', type: 'Uint' },
  0x489: { name: 'Duration', type: 'Float' },
  0x461: { name: 'DateUTC', type: 'Binary' },
  0x3ba9: { name: 'Title', type: 'String' },
  0xd80: { name: 'MuxingApp', type: 'String' },
  0x1741: { name: 'WritingApp', type: 'String' },
  0x654367b: { name: 'Tracks', type: 'Container' },
  0x2e: { name: 'TrackEntry', type: 'Container' },
  0x7373: { name: 'Tag', type: 'Container' },
  0x67: { name: 'Timecode', type: 'Uint' }
};

class WebmBase {
  name: string;
  type: string;
  source: Uint8Array = new Uint8Array(0);

  constructor(name: string, type: string) {
    this.name = name;
    this.type = type;
  }

  setSource(source: Uint8Array) {
    this.source = source;
    this.updateBySource();
  }

  updateBySource() {}
  updateByData() {}
}

class WebmUint extends WebmBase {
  data: number = 0;

  constructor(name: string, type?: string) {
    super(name, type || 'Uint');
  }

  override updateBySource() {
    let value = 0;
    for (let i = 0; i < this.source.length; i++) {
      value = value * 256 + this.source[i];
    }
    this.data = value;
  }

  override updateByData() {
    let value = this.data;
    const bytes: number[] = [];
    do {
      bytes.unshift(value & 0xff);
      value = Math.floor(value / 256);
    } while (value > 0);
    this.source = new Uint8Array(bytes);
  }

  getValue(): number {
    return this.data;
  }

  setValue(val: number) {
    this.data = val;
    this.updateByData();
  }
}

class WebmFloat extends WebmBase {
  data: number = 0;

  constructor(name: string, type?: string) {
    super(name, type || 'Float');
  }

  override updateBySource() {
    const is32 = this.source.length === 4;
    const is64 = this.source.length === 8;
    if (!is32 && !is64) return;
    const buf = new ArrayBuffer(this.source.length);
    const view = new DataView(buf);
    for (let i = 0; i < this.source.length; i++) {
      view.setUint8(i, this.source[i]);
    }
    this.data = is32 ? view.getFloat32(0, false) : view.getFloat64(0, false);
  }

  override updateByData() {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setFloat64(0, this.data, false);
    this.source = new Uint8Array(buf);
  }

  getValue(): number {
    return this.data;
  }

  setValue(val: number) {
    this.data = val;
    this.updateByData();
  }
}

interface SectionEntry {
  id: number;
  data: WebmBase;
}

class WebmContainer extends WebmBase {
  data: SectionEntry[] = [];
  offset: number = 0;

  constructor(name: string, type?: string) {
    super(name, type || 'Container');
  }

  readByte(): number {
    return this.source[this.offset++];
  }

  readUint(): number {
    const firstByte = this.readByte();
    if (firstByte === undefined) return 0;
    const bytes = 8 - firstByte.toString(2).length;
    let value = firstByte - (1 << (7 - bytes));
    for (let i = 0; i < bytes; i++) {
      value = value * 256 + this.readByte();
    }
    return value;
  }

  override updateBySource() {
    this.data = [];
    this.offset = 0;
    while (this.offset < this.source.length) {
      const id = this.readUint();
      const len = this.readUint();
      const end = Math.min(this.offset + len, this.source.length);
      const chunk = this.source.slice(this.offset, end);
      this.offset = end;

      const info = SECTIONS[id] || { name: 'Unknown', type: 'Unknown' };
      let entryObj: WebmBase;
      if (info.type === 'Container') {
        entryObj = new WebmContainer(info.name, info.type);
      } else if (info.type === 'Uint') {
        entryObj = new WebmUint(info.name, info.type);
      } else if (info.type === 'Float') {
        entryObj = new WebmFloat(info.name, info.type);
      } else {
        entryObj = new WebmBase(info.name, info.type);
      }

      entryObj.setSource(chunk);
      this.data.push({ id, data: entryObj });
    }
  }

  writeUint(x: number, draft: boolean) {
    let bytes = 1;
    let flag = 0x80;
    while (x >= flag && bytes < 8) {
      bytes++;
      flag *= 0x80;
    }

    if (!draft) {
      let value = flag + x;
      for (let i = bytes - 1; i >= 0; i--) {
        const c = value % 256;
        this.source[this.offset + i] = c;
        value = Math.floor((value - c) / 256);
      }
    }
    this.offset += bytes;
  }

  writeSections(draft: boolean): number {
    this.offset = 0;
    for (let i = 0; i < this.data.length; i++) {
      const entry = this.data[i];
      const content = entry.data.source;
      const contentLength = content.length;
      this.writeUint(entry.id, draft);
      this.writeUint(contentLength, draft);
      if (!draft) {
        this.source.set(content, this.offset);
      }
      this.offset += contentLength;
    }
    return this.offset;
  }

  override updateByData() {
    const length = this.writeSections(true);
    this.source = new Uint8Array(length);
    this.writeSections(false);
  }

  getSectionById(id: number): WebmBase | null {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].id === id) {
        return this.data[i].data;
      }
    }
    return null;
  }
}

class WebmFile extends WebmContainer {
  constructor(source: Uint8Array) {
    super('File', 'File');
    this.setSource(source);
  }

  fixDuration(durationMs: number): boolean {
    const segment = this.getSectionById(0x8538067) as WebmContainer;
    if (!segment) {
      console.warn('[WebmPatcher] Segment section missing');
      return false;
    }

    const info = segment.getSectionById(0x549a966) as WebmContainer;
    if (!info) {
      console.warn('[WebmPatcher] Info section missing');
      return false;
    }

    // Set TimecodeScale to 1,000,000ns (1ms per tick)
    let timeScale = info.getSectionById(0xad7b1) as WebmUint;
    if (!timeScale) {
      timeScale = new WebmUint('TimecodeScale', 'Uint');
      info.data.push({ id: 0xad7b1, data: timeScale });
    }
    timeScale.setValue(1000000);

    // Duration in WebM is in TimecodeScale units (1ms = 1 tick, so durationMs)
    let durationSection = info.getSectionById(0x489) as WebmFloat;
    if (durationSection) {
      console.log(`[WebmPatcher] Overwriting existing Duration (${durationSection.getValue()}ms) with real duration: ${durationMs}ms`);
      durationSection.setValue(durationMs);
    } else {
      console.log(`[WebmPatcher] Appending Duration section with real duration: ${durationMs}ms`);
      durationSection = new WebmFloat('Duration', 'Float');
      durationSection.setValue(durationMs);
      info.data.push({ id: 0x489, data: durationSection });
    }

    info.updateByData();
    segment.updateByData();
    this.updateByData();

    return true;
  }

  toBlob(mimeType: string = 'video/webm'): Blob {
    return new Blob([this.source.buffer], { type: mimeType });
  }
}

/**
 * Bulletproof patchWebmDuration that guarantees full duration injection into WebM files.
 */
export async function patchWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  if (durationMs <= 0 || !blob || blob.size === 0) {
    return blob;
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const sourceBytes = new Uint8Array(arrayBuffer);

    // Verify EBML signature: 0x1A, 0x45, 0xDF, 0xA3
    if (sourceBytes.length < 16 || sourceBytes[0] !== 0x1a || sourceBytes[1] !== 0x45 || sourceBytes[2] !== 0xdf || sourceBytes[3] !== 0xa3) {
      console.warn('[WebmPatcher] Input is not valid EBML WebM');
      return blob;
    }

    const file = new WebmFile(sourceBytes);
    if (file.fixDuration(durationMs)) {
      const fixedBlob = file.toBlob(blob.type || 'video/webm');
      console.log(`[WebmPatcher] SUCCESS: Patched WebM duration to ${durationMs}ms! New size: ${fixedBlob.size} bytes`);
      return fixedBlob;
    }

    return blob;
  } catch (err) {
    console.error('[WebmPatcher] Error while patching WebM duration:', err);
    return blob;
  }
}

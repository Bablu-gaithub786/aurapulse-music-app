/**
 * Ultra-robust WebM EBML Duration Patcher.
 * MediaRecorder on Android Chrome and WebViews often produces WebM files with:
 * 1) Missing duration metadata, or
 * 2) Default/dummy duration (e.g., 0ms, 1000ms/1s, or 3000ms/3s),
 * causing WhatsApp, Instagram, and Android Gallery to truncate or report 1 second.
 *
 * This patcher parses the EBML tree, finds or creates the Info.Duration and Info.TimecodeScale
 * sections, and forces the EXACT actual recording duration (in milliseconds) into the container.
 */

// Helper types for EBML parsing
interface SectionNode {
  id: number;
  idHex: string;
  data: any;
}

function padHex(hex: string): string {
  return hex.length % 2 === 1 ? '0' + hex : hex;
}

function doInherit(subClass: any, superClass: any) {
  subClass.prototype = Object.create(superClass.prototype);
  subClass.prototype.constructor = subClass;
}

function WebmBase(this: any, name: string, type: string) {
  this.name = name || 'Unknown';
  this.type = type || 'Unknown';
}

WebmBase.prototype.updateBySource = function () {};
WebmBase.prototype.setSource = function (source: Uint8Array) {
  this.source = source;
  this.updateBySource();
};
WebmBase.prototype.updateByData = function () {};
WebmBase.prototype.setData = function (data: any) {
  this.data = data;
  this.updateByData();
};

function WebmUint(this: any, name: string, type: string) {
  WebmBase.call(this, name, type || 'Uint');
}
doInherit(WebmUint, WebmBase);

WebmUint.prototype.updateBySource = function () {
  this.data = '';
  for (let i = 0; i < this.source.length; i++) {
    const hex = this.source[i].toString(16);
    this.data += padHex(hex);
  }
};
WebmUint.prototype.updateByData = function () {
  const length = this.data.length / 2;
  this.source = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    const hex = this.data.substr(i * 2, 2);
    this.source[i] = parseInt(hex, 16);
  }
};
WebmUint.prototype.getValue = function () {
  return parseInt(this.data, 16) || 0;
};
WebmUint.prototype.setValue = function (value: number) {
  this.setData(padHex(value.toString(16)));
};

function WebmFloat(this: any, name: string, type: string) {
  WebmBase.call(this, name, type || 'Float');
}
doInherit(WebmFloat, WebmBase);

WebmFloat.prototype.getFloatArrayType = function () {
  return this.source && this.source.length === 4 ? Float32Array : Float64Array;
};
WebmFloat.prototype.updateBySource = function () {
  const byteArray = new Uint8Array(this.source).reverse();
  const FloatType = this.getFloatArrayType();
  const floatArray = new FloatType(byteArray.buffer);
  this.data = floatArray[0];
};
WebmFloat.prototype.updateByData = function () {
  const FloatType = this.getFloatArrayType();
  const floatArray = new FloatType([this.data]);
  const byteArray = new Uint8Array(floatArray.buffer);
  this.source = byteArray.reverse();
};
WebmFloat.prototype.getValue = function () {
  return this.data;
};
WebmFloat.prototype.setValue = function (value: number) {
  this.setData(value);
};

const SECTIONS: Record<number, { name: string; type: string }> = {
  0xa45dfa3: { name: 'EBML', type: 'Container' },
  0x2f43b67: { name: 'EBMLVersion', type: 'Uint' },
  0x2f7: { name: 'EBMLReadVersion', type: 'Uint' },
  0x2f2: { name: 'EBMLMaxIDLength', type: 'Uint' },
  0x2f3: { name: 'EBMLMaxSizeLength', type: 'Uint' },
  0x4286: { name: 'DocType', type: 'String' },
  0x42f7: { name: 'DocTypeVersion', type: 'Uint' },
  0x42f2: { name: 'DocTypeReadVersion', type: 'Uint' },
  0x8538067: { name: 'Segment', type: 'Container' },
  0x14d9b74: { name: 'SeekHead', type: 'Container' },
  0x1b538667: { name: 'Info', type: 'Container' },
  0x549a966: { name: 'Info', type: 'Container' },
  0xad7b1: { name: 'TimecodeScale', type: 'Uint' },
  0x489: { name: 'Duration', type: 'Float' },
  0x4489: { name: 'Duration', type: 'Float' },
  0x7ba9: { name: 'Title', type: 'String' },
  0x4d80: { name: 'MuxingApp', type: 'String' },
  0x5741: { name: 'WritingApp', type: 'String' },
  0x6543210: { name: 'Tracks', type: 'Container' },
  0x2e: { name: 'TrackEntry', type: 'Container' },
  0x7373: { name: 'Tag', type: 'Container' },
  0x1f43b675: { name: 'Cluster', type: 'Container' }
};

function WebmContainer(this: any, name: string, type: string) {
  WebmBase.call(this, name, type || 'Container');
}
doInherit(WebmContainer, WebmBase);

WebmContainer.prototype.readByte = function () {
  return this.source[this.offset++];
};

WebmContainer.prototype.readUint = function () {
  const firstByte = this.readByte();
  const bytes = 8 - firstByte.toString(2).length;
  let value = firstByte - (1 << (7 - bytes));
  for (let i = 0; i < bytes; i++) {
    value = value * 256 + this.readByte();
  }
  return value;
};

WebmContainer.prototype.updateBySource = function () {
  this.data = [];
  for (this.offset = 0; this.offset < this.source.length; ) {
    const id = this.readUint();
    const len = this.readUint();
    const end = Math.min(this.offset + len, this.source.length);
    const data = this.source.slice(this.offset, end);
    const info = SECTIONS[id] || { name: 'Unknown', type: 'Unknown' };
    let Ctr: any = WebmBase;
    switch (info.type) {
      case 'Container':
        Ctr = WebmContainer;
        break;
      case 'Uint':
        Ctr = WebmUint;
        break;
      case 'Float':
        Ctr = WebmFloat;
        break;
      default:
        Ctr = WebmBase;
    }
    const section = new Ctr(info.name, info.type);
    section.setSource(data);
    this.data.push({
      id,
      idHex: id.toString(16),
      data: section
    });
    this.offset = end;
  }
};

WebmContainer.prototype.writeUint = function (x: number, draft?: boolean) {
  let bytes = 1;
  let flag = 0x80;
  for (; x >= flag && bytes < 8; bytes++, flag *= 0x80) {}
  if (!draft) {
    let value = flag + x;
    for (let i = bytes - 1; i >= 0; i--) {
      const c = value % 256;
      this.source[this.offset + i] = c;
      value = Math.floor((value - c) / 256);
    }
  }
  this.offset += bytes;
};

WebmContainer.prototype.writeSections = function (draft?: boolean) {
  this.offset = 0;
  for (let i = 0; i < this.data.length; i++) {
    const section = this.data[i];
    const content = section.data.source;
    const contentLength = content ? content.length : 0;
    this.writeUint(section.id, draft);
    this.writeUint(contentLength, draft);
    if (!draft && content) {
      this.source.set(content, this.offset);
    }
    this.offset += contentLength;
  }
  return this.offset;
};

WebmContainer.prototype.updateByData = function () {
  const length = this.writeSections(true);
  this.source = new Uint8Array(length);
  this.writeSections(false);
};

WebmContainer.prototype.getSectionById = function (id: number) {
  for (let i = 0; i < this.data.length; i++) {
    const section = this.data[i];
    if (section.id === id) {
      return section.data;
    }
  }
  return null;
};

function WebmFile(this: any, source: Uint8Array) {
  WebmContainer.call(this, 'File', 'File');
  this.setSource(source);
}
doInherit(WebmFile, WebmContainer);

WebmFile.prototype.fixDuration = function (duration: number): boolean {
  // Segment: 0x8538067 or 0x18538067
  const segmentSection = this.getSectionById(0x8538067) || this.getSectionById(0x18538067);
  if (!segmentSection) {
    console.warn('[WebmPatcher] Segment section is missing');
    return false;
  }

  // Info section: 0x549a966 or 0x1549a966
  const infoSection = segmentSection.getSectionById(0x549a966) || segmentSection.getSectionById(0x1549a966);
  if (!infoSection) {
    console.warn('[WebmPatcher] Info section is missing');
    return false;
  }

  // TimecodeScale: 0xad7b1 or 0x2ad7b1
  let timeScaleSection = infoSection.getSectionById(0xad7b1) || infoSection.getSectionById(0x2ad7b1);
  if (!timeScaleSection) {
    timeScaleSection = new (WebmUint as any)('TimecodeScale', 'Uint');
    infoSection.data.push({
      id: 0xad7b1,
      data: timeScaleSection
    });
  }
  // 1 millisecond = 1,000,000 nanoseconds
  timeScaleSection.setValue(1000000);

  // Duration: 0x489 or 0x4489
  let durationSection = infoSection.getSectionById(0x489) || infoSection.getSectionById(0x4489);
  if (durationSection) {
    console.log(`[WebmPatcher] Overwriting existing duration (${durationSection.getValue()}ms) with actual: ${duration}ms`);
    durationSection.setValue(duration);
  } else {
    console.log(`[WebmPatcher] Adding missing duration: ${duration}ms`);
    durationSection = new (WebmFloat as any)('Duration', 'Float');
    durationSection.setValue(duration);
    infoSection.data.push({
      id: 0x489,
      data: durationSection
    });
  }

  infoSection.updateByData();
  segmentSection.updateByData();
  this.updateByData();
  return true;
};

WebmFile.prototype.toBlob = function (mimeType?: string) {
  return new Blob([this.source.buffer], { type: mimeType || 'video/webm' });
};

/**
 * Injects or forces real duration into a recorded WebM Blob.
 * Always resolves with a valid Blob (patched or original fallback).
 */
export async function patchWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  if (durationMs <= 0 || !blob || blob.size === 0) {
    return blob;
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const file = new (WebmFile as any)(new Uint8Array(arrayBuffer));
    const success = file.fixDuration(durationMs);
    if (success) {
      console.log(`[WebmPatcher] Successfully patched WebM with duration: ${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`);
      return file.toBlob(blob.type || 'video/webm');
    }
  } catch (err) {
    console.warn('[WebmPatcher] Error applying EBML duration patch, returning original blob:', err);
  }

  return blob;
}

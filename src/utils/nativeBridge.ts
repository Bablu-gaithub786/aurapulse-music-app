import { Capacitor } from '@capacitor/core';

interface NativeBridgePluginInterface {
  checkOverlayPermission: () => Promise<{ granted: boolean }>;
  requestOverlayPermission: () => Promise<{ requested?: boolean; alreadyGranted?: boolean }>;
  startSystemEdgeOverlay: (options: { preset: string; color: string; thickness: number; speed: number; mode: string }) => Promise<{ started: boolean }>;
  stopSystemEdgeOverlay: () => Promise<{ stopped: boolean }>;
  saveVideoToGallery: (options: { base64Data: string; fileName: string; mimeType: string; durationMs?: number }) => Promise<{ success: boolean; fileName: string; uri: string }>;
  saveImageToGallery: (options: { base64Data: string; fileName: string }) => Promise<{ success: boolean; fileName: string; uri: string }>;
}

const getNativeBridge = (): NativeBridgePluginInterface | null => {
  if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android') {
    return (Capacitor as any).Plugins?.NativeBridge || null;
  }
  return null;
};

export const isNativeAndroid = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

export const checkOverlayPermission = async (): Promise<boolean> => {
  const bridge = getNativeBridge();
  if (!bridge) return true; // On web browser, no system overlay permission is needed
  try {
    const res = await bridge.checkOverlayPermission();
    return !!res?.granted;
  } catch (err) {
    console.warn('Failed to check overlay permission:', err);
    return false;
  }
};

export const requestOverlayPermission = async (): Promise<boolean> => {
  const bridge = getNativeBridge();
  if (!bridge) return false;
  try {
    await bridge.requestOverlayPermission();
    return true;
  } catch (err) {
    console.warn('Failed to request overlay permission:', err);
    return false;
  }
};

export const startSystemEdgeOverlay = async (options: {
  preset?: string;
  color?: string;
  thickness?: number;
  speed?: number;
  mode?: string;
}): Promise<boolean> => {
  const bridge = getNativeBridge();
  if (!bridge) return false;
  try {
    const res = await bridge.startSystemEdgeOverlay({
      preset: options.preset || 'dynamic-rainbow',
      color: options.color || '#00f0ff',
      thickness: options.thickness || 6,
      speed: options.speed || 3,
      mode: options.mode || 'all-edges'
    });
    return !!res?.started;
  } catch (err) {
    console.error('Failed to start system edge overlay:', err);
    return false;
  }
};

export const stopSystemEdgeOverlay = async (): Promise<boolean> => {
  const bridge = getNativeBridge();
  if (!bridge) return false;
  try {
    const res = await bridge.stopSystemEdgeOverlay();
    return !!res?.stopped;
  } catch (err) {
    console.error('Failed to stop system edge overlay:', err);
    return false;
  }
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const saveVideoToDevice = async (
  videoBlob: Blob,
  fileName: string,
  rawMimeType: string = 'video/mp4',
  durationMs: number = 0
): Promise<boolean> => {
  const isWebm = (videoBlob.type && videoBlob.type.includes('webm')) || rawMimeType.includes('webm') || fileName.endsWith('.webm');
  const cleanMimeType = isWebm ? 'video/webm' : 'video/mp4';

  // Ensure fileName extension strictly matches container format
  let finalFileName = fileName;
  if (isWebm && !finalFileName.endsWith('.webm')) {
    finalFileName = finalFileName.replace(/\.[^/.]+$/, "") + '.webm';
  } else if (!isWebm && !finalFileName.endsWith('.mp4')) {
    finalFileName = finalFileName.replace(/\.[^/.]+$/, "") + '.mp4';
  }

  const bridge = getNativeBridge();
  if (bridge) {
    try {
      console.log(`Using NativeBridge to save video (${durationMs}ms, ${cleanMimeType}) directly into Android Gallery / Movies...`);
      const base64Data = await blobToBase64(videoBlob);
      const res = await bridge.saveVideoToGallery({
        base64Data,
        fileName: finalFileName,
        mimeType: cleanMimeType,
        durationMs: Math.round(durationMs)
      });
      return !!res?.success;
    } catch (err) {
      console.error('Native video save failed, falling back to download link:', err);
    }
  }

  // Web Browser fallback
  try {
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (e) {
    console.error('Web download failed:', e);
    return false;
  }
};

export const saveImageToDevice = async (
  imageDataUrlOrBlob: string | Blob,
  fileName: string
): Promise<boolean> => {
  const bridge = getNativeBridge();
  if (bridge) {
    try {
      let base64 = '';
      if (typeof imageDataUrlOrBlob === 'string') {
        base64 = imageDataUrlOrBlob;
      } else {
        base64 = await blobToBase64(imageDataUrlOrBlob);
      }
      const res = await bridge.saveImageToGallery({
        base64Data: base64,
        fileName
      });
      return !!res?.success;
    } catch (err) {
      console.error('Native image save failed:', err);
    }
  }

  // Web fallback
  try {
    const url = typeof imageDataUrlOrBlob === 'string' ? imageDataUrlOrBlob : URL.createObjectURL(imageDataUrlOrBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      if (typeof imageDataUrlOrBlob !== 'string') URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (e) {
    console.error('Web snapshot download failed:', e);
    return false;
  }
};

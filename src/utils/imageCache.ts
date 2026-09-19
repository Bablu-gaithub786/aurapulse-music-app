import { PRESET_BACKGROUNDS, PRESET_CENTERS } from '../data/images';

// Global in-memory cache of pre-decoded HTMLImageElement objects
const memoryCache = new Map<string, HTMLImageElement>();
const loadingPromises = new Map<string, Promise<HTMLImageElement>>();

/**
 * Returns a cached HTMLImageElement if already loaded and valid.
 */
export function getCachedImage(url: string | null | undefined): HTMLImageElement | null {
  if (!url) return null;
  const cached = memoryCache.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return cached;
  }
  return null;
}

/**
 * Preloads an image URL into memory and decodes it so canvas can render it with zero latency.
 */
export function preloadImage(url: string): Promise<HTMLImageElement> {
  if (!url) return Promise.reject(new Error("No URL provided"));

  const existing = memoryCache.get(url);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return Promise.resolve(existing);
  }

  const ongoing = loadingPromises.get(url);
  if (ongoing) {
    return ongoing;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      memoryCache.set(url, img);
      loadingPromises.delete(url);
      if ('decode' in img && typeof img.decode === 'function') {
        img.decode().catch(() => {}).then(() => resolve(img));
      } else {
        resolve(img);
      }
    };

    img.onerror = (err) => {
      loadingPromises.delete(url);
      reject(err);
    };

    img.src = url;
  });

  loadingPromises.set(url, promise);
  return promise;
}

/**
 * Preloads all preset backgrounds and center discs into memory upfront for instant 0ms switching.
 */
export function preloadAllPresets(): void {
  if (typeof window === 'undefined') return;

  // Preload all backgrounds
  PRESET_BACKGROUNDS.forEach((bg) => {
    preloadImage(bg.url).catch(() => {});
    if (bg.thumbnail && bg.thumbnail !== bg.url) {
      preloadImage(bg.thumbnail).catch(() => {});
    }
  });

  // Preload all center discs
  PRESET_CENTERS.forEach((cnt) => {
    preloadImage(cnt.url).catch(() => {});
    if (cnt.thumbnail && cnt.thumbnail !== cnt.url) {
      preloadImage(cnt.thumbnail).catch(() => {});
    }
  });
}

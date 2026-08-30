/**
 * Image compression utility for resizing and compressing uploaded logos, screenshots, and photos.
 * Ensures fast transfer speeds, zero CDN dependencies, and prevents payload bloat.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/webp' | 'image/png' | 'image/jpeg';
}

/**
 * Compresses an image File or Blob to a lightweight Base64 Data URL.
 */
export const compressImageFile = (
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<string> => {
  const {
    maxWidth = 320,
    maxHeight = 160,
    quality = 0.88,
    format
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        return reject(new Error('Failed to read image file.'));
      }

      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Maintain aspect ratio while scaling to fit within maxWidth / maxHeight bounds
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(rawDataUrl);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Determine best output format: PNG for transparency if available, else WebP / JPEG
        const chosenFormat = format || (file.type === 'image/png' ? 'image/png' : 'image/webp');
        
        try {
          const compressed = canvas.toDataURL(chosenFormat, quality);
          // If browser doesn't support webp export, it falls back to PNG automatically
          resolve(compressed);
        } catch {
          resolve(rawDataUrl);
        }
      };

      img.onerror = () => {
        resolve(rawDataUrl);
      };

      img.src = rawDataUrl;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

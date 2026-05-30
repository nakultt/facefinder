// src/utils/imageUtils.ts
// Image processing utilities for face recognition pipeline

/**
 * Apply CLAHE-like adaptive histogram equalization in JavaScript
 * This is a simplified version optimized for face preprocessing
 * 
 * For production, use a native OpenCV module for better performance.
 * This JS implementation is sufficient for hackathon demo (~20ms overhead).
 */
export function applyCLAHE(
  pixels: Uint8Array,
  width: number,
  height: number,
  clipLimit: number = 2.0,
  tileGridSize: number = 4
): Uint8Array {
  // Work on luminance channel only (convert RGB to grayscale for processing)
  const result = new Uint8Array(pixels.length);
  const tileWidth = Math.floor(width / tileGridSize);
  const tileHeight = Math.floor(height / tileGridSize);

  for (let ty = 0; ty < tileGridSize; ty++) {
    for (let tx = 0; tx < tileGridSize; tx++) {
      const startX = tx * tileWidth;
      const startY = ty * tileHeight;
      const endX = Math.min(startX + tileWidth, width);
      const endY = Math.min(startY + tileHeight, height);

      // Build histogram for this tile
      const histogram = new Float32Array(256);
      let pixelCount = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 3;
          // Luminance approximation: 0.299*R + 0.587*G + 0.114*B
          const lum = Math.round(
            0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]
          );
          histogram[lum]++;
          pixelCount++;
        }
      }

      // Clip histogram
      const clipThreshold = (clipLimit * pixelCount) / 256;
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (histogram[i] > clipThreshold) {
          excess += histogram[i] - clipThreshold;
          histogram[i] = clipThreshold;
        }
      }

      // Redistribute excess
      const increment = excess / 256;
      for (let i = 0; i < 256; i++) {
        histogram[i] += increment;
      }

      // Build CDF (cumulative distribution function)
      const cdf = new Float32Array(256);
      cdf[0] = histogram[0];
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
      }

      // Normalize CDF to [0, 255]
      const cdfMin = cdf[0];
      const cdfMax = cdf[255];
      const scale = cdfMax - cdfMin > 0 ? 255 / (cdfMax - cdfMin) : 0;

      // Apply equalization
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 3;
          for (let c = 0; c < 3; c++) {
            const val = pixels[idx + c];
            result[idx + c] = Math.round(
              Math.max(0, Math.min(255, (cdf[val] - cdfMin) * scale))
            );
          }
        }
      }
    }
  }

  return result;
}

/**
 * Apply adaptive gamma correction based on mean luminance
 */
export function adaptiveGamma(
  pixels: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  // Compute mean luminance
  let sumLum = 0;
  const totalPixels = width * height;

  for (let i = 0; i < pixels.length; i += 3) {
    sumLum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  }

  const meanLum = sumLum / totalPixels;

  // Determine gamma
  let gamma = 1.0;
  if (meanLum < 80) {
    gamma = 0.6; // Brighten dark images
  } else if (meanLum > 180) {
    gamma = 1.4; // Darken bright images
  } else {
    return pixels; // No correction needed
  }

  // Build lookup table
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(255 * Math.pow(i / 255, gamma));
  }

  // Apply
  const result = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    result[i] = lut[pixels[i]];
  }

  return result;
}

/**
 * Normalize pixel values to [-1, 1] range for MobileFaceNet input
 */
export function normalizeForMobileFaceNet(
  pixels: Uint8Array
): Float32Array {
  const normalized = new Float32Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    normalized[i] = (pixels[i] / 255.0 - 0.5) / 0.5; // maps [0,255] to [-1,1]
  }
  return normalized;
}

/**
 * Resize image using bilinear interpolation
 */
export function resizeImage(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  channels: number = 3
): Uint8Array {
  const dst = new Uint8Array(dstWidth * dstHeight * channels);

  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = x * xRatio;
      const srcY = y * yRatio;

      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcWidth - 1);
      const y1 = Math.min(y0 + 1, srcHeight - 1);

      const xFrac = srcX - x0;
      const yFrac = srcY - y0;

      for (let c = 0; c < channels; c++) {
        const topLeft = src[(y0 * srcWidth + x0) * channels + c];
        const topRight = src[(y0 * srcWidth + x1) * channels + c];
        const bottomLeft = src[(y1 * srcWidth + x0) * channels + c];
        const bottomRight = src[(y1 * srcWidth + x1) * channels + c];

        const top = topLeft + (topRight - topLeft) * xFrac;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * xFrac;
        const value = top + (bottom - top) * yFrac;

        dst[(y * dstWidth + x) * channels + c] = Math.round(value);
      }
    }
  }

  return dst;
}

/**
 * Crop a region from an image
 */
export function cropImage(
  src: Uint8Array,
  srcWidth: number,
  _srcHeight: number,
  x: number,
  y: number,
  cropWidth: number,
  cropHeight: number,
  channels: number = 3
): Uint8Array {
  const dst = new Uint8Array(cropWidth * cropHeight * channels);

  for (let dy = 0; dy < cropHeight; dy++) {
    for (let dx = 0; dx < cropWidth; dx++) {
      const srcIdx = ((y + dy) * srcWidth + (x + dx)) * channels;
      const dstIdx = (dy * cropWidth + dx) * channels;

      for (let c = 0; c < channels; c++) {
        dst[dstIdx + c] = src[srcIdx + c] || 0;
      }
    }
  }

  return dst;
}

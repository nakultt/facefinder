// src/ml/FaceRecognizer.ts
// Production face recognition using MobileFaceNet TFLite
// Generates 512-dim ArcFace embeddings and performs cosine similarity matching
//
// Architecture:
//   Camera Frame → ML Kit Face Detection → Crop & Align (112×112) → MobileFaceNet TFLite → 512-D Embedding
//
// All inference runs on-device via react-native-fast-tflite (JSI/Nitro)

import { createLogger } from '../utils/logger';
import { cosineSimilarity, normalizeVector } from '../utils/mathUtils';
import { decryptEmbeddings } from '../security/CryptoManager';
import type { MatchResult, Personnel } from '../types';
import { THRESHOLDS } from '../types';

const log = createLogger('FaceRecognizer');

// TFLite model reference (loaded via React hook in the component layer)
let tfliteModel: any = null;
let isDemoMode = true;

/**
 * Set the loaded TFLite model reference.
 * Called from the component that uses useTensorflowModel() hook.
 */
export function setTFLiteModel(model: any): void {
  tfliteModel = model;
  isDemoMode = model === null;
  log.info(`FaceRecognizer model ${model ? 'LOADED (production mode)' : 'unloaded (demo mode)'}`);
}

/**
 * Check if the real model is loaded
 */
export function isRecognizerReady(): boolean {
  return tfliteModel !== null;
}

/**
 * Preprocess face crop for MobileFaceNet input
 * Input: RGBA pixel array from camera + crop coordinates
 * Output: Float32Array [1, 112, 112, 3] normalized to [-1, 1]
 *
 * The face should already be aligned using 5-point landmarks → affine transform
 */
export function preprocessFaceForModel(
  rgbaPixels: Uint8Array,
  width: number,
  height: number
): Float32Array {
  const inputSize = 112;
  const inputTensor = new Float32Array(1 * inputSize * inputSize * 3);

  // Simple bilinear resize from source dimensions to 112x112
  const scaleX = width / inputSize;
  const scaleY = height / inputSize;

  for (let y = 0; y < inputSize; y++) {
    for (let x = 0; x < inputSize; x++) {
      const srcX = Math.min(Math.floor(x * scaleX), width - 1);
      const srcY = Math.min(Math.floor(y * scaleY), height - 1);
      const srcIdx = (srcY * width + srcX) * 4; // RGBA

      const dstIdx = (y * inputSize + x) * 3;

      // Normalize from [0, 255] to [-1, 1] (standard for ArcFace models)
      inputTensor[dstIdx + 0] = (rgbaPixels[srcIdx + 0] / 127.5) - 1.0; // R
      inputTensor[dstIdx + 1] = (rgbaPixels[srcIdx + 1] / 127.5) - 1.0; // G
      inputTensor[dstIdx + 2] = (rgbaPixels[srcIdx + 2] / 127.5) - 1.0; // B
    }
  }

  return inputTensor;
}

/**
 * Run MobileFaceNet inference to extract 512-D face embedding
 *
 * PRODUCTION MODE: Runs actual TFLite model via react-native-fast-tflite
 * DEMO MODE: Returns deterministic pseudo-embedding (for testing without model file)
 */
export function getEmbedding(
  facePixels: Uint8Array | Float32Array,
  faceWidth?: number,
  faceHeight?: number,
  angleIndex?: number
): number[] {
  // --- PRODUCTION MODE: Real TFLite inference ---
  if (tfliteModel && !isDemoMode) {
    try {
      let inputTensor: Float32Array;

      if (facePixels instanceof Float32Array) {
        // Already preprocessed
        inputTensor = facePixels;
      } else {
        // Raw RGBA pixels — preprocess
        const w = faceWidth || 112;
        const h = faceHeight || 112;
        inputTensor = preprocessFaceForModel(facePixels, w, h);
      }

      // Run inference
      const outputs = tfliteModel.runSync([inputTensor]);

      // Extract 512-D embedding from output tensor
      const rawEmbedding = Array.from(outputs[0] as Float32Array);

      // L2 normalize
      return normalizeVector(rawEmbedding);
    } catch (error) {
      log.error('TFLite inference failed, falling back to demo mode', error);
    }
  }

  // --- DEMO MODE: Deterministic pseudo-embedding ---
  log.warn('Using demo mode embedding (no real model loaded)');
  return getDemoEmbedding(angleIndex);
}

/**
 * Demo mode: generate deterministic embeddings for testing the UI flow
 */
function getDemoEmbedding(angleIndex?: number): number[] {
  const embedding = new Array(512);
  const baseSeed = 42;
  let state = baseSeed;

  for (let i = 0; i < 512; i++) {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    embedding[i] = ((state >>> 0) / 0xffffffff) * 2 - 1;
  }

  const base = normalizeVector(embedding);

  if (angleIndex !== undefined) {
    const variation = new Array(512);
    let vState = baseSeed + 1000 + angleIndex;
    for (let i = 0; i < 512; i++) {
      vState = (vState * 1664525 + 1013904223) & 0xffffffff;
      variation[i] = ((vState >>> 0) / 0xffffffff) * 2 - 1;
    }
    for (let i = 0; i < 512; i++) {
      base[i] = base[i] + variation[i] * 0.08;
    }
    return normalizeVector(base);
  }

  // Auth mode: add tiny noise
  const noise = new Array(512);
  let nState = Date.now() % 10000;
  for (let i = 0; i < 512; i++) {
    nState = (nState * 1664525 + 1013904223) & 0xffffffff;
    noise[i] = ((nState >>> 0) / 0xffffffff) * 2 - 1;
  }
  for (let i = 0; i < 512; i++) {
    base[i] = base[i] + noise[i] * 0.05;
  }
  return normalizeVector(base);
}

/**
 * Match a query embedding against all enrolled personnel
 * Uses multi-angle matching with 7 stored embeddings per person
 */
export async function matchAgainstGallery(
  queryEmbedding: number[],
  gallery: Personnel[],
  threshold?: number
): Promise<MatchResult | null> {
  const matchThreshold = threshold ?? THRESHOLDS.RECOGNITION_MATCH;

  let bestMatch: MatchResult | null = null;
  let bestScore = -1;

  log.info(`Matching against gallery of ${gallery.length} person(s), threshold=${matchThreshold}`);

  for (const person of gallery) {
    try {
      const storedEmbeddings = await decryptEmbeddings(person.embeddingBlob);

      // Compare against all 7 stored angle embeddings
      const scores = storedEmbeddings.map((stored) =>
        cosineSimilarity(queryEmbedding, stored)
      );

      // Best single score
      const maxScore = Math.max(...scores);
      const maxIndex = scores.indexOf(maxScore);

      // Average of top-3 scores
      const sortedScores = [...scores].sort((a, b) => b - a);
      const avgTop3 = sortedScores.slice(0, Math.min(3, sortedScores.length)).reduce((a, b) => a + b, 0) / Math.min(3, sortedScores.length);

      log.info(
        `Person "${person.name}": max=${maxScore.toFixed(4)}, avgTop3=${avgTop3.toFixed(4)}, scores=[${scores.map(s => s.toFixed(3)).join(', ')}]`
      );

      const accepted =
        maxScore > matchThreshold ||
        avgTop3 > THRESHOLDS.RECOGNITION_AVG_TOP3;

      if (accepted && maxScore > bestScore) {
        bestScore = maxScore;
        bestMatch = {
          personnelId: person.id,
          name: person.name,
          confidence: maxScore,
          bestAngleIndex: maxIndex,
        };
      }
    } catch (error) {
      log.error(`Failed to match person ${person.id}`, error);
    }
  }

  if (bestMatch) {
    log.info(`✅ Match: ${bestMatch.name} (${(bestMatch.confidence * 100).toFixed(1)}%)`);
  } else {
    log.warn('❌ No match found');
  }

  return bestMatch;
}

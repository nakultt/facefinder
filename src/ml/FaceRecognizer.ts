// src/ml/FaceRecognizer.ts
// MobileFaceNet face recognition wrapper
// Generates 512-dim face embeddings and performs matching

import { createLogger } from '../utils/logger';
import { cosineSimilarity, normalizeVector } from '../utils/mathUtils';
import type { MatchResult, Personnel } from '../types';
import { THRESHOLDS } from '../types';
import { decryptEmbeddings } from '../security/CryptoManager';

const log = createLogger('FaceRecognizer');

let isModelLoaded = false;

/**
 * Initialize the MobileFaceNet recognizer
 */
export async function initFaceRecognizer(): Promise<boolean> {
  try {
    log.info('Initializing MobileFaceNet recognizer...');
    // In production: load via useTensorflowModel(require('../assets/models/mobilefacenet.tflite'))
    isModelLoaded = true;
    log.info('Face recognizer ready (simulation mode)');
    return true;
  } catch (error) {
    log.error('Failed to initialize face recognizer', error);
    return false;
  }
}

/**
 * Extract 512-dim face embedding from aligned face image
 * In production: runs MobileFaceNet TFLite inference
 * In demo: generates a deterministic pseudo-embedding based on pixel data
 */
export function getEmbedding(_alignedFacePixels: Uint8Array | Float32Array): number[] {
  if (!isModelLoaded) {
    log.warn('Face recognizer not loaded');
    return new Array(512).fill(0);
  }

  // Generate a pseudo-embedding for demo purposes
  // In production: run MobileFaceNet inference and return the 512-dim output tensor
  const embedding = new Array(512);
  
  // Use pixel data to create a somewhat unique embedding
  const pixels = _alignedFacePixels;
  for (let i = 0; i < 512; i++) {
    // Sample from different parts of the image to create a fingerprint
    const idx = (i * 73 + 17) % pixels.length;
    const val = pixels[idx] !== undefined ? pixels[idx] : Math.random();
    embedding[i] = (val / 255.0) * 2 - 1; // normalize to [-1, 1]
  }

  return normalizeVector(embedding);
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

  for (const person of gallery) {
    try {
      // Decrypt the stored embeddings (7 angles)
      const storedEmbeddings = await decryptEmbeddings(person.embeddingBlob);

      // Compare query against all 7 stored embeddings
      const scores = storedEmbeddings.map((stored) =>
        cosineSimilarity(queryEmbedding, stored)
      );

      // Strategy 1: MAX score > threshold
      const maxScore = Math.max(...scores);
      const maxIndex = scores.indexOf(maxScore);

      // Strategy 2: AVERAGE of top-3 scores > lower threshold
      const sortedScores = [...scores].sort((a, b) => b - a);
      const avgTop3 =
        sortedScores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;

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
      log.error(`Failed to match against person ${person.id}`, error);
    }
  }

  if (bestMatch) {
    log.info(
      `Match found: ${bestMatch.name} (confidence: ${bestMatch.confidence.toFixed(3)})`
    );
  }

  return bestMatch;
}

/**
 * Check if recognizer is ready
 */
export function isRecognizerReady(): boolean {
  return isModelLoaded;
}

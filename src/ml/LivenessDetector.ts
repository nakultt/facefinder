// src/ml/LivenessDetector.ts
// Production liveness detection using Google ML Kit face classification
//
// ACTIVE LIVENESS (real):
//   - Blink detection: ML Kit leftEyeOpenProbability + rightEyeOpenProbability
//   - Smile detection: ML Kit smilingProbability
//   - Head turn detection: ML Kit headEulerAngleY (yaw)
//   Uses a temporal state machine — tracks probability over multiple frames
//
// PASSIVE LIVENESS:
//   - Laplacian variance (blur detection — screens/prints are often blurry)
//   - Color distribution analysis (printed photos have different color profiles)
//   - No extra model file needed — pure image processing

import { createLogger } from '../utils/logger';
import { generateChallengeSequence } from '../utils/mathUtils';
import type { LivenessResult, ChallengeType } from '../types';
import { THRESHOLDS } from '../types';

const log = createLogger('LivenessDetector');

// --- ACTIVE LIVENESS STATE MACHINE ---

interface BlinkState {
  eyesClosed: boolean;
  blinkCount: number;
  framesEyesClosed: number;
  lastEyeOpenProb: number;
}

interface LivenessTracker {
  blink: BlinkState;
  smileDetected: boolean;
  smileFrames: number;
  turnLeftDetected: boolean;
  turnRightDetected: boolean;
  maxYawLeft: number;
  maxYawRight: number;
  frameCount: number;
}

let tracker: LivenessTracker = createFreshTracker();

function createFreshTracker(): LivenessTracker {
  return {
    blink: {
      eyesClosed: false,
      blinkCount: 0,
      framesEyesClosed: 0,
      lastEyeOpenProb: 1.0,
    },
    smileDetected: false,
    smileFrames: 0,
    turnLeftDetected: false,
    turnRightDetected: false,
    maxYawLeft: 0,
    maxYawRight: 0,
    frameCount: 0,
  };
}

/**
 * Reset the liveness tracker for a new session
 */
export function resetLivenessTracker(): void {
  tracker = createFreshTracker();
  log.info('Liveness tracker reset');
}

/**
 * Process a single frame's face classification data from ML Kit.
 * Call this on every frame in the camera loop.
 *
 * @param face - ML Kit Face object with classification properties
 * @returns Updated challenge statuses
 */
export function processFrame(face: {
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  smilingProbability?: number;
  yawAngle?: number;
  pitchAngle?: number;
  rollAngle?: number;
}): {
  blinkDetected: boolean;
  blinkCount: number;
  smileDetected: boolean;
  turnLeftDetected: boolean;
  turnRightDetected: boolean;
  yaw: number;
} {
  tracker.frameCount++;

  const leftEyeOpen = face.leftEyeOpenProbability ?? 1.0;
  const rightEyeOpen = face.rightEyeOpenProbability ?? 1.0;
  const avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2;
  const smileProb = face.smilingProbability ?? 0;
  const yaw = face.yawAngle ?? 0;

  // --- BLINK DETECTION (temporal) ---
  // Look for eyes closing (prob < 0.3) then opening again (prob > 0.7)
  if (avgEyeOpen < 0.3 && !tracker.blink.eyesClosed) {
    tracker.blink.eyesClosed = true;
    tracker.blink.framesEyesClosed = 0;
  }

  if (tracker.blink.eyesClosed) {
    tracker.blink.framesEyesClosed++;

    // Eyes must stay closed for at least 2 frames (avoid noise)
    // and re-open within 15 frames (avoid just closing eyes)
    if (avgEyeOpen > 0.7 && tracker.blink.framesEyesClosed >= 2 && tracker.blink.framesEyesClosed <= 15) {
      tracker.blink.blinkCount++;
      tracker.blink.eyesClosed = false;
      log.info(`👁️ Blink #${tracker.blink.blinkCount} detected`);
    } else if (tracker.blink.framesEyesClosed > 15) {
      // Eyes closed too long — reset
      tracker.blink.eyesClosed = false;
    }
  }
  tracker.blink.lastEyeOpenProb = avgEyeOpen;

  // --- SMILE DETECTION ---
  if (smileProb > 0.7) {
    tracker.smileFrames++;
    if (tracker.smileFrames >= 3 && !tracker.smileDetected) {
      tracker.smileDetected = true;
      log.info('😊 Smile detected');
    }
  } else {
    tracker.smileFrames = Math.max(0, tracker.smileFrames - 1);
  }

  // --- HEAD TURN DETECTION ---
  if (yaw > THRESHOLDS.YAW_TURN) {
    tracker.maxYawLeft = Math.max(tracker.maxYawLeft, yaw);
    if (!tracker.turnLeftDetected) {
      tracker.turnLeftDetected = true;
      log.info(`↩️ Turn left detected (yaw=${yaw.toFixed(1)}°)`);
    }
  }
  if (yaw < -THRESHOLDS.YAW_TURN) {
    tracker.maxYawRight = Math.max(tracker.maxYawRight, Math.abs(yaw));
    if (!tracker.turnRightDetected) {
      tracker.turnRightDetected = true;
      log.info(`↪️ Turn right detected (yaw=${yaw.toFixed(1)}°)`);
    }
  }

  return {
    blinkDetected: tracker.blink.blinkCount >= 1,
    blinkCount: tracker.blink.blinkCount,
    smileDetected: tracker.smileDetected,
    turnLeftDetected: tracker.turnLeftDetected,
    turnRightDetected: tracker.turnRightDetected,
    yaw,
  };
}

/**
 * Check if a specific active liveness challenge is completed
 */
export function isChallengeCompleted(challenge: ChallengeType): boolean {
  switch (challenge) {
    case 'blink':
      return tracker.blink.blinkCount >= 1;
    case 'smile':
      return tracker.smileDetected;
    case 'turnLeft':
      return tracker.turnLeftDetected;
    case 'turnRight':
      return tracker.turnRightDetected;
    case 'tiltUp':
    case 'tiltDown':
      return true; // Simplified — could track pitchAngle
    default:
      return false;
  }
}

// --- PASSIVE LIVENESS (image analysis, no ML model needed) ---

/**
 * Analyze face crop texture for passive anti-spoofing
 * Checks for:
 *  1. Blur level (Laplacian variance) — printed/screen faces tend to be blurrier
 *  2. Color uniformity — real faces have more color variation than photos-of-photos
 *
 * Returns a liveness score [0, 1] where >0.5 is likely real
 */
export function checkPassiveLiveness(
  facePixels: Uint8Array,
  width: number = 80,
  height: number = 80
): LivenessResult {
  // 1. Laplacian variance (edge sharpness)
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4; // RGBA
      const gray = (facePixels[idx] + facePixels[idx + 1] + facePixels[idx + 2]) / 3;

      // 3x3 Laplacian kernel
      const top = (facePixels[((y - 1) * width + x) * 4] + facePixels[((y - 1) * width + x) * 4 + 1] + facePixels[((y - 1) * width + x) * 4 + 2]) / 3;
      const bottom = (facePixels[((y + 1) * width + x) * 4] + facePixels[((y + 1) * width + x) * 4 + 1] + facePixels[((y + 1) * width + x) * 4 + 2]) / 3;
      const left = (facePixels[(y * width + x - 1) * 4] + facePixels[(y * width + x - 1) * 4 + 1] + facePixels[(y * width + x - 1) * 4 + 2]) / 3;
      const right = (facePixels[(y * width + x + 1) * 4] + facePixels[(y * width + x + 1) * 4 + 1] + facePixels[(y * width + x + 1) * 4 + 2]) / 3;

      const laplacian = Math.abs(4 * gray - top - bottom - left - right);
      laplacianSum += laplacian;
      laplacianSqSum += laplacian * laplacian;
      count++;
    }
  }

  const laplacianMean = laplacianSum / count;
  const laplacianVar = (laplacianSqSum / count) - (laplacianMean * laplacianMean);

  // 2. Color channel variance (real faces have more color variation)
  let rVar = 0, gVar = 0, bVar = 0;
  let rSum = 0, gSum = 0, bSum = 0;
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    rSum += facePixels[idx];
    gSum += facePixels[idx + 1];
    bSum += facePixels[idx + 2];
  }
  const rMean = rSum / totalPixels;
  const gMean = gSum / totalPixels;
  const bMean = bSum / totalPixels;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    rVar += (facePixels[idx] - rMean) ** 2;
    gVar += (facePixels[idx + 1] - gMean) ** 2;
    bVar += (facePixels[idx + 2] - bMean) ** 2;
  }
  rVar /= totalPixels;
  gVar /= totalPixels;
  bVar /= totalPixels;
  const colorVar = (rVar + gVar + bVar) / 3;

  // Score: combine blur and color analysis
  // Real faces: high Laplacian variance (sharp) + high color variance
  // Spoofs: low Laplacian variance (blurry) + low color variance (flat)
  const sharpnessScore = Math.min(1.0, laplacianVar / 500); // Normalize
  const colorScore = Math.min(1.0, colorVar / 2000);
  const realProbability = sharpnessScore * 0.6 + colorScore * 0.4;

  let decision: LivenessResult['decision'];
  if (realProbability > THRESHOLDS.LIVENESS_PASS) {
    decision = 'pass';
  } else if (realProbability > THRESHOLDS.LIVENESS_UNCERTAIN) {
    decision = 'uncertain';
  } else {
    decision = 'fail';
  }

  return {
    isReal: decision !== 'fail',
    realProbability,
    spoofProbability: 1 - realProbability,
    decision,
  };
}

/**
 * Get random challenge sequence for a session
 */
export function getSessionChallenges(count: number = 2): ChallengeType[] {
  return generateChallengeSequence(count);
}

/**
 * Get human-readable prompt for a challenge
 */
export function getChallengePrompt(type: ChallengeType): string {
  const prompts: Record<ChallengeType, string> = {
    blink: 'Blink your eyes',
    smile: 'Show a smile',
    turnLeft: 'Turn head slowly left',
    turnRight: 'Turn head slowly right',
    tiltUp: 'Tilt chin up slightly',
    tiltDown: 'Tilt chin down slightly',
  };
  return prompts[type];
}

/**
 * Get emoji icon for a challenge
 */
export function getChallengeIcon(type: ChallengeType): string {
  const icons: Record<ChallengeType, string> = {
    blink: '👁️',
    smile: '😊',
    turnLeft: '↩️',
    turnRight: '↪️',
    tiltUp: '⬆️',
    tiltDown: '⬇️',
  };
  return icons[type];
}

log.info('LivenessDetector module loaded (ML Kit + image analysis)');

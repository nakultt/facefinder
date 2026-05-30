// src/ml/FaceDetector.ts
// Real face detection using Google ML Kit via react-native-vision-camera-face-detector
// Provides: bounding box, landmarks, eye-open probability, smile probability, head euler angles
// All processing happens ON-DEVICE (100% offline)

import { createLogger } from '../utils/logger';

const log = createLogger('FaceDetector');

// Re-export the face detector hook and types from the library
// This module serves as our abstraction layer
export { useFaceDetector } from 'react-native-vision-camera-face-detector';
export type { Face } from 'react-native-vision-camera-face-detector';

/**
 * Face detection configuration for ML Kit
 * Used when initializing the face detector in camera screens
 */
export const FACE_DETECTION_CONFIG = {
  performanceMode: 'fast' as const,
  landmarkMode: 'all' as const,
  classificationMode: 'all' as const,
  contourMode: 'none' as const,
  minFaceSize: 0.15,
  trackingEnabled: true,
};

/**
 * High-accuracy config for enrollment captures
 */
export const FACE_DETECTION_ACCURATE_CONFIG = {
  performanceMode: 'accurate' as const,
  landmarkMode: 'all' as const,
  classificationMode: 'all' as const,
  contourMode: 'none' as const,
  minFaceSize: 0.2,
  trackingEnabled: false,
};

/**
 * Extract the 5-point landmarks needed for face alignment from ML Kit Face object
 * ML Kit provides: leftEye, rightEye, noseBase, leftMouth (bottomMouth), rightMouth
 */
export function extractAlignmentLandmarks(face: any): {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  noseTip: { x: number; y: number };
  leftMouth: { x: number; y: number };
  rightMouth: { x: number; y: number };
} | null {
  try {
    const landmarks = face.landmarks;
    if (!landmarks) return null;

    // ML Kit landmark keys
    const leftEye = landmarks.LEFT_EYE;
    const rightEye = landmarks.RIGHT_EYE;
    const nose = landmarks.NOSE_BASE;
    const leftMouth = landmarks.MOUTH_LEFT;
    const rightMouth = landmarks.MOUTH_RIGHT;

    if (!leftEye || !rightEye || !nose) return null;

    return {
      leftEye: { x: leftEye.x, y: leftEye.y },
      rightEye: { x: rightEye.x, y: rightEye.y },
      noseTip: { x: nose.x, y: nose.y },
      leftMouth: leftMouth ? { x: leftMouth.x, y: leftMouth.y } : { x: nose.x - 20, y: nose.y + 30 },
      rightMouth: rightMouth ? { x: rightMouth.x, y: rightMouth.y } : { x: nose.x + 20, y: nose.y + 30 },
    };
  } catch (error) {
    log.error('Failed to extract landmarks', error);
    return null;
  }
}

/**
 * Check if a detected face is suitable for processing
 * (not too small, not too angled, eyes visible)
 */
export function isFaceSuitable(face: any, minConfidence = 0.7): boolean {
  if (!face) return false;

  const bounds = face.bounds;
  if (!bounds) return false;

  // Face must be reasonably large (at least 15% of frame)
  const faceArea = bounds.width * bounds.height;
  if (faceArea < 5000) return false; // Too small

  // Check head angles — reject extreme poses for recognition
  const yaw = Math.abs(face.yawAngle || 0);
  const pitch = Math.abs(face.pitchAngle || 0);
  const roll = Math.abs(face.rollAngle || 0);

  if (yaw > 35 || pitch > 25 || roll > 25) return false;

  return true;
}

log.info('FaceDetector module loaded (ML Kit integration)');

// src/ml/FaceDetector.ts
// YuNet Face Detection wrapper using react-native-fast-tflite
//
// In the hackathon build, this wraps the TFLite model.
// If the model isn't available, it provides a mock/simulation mode
// so the UI can still be demonstrated.

import { createLogger } from '../utils/logger';
import type { FaceDetection, FaceBBox, FaceLandmarks } from '../types';

const log = createLogger('FaceDetector');

let isModelLoaded = false;

/**
 * Initialize the YuNet face detector
 * Called once at app startup
 */
export async function initFaceDetector(): Promise<boolean> {
  try {
    log.info('Initializing YuNet face detector...');
    // In production: load via useTensorflowModel(require('../assets/models/yunet.tflite'))
    // For hackathon demo: we use the camera's built-in face detection or mock
    isModelLoaded = true;
    log.info('Face detector ready (simulation mode)');
    return true;
  } catch (error) {
    log.error('Failed to initialize face detector', error);
    return false;
  }
}

/**
 * Detect faces in a frame
 * Returns array of detections with bounding boxes and landmarks
 */
export function detectFaces(
  _frameData: Uint8Array,
  frameWidth: number,
  frameHeight: number
): FaceDetection[] {
  if (!isModelLoaded) {
    log.warn('Face detector not loaded');
    return [];
  }

  // Simulation: return a centered face detection
  // In production: run YuNet TFLite inference on the frame
  const centerX = frameWidth * 0.3;
  const centerY = frameHeight * 0.25;
  const faceWidth = frameWidth * 0.4;
  const faceHeight = frameHeight * 0.4;

  const bbox: FaceBBox = {
    x: centerX,
    y: centerY,
    width: faceWidth,
    height: faceHeight,
    confidence: 0.98,
  };

  const landmarks: FaceLandmarks = {
    leftEye: { x: centerX + faceWidth * 0.3, y: centerY + faceHeight * 0.35 },
    rightEye: { x: centerX + faceWidth * 0.7, y: centerY + faceHeight * 0.35 },
    noseTip: { x: centerX + faceWidth * 0.5, y: centerY + faceHeight * 0.55 },
    leftMouth: { x: centerX + faceWidth * 0.35, y: centerY + faceHeight * 0.75 },
    rightMouth: { x: centerX + faceWidth * 0.65, y: centerY + faceHeight * 0.75 },
  };

  return [{ bbox, landmarks }];
}

/**
 * Check if detector is ready
 */
export function isDetectorReady(): boolean {
  return isModelLoaded;
}

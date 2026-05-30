// src/types/index.ts
// Core type definitions for FaceFort

/** Bounding box from face detection */
export interface FaceBBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/** 5 facial landmarks from YuNet */
export interface FaceLandmarks {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  noseTip: { x: number; y: number };
  leftMouth: { x: number; y: number };
  rightMouth: { x: number; y: number };
}

/** Face detection result */
export interface FaceDetection {
  bbox: FaceBBox;
  landmarks: FaceLandmarks;
}

/** Face embedding (512-dim float vector) */
export type FaceEmbedding = number[];

/** Result of embedding match */
export interface MatchResult {
  personnelId: string;
  name: string;
  confidence: number;
  bestAngleIndex: number;
}

/** Passive liveness check result */
export interface LivenessResult {
  isReal: boolean;
  realProbability: number;
  spoofProbability: number;
  /** 'pass' | 'uncertain' | 'fail' */
  decision: 'pass' | 'uncertain' | 'fail';
}

/** Active liveness challenge types */
export type ChallengeType = 'blink' | 'smile' | 'turnLeft' | 'turnRight' | 'tiltUp' | 'tiltDown';

/** Active challenge state */
export interface ChallengeState {
  type: ChallengeType;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'timeout';
  startedAt?: number;
  completedAt?: number;
  timeoutMs: number;
}

/** Enrollment angle prompts */
export type EnrollmentAngle =
  | 'straight'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'bright'
  | 'shadow';

export interface EnrollmentStep {
  angle: EnrollmentAngle;
  prompt: string;
  instruction: string;
  icon: string;
  captured: boolean;
  embedding?: FaceEmbedding;
}

/** Personnel record in database */
export interface Personnel {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  enrolledAt: number;
  /** Base64 encoded, AES-256-GCM encrypted embeddings (7 angles) */
  embeddingBlob: string;
  embeddingVersion: number;
  enrollmentImageHash: string;
  isActive: boolean;
  syncedToCloud: boolean;
}

/** Attendance log record */
export interface AttendanceLog {
  id: string;
  personnelId: string;
  timestamp: number;
  confidenceScore: number;
  livenessScore: number;
  locationLat: number | null;
  locationLng: number | null;
  deviceId: string;
  /** HMAC-SHA256 of (personnelId + timestamp + deviceId) */
  logHash: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  rawImagePath: string | null;
}

/** Sync queue record */
export interface SyncQueueItem {
  id: string;
  recordType: 'attendance' | 'enrollment';
  recordId: string;
  payloadJson: string;
  createdAt: number;
  retryCount: number;
  lastAttempt: number | null;
}

/** App-wide recognition thresholds */
export const THRESHOLDS = {
  /** Minimum cosine similarity for a positive match */
  RECOGNITION_MATCH: 0.65,
  /** Average of top-3 angle scores for acceptance */
  RECOGNITION_AVG_TOP3: 0.60,
  /** Passive liveness: definitely real */
  LIVENESS_PASS: 0.85,
  /** Passive liveness: uncertain, trigger active challenge */
  LIVENESS_UNCERTAIN: 0.60,
  /** Eye Aspect Ratio threshold for blink detection */
  EAR_BLINK: 0.20,
  /** Mouth Aspect Ratio threshold for smile detection */
  MAR_SMILE: 0.15,
  /** Head yaw threshold for turn detection (degrees) */
  YAW_TURN: 20,
  /** Max failed auth attempts before lockout */
  MAX_FAILED_ATTEMPTS: 3,
  /** Lockout duration in ms (30 seconds) */
  LOCKOUT_DURATION_MS: 30_000,
} as const;

/** Model file metadata */
export const MODEL_INFO = {
  yunet: {
    name: 'YuNet Face Detector',
    file: 'face_detection_yunet_2023mar.onnx',
    sizeMB: 0.33,
    inputSize: { width: 160, height: 160 },
  },
  mobilefacenet: {
    name: 'MobileFaceNet (ArcFace)',
    file: 'mobilefacenet.tflite',
    sizeMB: 4.1,
    inputSize: { width: 112, height: 112 },
  },
  silentFAS: {
    name: 'SilentFAS Passive Liveness',
    file: 'silent_fas.tflite',
    sizeMB: 2.4,
    inputSize: { width: 80, height: 80 },
  },
  faceLandmarker: {
    name: 'MediaPipe FaceLandmarker',
    file: 'face_landmarker.task',
    sizeMB: 3.5,
  },
} as const;

/** Enrollment angle steps configuration */
export const ENROLLMENT_STEPS: EnrollmentStep[] = [
  {
    angle: 'straight',
    prompt: 'Look Straight',
    instruction: 'Hold your phone at eye level and look directly at the camera',
    icon: '🎯',
    captured: false,
  },
  {
    angle: 'left',
    prompt: 'Turn Left',
    instruction: 'Slowly turn your head slightly to the left',
    icon: '⬅️',
    captured: false,
  },
  {
    angle: 'right',
    prompt: 'Turn Right',
    instruction: 'Slowly turn your head slightly to the right',
    icon: '➡️',
    captured: false,
  },
  {
    angle: 'up',
    prompt: 'Tilt Up',
    instruction: 'Tilt your chin up slightly',
    icon: '⬆️',
    captured: false,
  },
  {
    angle: 'down',
    prompt: 'Tilt Down',
    instruction: 'Tilt your chin down slightly',
    icon: '⬇️',
    captured: false,
  },
  {
    angle: 'bright',
    prompt: 'Well Lit',
    instruction: 'Make sure your face is well lit (face a light source)',
    icon: '☀️',
    captured: false,
  },
  {
    angle: 'shadow',
    prompt: 'Low Light',
    instruction: 'Cover part of the light to create a shadow effect',
    icon: '🌙',
    captured: false,
  },
];

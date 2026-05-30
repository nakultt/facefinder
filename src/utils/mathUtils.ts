// src/utils/mathUtils.ts
// Vector math helpers for face recognition

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Compute L2 (Euclidean) distance between two vectors
 */
export function l2Distance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length (L2 norm)
 */
export function normalizeVector(v: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm);

  if (norm === 0) return v;

  return v.map((x) => x / norm);
}

/**
 * Compute 2D affine transformation matrix from source to destination points
 * Used for face alignment from detected landmarks to canonical face template
 */
export function computeAffineTransform(
  srcPoints: [number, number][],
  dstPoints: [number, number][]
): number[][] {
  // Solve for 2x3 affine matrix using least squares
  // [x'] = [a b c] [x]
  // [y']   [d e f] [y]
  //                [1]

  const n = srcPoints.length;
  if (n < 3) throw new Error('Need at least 3 point pairs');

  // Build system of equations
  const A: number[][] = [];
  const bx: number[] = [];
  const by: number[] = [];

  for (let i = 0; i < n; i++) {
    A.push([srcPoints[i][0], srcPoints[i][1], 1]);
    bx.push(dstPoints[i][0]);
    by.push(dstPoints[i][1]);
  }

  // Solve using pseudo-inverse (A^T * A)^-1 * A^T * b
  const AtA = matMul(transpose(A), A);
  const AtAInv = invert3x3(AtA);
  const Atbx = matVecMul(transpose(A), bx);
  const Atby = matVecMul(transpose(A), by);

  const paramX = matVecMul(AtAInv, Atbx);
  const paramY = matVecMul(AtAInv, Atby);

  return [paramX, paramY];
}

/**
 * Apply affine transform to a point
 */
export function applyAffineTransform(
  matrix: number[][],
  point: [number, number]
): [number, number] {
  const x =
    matrix[0][0] * point[0] + matrix[0][1] * point[1] + matrix[0][2];
  const y =
    matrix[1][0] * point[0] + matrix[1][1] * point[1] + matrix[1][2];
  return [x, y];
}

// --- Matrix helpers ---

function transpose(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const result: number[][] = [];
  for (let j = 0; j < cols; j++) {
    result[j] = [];
    for (let i = 0; i < rows; i++) {
      result[j][i] = m[i][j];
    }
  }
  return result;
}

function matMul(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const result: number[][] = [];

  for (let i = 0; i < rows; i++) {
    result[i] = [];
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function matVecMul(m: number[][], v: number[]): number[] {
  return m.map((row) => row.reduce((sum, val, i) => sum + val * v[i], 0));
}

function invert3x3(m: number[][]): number[][] {
  const [
    [a, b, c],
    [d, e, f],
    [g, h, i],
  ] = m;

  const det =
    a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  if (Math.abs(det) < 1e-10) {
    throw new Error('Matrix is singular, cannot invert');
  }

  const invDet = 1 / det;

  return [
    [
      (e * i - f * h) * invDet,
      (c * h - b * i) * invDet,
      (b * f - c * e) * invDet,
    ],
    [
      (f * g - d * i) * invDet,
      (a * i - c * g) * invDet,
      (c * d - a * f) * invDet,
    ],
    [
      (d * h - e * g) * invDet,
      (b * g - a * h) * invDet,
      (a * e - b * d) * invDet,
    ],
  ];
}

/**
 * Eye Aspect Ratio (EAR) for blink detection
 * Uses 6 landmark points around each eye
 */
export function computeEAR(
  eyeLandmarks: { x: number; y: number }[]
): number {
  // p1=left corner, p2=top-left, p3=top-right, p4=right corner, p5=bottom-right, p6=bottom-left
  if (eyeLandmarks.length < 6) return 1.0;

  const [p1, p2, p3, p4, p5, p6] = eyeLandmarks;

  const vertical1 = Math.sqrt(
    (p2.x - p6.x) ** 2 + (p2.y - p6.y) ** 2
  );
  const vertical2 = Math.sqrt(
    (p3.x - p5.x) ** 2 + (p3.y - p5.y) ** 2
  );
  const horizontal = Math.sqrt(
    (p1.x - p4.x) ** 2 + (p1.y - p4.y) ** 2
  );

  if (horizontal === 0) return 1.0;

  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Mouth Aspect Ratio (MAR) for smile detection
 */
export function computeMAR(
  upperLip: { x: number; y: number },
  lowerLip: { x: number; y: number },
  leftCorner: { x: number; y: number },
  rightCorner: { x: number; y: number }
): number {
  const verticalGap = Math.sqrt(
    (upperLip.x - lowerLip.x) ** 2 + (upperLip.y - lowerLip.y) ** 2
  );
  const horizontalWidth = Math.sqrt(
    (leftCorner.x - rightCorner.x) ** 2 +
      (leftCorner.y - rightCorner.y) ** 2
  );

  if (horizontalWidth === 0) return 0;

  return verticalGap / horizontalWidth;
}

/**
 * Estimate head yaw angle from nose tip and ear landmarks
 */
export function estimateYaw(
  noseTip: { x: number; y: number; z?: number },
  leftEar: { x: number; y: number; z?: number },
  rightEar: { x: number; y: number; z?: number }
): number {
  const leftDist = Math.sqrt(
    (noseTip.x - leftEar.x) ** 2 + (noseTip.y - leftEar.y) ** 2
  );
  const rightDist = Math.sqrt(
    (noseTip.x - rightEar.x) ** 2 + (noseTip.y - rightEar.y) ** 2
  );

  // Ratio-based yaw estimation
  const ratio = leftDist / (leftDist + rightDist);
  // ratio ~0.5 = facing straight, <0.5 = turned right, >0.5 = turned left
  const yawDegrees = (ratio - 0.5) * 90; // rough estimation

  return yawDegrees;
}

/**
 * Generate a random challenge sequence for active liveness
 */
export type ChallengeType = 'blink' | 'smile' | 'turnLeft' | 'turnRight';

export function generateChallengeSequence(
  count: number = 2
): ChallengeType[] {
  const allChallenges: ChallengeType[] = [
    'blink',
    'smile',
    'turnLeft',
    'turnRight',
  ];

  // Fisher-Yates shuffle
  const shuffled = [...allChallenges];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

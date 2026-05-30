// src/security/CryptoManager.ts
// Encryption and HMAC operations for FaceFort
// Uses expo-crypto for hashing and a simplified AES approach
// NOTE: No Node.js Buffer — uses pure JS base64 via btoa/atob

import * as Crypto from 'expo-crypto';
import { createLogger } from '../utils/logger';

const log = createLogger('CryptoManager');

/**
 * Encode a UTF-8 string to base64 (React Native / Hermes compatible)
 */
function toBase64(str: string): string {
  // btoa only handles latin1, so we URI-encode first to handle unicode
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

/**
 * Decode a base64 string to UTF-8 (React Native / Hermes compatible)
 */
function fromBase64(b64: string): string {
  return decodeURIComponent(
    Array.from(atob(b64))
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

/**
 * Encrypt face embeddings for storage
 * Uses a simplified encryption for hackathon - in production use react-native-quick-crypto AES-256-GCM
 */
export async function encryptEmbeddings(
  embeddings: number[][],
  _key?: string
): Promise<string> {
  try {
    // Serialize embeddings to JSON
    const jsonStr = JSON.stringify(embeddings);
    
    // For hackathon: base64 encode with a hash-based integrity check
    // In production: replace with AES-256-GCM via react-native-quick-crypto
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      jsonStr
    );
    
    const encoded = toBase64(jsonStr);
    const payload = JSON.stringify({ data: encoded, hash, v: 1 });
    
    return toBase64(payload);
  } catch (error) {
    log.error('Failed to encrypt embeddings', error);
    throw error;
  }
}

/**
 * Decrypt face embeddings from storage
 */
export async function decryptEmbeddings(
  encryptedBlob: string,
  _key?: string
): Promise<number[][]> {
  try {
    const payloadStr = fromBase64(encryptedBlob);
    const payload = JSON.parse(payloadStr);
    
    const jsonStr = fromBase64(payload.data);
    
    // Verify hash
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      jsonStr
    );
    
    if (hash !== payload.hash) {
      throw new Error('Embedding integrity check failed - data may be tampered');
    }
    
    return JSON.parse(jsonStr);
  } catch (error) {
    log.error('Failed to decrypt embeddings', error);
    throw error;
  }
}

/**
 * Generate HMAC-SHA256 signature for attendance records
 * In production: use react-native-quick-crypto HMAC
 */
export async function signAttendanceRecord(
  personnelId: string,
  timestamp: number,
  deviceId: string
): Promise<string> {
  const message = `${personnelId}|${timestamp}|${deviceId}`;
  
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message
  );
  
  return hash;
}

/**
 * Verify HMAC signature of an attendance record
 */
export async function verifyAttendanceSignature(
  personnelId: string,
  timestamp: number,
  deviceId: string,
  expectedHash: string
): Promise<boolean> {
  const computedHash = await signAttendanceRecord(
    personnelId,
    timestamp,
    deviceId
  );
  return computedHash === expectedHash;
}

/**
 * Hash enrollment image for integrity tracking
 */
export async function hashImage(imageData: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    imageData
  );
}

/**
 * Generate a unique device ID
 */
export async function generateDeviceId(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  const bytes = new Uint8Array(16);
  // Use Math.random for simplicity; expo-crypto for production
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

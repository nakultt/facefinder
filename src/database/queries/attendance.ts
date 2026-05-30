// src/database/queries/attendance.ts
// Attendance log CRUD operations

import { getDatabase } from '../schema';
import { createLogger } from '../../utils/logger';
import type { AttendanceLog } from '../../types';

const log = createLogger('AttendanceDB');

/**
 * Log an attendance record with HMAC signature
 */
export async function logAttendance(record: AttendanceLog): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO attendance_logs (id, personnel_id, timestamp, confidence_score, liveness_score, location_lat, location_lng, device_id, log_hash, sync_status, raw_image_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.personnelId,
      record.timestamp,
      record.confidenceScore,
      record.livenessScore,
      record.locationLat,
      record.locationLng,
      record.deviceId,
      record.logHash,
      record.syncStatus,
      record.rawImagePath,
    ]
  );
  log.info(`Logged attendance for personnel: ${record.personnelId}`);
}

/**
 * Get recent attendance logs
 */
export async function getRecentAttendance(
  limit: number = 50
): Promise<AttendanceLog[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT a.*, p.name as personnel_name 
     FROM attendance_logs a 
     LEFT JOIN personnel p ON a.personnel_id = p.id 
     ORDER BY a.timestamp DESC 
     LIMIT ?`,
    [limit]
  );
  return rows.map(mapRowToAttendance);
}

/**
 * Get attendance for a specific person
 */
export async function getAttendanceForPerson(
  personnelId: string,
  limit: number = 20
): Promise<AttendanceLog[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM attendance_logs WHERE personnel_id = ? ORDER BY timestamp DESC LIMIT ?',
    [personnelId, limit]
  );
  return rows.map(mapRowToAttendance);
}

/**
 * Get today's attendance count
 */
export async function getTodayAttendanceCount(): Promise<number> {
  const db = getDatabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM attendance_logs WHERE timestamp >= ?',
    [startOfDay.getTime()]
  );
  return result?.count ?? 0;
}

/**
 * Get pending sync records
 */
export async function getPendingSyncRecords(): Promise<AttendanceLog[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM attendance_logs WHERE sync_status IN ('pending', 'failed') ORDER BY timestamp ASC"
  );
  return rows.map(mapRowToAttendance);
}

/**
 * Mark records as synced
 */
export async function markRecordsSynced(ids: string[]): Promise<void> {
  const db = getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE attendance_logs SET sync_status = 'synced' WHERE id IN (${placeholders})`,
    ids
  );
  log.info(`Marked ${ids.length} records as synced`);
}

/**
 * Purge old synced records (older than 30 days)
 */
export async function purgeOldRecords(): Promise<number> {
  const db = getDatabase();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const result = await db.runAsync(
    "DELETE FROM attendance_logs WHERE sync_status = 'synced' AND timestamp < ?",
    [cutoff]
  );
  const count = result.changes;
  if (count > 0) {
    log.info(`Purged ${count} old synced records`);
  }
  return count;
}

/**
 * Delete all attendance logs (for testing/reset)
 */
export async function deleteAllAttendance(): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM attendance_logs');
  log.info('Deleted all attendance logs');
}

// --- Helpers ---

function mapRowToAttendance(row: any): AttendanceLog {
  return {
    id: row.id,
    personnelId: row.personnel_id,
    timestamp: row.timestamp,
    confidenceScore: row.confidence_score,
    livenessScore: row.liveness_score,
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    deviceId: row.device_id,
    logHash: row.log_hash,
    syncStatus: row.sync_status,
    rawImagePath: row.raw_image_path,
  };
}

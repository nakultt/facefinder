// src/database/queries/personnel.ts
// Personnel CRUD operations

import { getDatabase } from '../schema';
import { createLogger } from '../../utils/logger';
import type { Personnel } from '../../types';

const log = createLogger('PersonnelDB');

/**
 * Enroll a new person with their encrypted embeddings
 */
export async function enrollPersonnel(person: Personnel): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO personnel (id, employee_id, name, department, enrolled_at, embedding_blob, embedding_version, enrollment_image_hash, is_active, synced_to_cloud)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      person.id,
      person.employeeId,
      person.name,
      person.department,
      person.enrolledAt,
      person.embeddingBlob,
      person.embeddingVersion,
      person.enrollmentImageHash,
      person.isActive ? 1 : 0,
      person.syncedToCloud ? 1 : 0,
    ]
  );
  log.info(`Enrolled personnel: ${person.name} (${person.employeeId})`);
}

/**
 * Get a single person by ID
 */
export async function getPersonnelById(id: string): Promise<Personnel | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM personnel WHERE id = ?',
    [id]
  );
  return row ? mapRowToPersonnel(row) : null;
}

/**
 * Get all active personnel with their embeddings
 */
export async function getAllActivePersonnel(): Promise<Personnel[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM personnel WHERE is_active = 1'
  );
  return rows.map(mapRowToPersonnel);
}

/**
 * Get count of enrolled personnel
 */
export async function getPersonnelCount(): Promise<number> {
  const db = getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM personnel WHERE is_active = 1'
  );
  return result?.count ?? 0;
}

/**
 * Check if any personnel are enrolled (for first-launch detection)
 */
export async function hasEnrolledPersonnel(): Promise<boolean> {
  const count = await getPersonnelCount();
  return count > 0;
}

/**
 * Update personnel embeddings (for re-enrollment)
 */
export async function updateEmbeddings(
  id: string,
  embeddingBlob: string,
  version: number
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE personnel SET embedding_blob = ?, embedding_version = ? WHERE id = ?',
    [embeddingBlob, version, id]
  );
  log.info(`Updated embeddings for personnel: ${id}`);
}

/**
 * Deactivate a person (soft delete)
 */
export async function deactivatePersonnel(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('UPDATE personnel SET is_active = 0 WHERE id = ?', [id]);
  log.info(`Deactivated personnel: ${id}`);
}

/**
 * Delete all personnel (for testing/reset)
 */
export async function deleteAllPersonnel(): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM personnel');
  log.info('Deleted all personnel');
}

// --- Helpers ---

function mapRowToPersonnel(row: any): Personnel {
  return {
    id: row.id,
    employeeId: row.employee_id,
    name: row.name,
    department: row.department,
    enrolledAt: row.enrolled_at,
    embeddingBlob: row.embedding_blob,
    embeddingVersion: row.embedding_version,
    enrollmentImageHash: row.enrollment_image_hash,
    isActive: row.is_active === 1,
    syncedToCloud: row.synced_to_cloud === 1,
  };
}

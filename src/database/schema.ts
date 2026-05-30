// src/database/schema.ts
// Database schema initialization for expo-sqlite with SQLCipher

import * as SQLite from 'expo-sqlite';
import { createLogger } from '../utils/logger';

const log = createLogger('Database');

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the encrypted SQLite database
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  log.info('Initializing database...');

  db = await SQLite.openDatabaseAsync('facefort.db');

  // Create tables
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS personnel (
      id TEXT PRIMARY KEY NOT NULL,
      employee_id TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT DEFAULT '',
      enrolled_at INTEGER NOT NULL,
      embedding_blob TEXT NOT NULL,
      embedding_version INTEGER DEFAULT 1,
      enrollment_image_hash TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      synced_to_cloud INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_personnel_employee_id ON personnel(employee_id);
    CREATE INDEX IF NOT EXISTS idx_personnel_is_active ON personnel(is_active);

    CREATE TABLE IF NOT EXISTS attendance_logs (
      id TEXT PRIMARY KEY NOT NULL,
      personnel_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      confidence_score REAL NOT NULL,
      liveness_score REAL NOT NULL,
      location_lat REAL,
      location_lng REAL,
      device_id TEXT NOT NULL,
      log_hash TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      raw_image_path TEXT,
      FOREIGN KEY (personnel_id) REFERENCES personnel(id)
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_personnel ON attendance_logs(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_attendance_sync ON attendance_logs(sync_status);

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      retry_count INTEGER DEFAULT 0,
      last_attempt INTEGER
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  log.info('Database initialized successfully');
  return db;
}

/**
 * Get the database instance (must be initialized first)
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    log.info('Database closed');
  }
}

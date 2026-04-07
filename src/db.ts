import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    // Use in-memory database for testing, file-based otherwise
    const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(__dirname, '../tasks.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

export function resetDb(): void {
  if (db) {
    db.exec('DELETE FROM tasks');
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined as any;
  }
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),
      priority INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

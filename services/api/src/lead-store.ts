import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface StoredLead {
  email: string;
  sourceUrl?: string;
  grade?: number;
  capturedAt: string;
}

export interface LeadStore {
  add(lead: StoredLead): void;
  all(): readonly StoredLead[];
}

/**
 * SQLite-backed LeadStore using the Node built-in `node:sqlite` module. Persists
 * leads to a file on disk so they survive process restarts. Intended to be
 * swappable for other backends (e.g. Cloudflare D1) via the LeadStore interface.
 */
export class SqliteLeadStore implements LeadStore {
  #db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
    this.#db = new DatabaseSync(dbPath);
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        email TEXT NOT NULL,
        source_url TEXT,
        grade INTEGER,
        captured_at TEXT NOT NULL
      )
    `);
  }

  add(lead: StoredLead): void {
    const statement = this.#db.prepare(
      "INSERT INTO leads (email, source_url, grade, captured_at) VALUES (?, ?, ?, ?)",
    );
    statement.run(
      lead.email,
      lead.sourceUrl ?? null,
      typeof lead.grade === "number" ? lead.grade : null,
      lead.capturedAt,
    );
  }

  all(): readonly StoredLead[] {
    const statement = this.#db.prepare(
      "SELECT email, source_url, grade, captured_at FROM leads ORDER BY rowid ASC",
    );
    const rows = statement.all() as Array<{
      email: string;
      source_url: string | null;
      grade: number | null;
      captured_at: string;
    }>;

    return rows.map((row) => ({
      email: row.email,
      ...(row.source_url ? { sourceUrl: row.source_url } : {}),
      ...(typeof row.grade === "number" ? { grade: row.grade } : {}),
      capturedAt: row.captured_at,
    }));
  }

  close(): void {
    this.#db.close();
  }
}

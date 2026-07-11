import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { SqliteLeadStore } from "./lead-store.js";

describe("SqliteLeadStore", () => {
  it("persists leads across separate store instances at the same path", () => {
    const dir = mkdtempSync(join(tmpdir(), "slop-score-lead-store-"));
    const dbPath = join(dir, `${randomUUID()}.db`);

    try {
      const store = new SqliteLeadStore(dbPath);
      store.add({
        email: "founder@example.com",
        sourceUrl: "https://example.com",
        grade: 87,
        capturedAt: "2026-07-11T00:00:00.000Z",
      });

      assert.deepEqual(store.all(), [
        {
          email: "founder@example.com",
          sourceUrl: "https://example.com",
          grade: 87,
          capturedAt: "2026-07-11T00:00:00.000Z",
        },
      ]);
      store.close();

      const reopened = new SqliteLeadStore(dbPath);
      assert.equal(reopened.all().length, 1);
      assert.equal(reopened.all()[0]?.email, "founder@example.com");
      reopened.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("omits optional fields when not provided", () => {
    const dir = mkdtempSync(join(tmpdir(), "slop-score-lead-store-"));
    const dbPath = join(dir, `${randomUUID()}.db`);

    try {
      const store = new SqliteLeadStore(dbPath);
      store.add({ email: "minimal@example.com", capturedAt: "2026-07-11T00:00:00.000Z" });

      const [lead] = store.all();
      assert.equal(lead?.email, "minimal@example.com");
      assert.equal(lead?.sourceUrl, undefined);
      assert.equal(lead?.grade, undefined);
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

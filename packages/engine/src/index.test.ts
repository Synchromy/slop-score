import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bandForGrade, createEmptyReport } from "./index.js";

describe("report surface", () => {
  it("creates a deterministic empty report", () => {
    assert.deepEqual(createEmptyReport(), {
      grade: 100,
      band: "clean",
      wordCount: 0,
      packs: ["universal"],
      findings: [],
      byRule: {},
    });
  });

  it("maps grades to launch bands", () => {
    assert.equal(bandForGrade(100), "clean");
    assert.equal(bandForGrade(72), "some-tells");
    assert.equal(bandForGrade(40), "heavy-slop");
  });
});

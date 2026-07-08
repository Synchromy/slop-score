import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractPlainText } from "./index.js";

describe("paste extraction", () => {
  it("keeps plain prose as a deterministic block", () => {
    assert.deepEqual(extractPlainText("  Real copy.  "), [
      { text: "Real copy.", source: "paste", startOffset: 0 },
    ]);
  });

  it("drops empty paste input", () => {
    assert.deepEqual(extractPlainText("   "), []);
  });
});

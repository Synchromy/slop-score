import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rulePackSchema, slopRuleSchema } from "./schema.js";
import {
  cringePatterns,
  earnedWords,
  killWords,
  nextWaveTells,
  sentenceOpeners,
  universalPack,
  universalRules,
} from "./universal.js";

describe("universal rules", () => {
  it("ports the voice-lint data sets without dropping rows", () => {
    assert.equal(killWords.length, 48);
    assert.equal(earnedWords.length, 6);
    assert.equal(sentenceOpeners.length, 14);
    assert.equal(nextWaveTells.length, 3);
    assert.equal(cringePatterns.length, 6);
  });

  it("validates every rule against the schema", () => {
    for (const rule of universalRules) {
      assert.doesNotThrow(() => slopRuleSchema.parse(rule));
    }
    assert.doesNotThrow(() => rulePackSchema.parse(universalPack));
  });

  it("flags ambiguous kill-word split decisions for Khoa and Neel review", () => {
    const ambiguous = universalRules.filter((rule) => rule.flags?.splitReview === "ambiguous");
    assert.ok(ambiguous.length > 0);
    assert.ok(ambiguous.map((rule) => rule.id).includes("kill-word.value-proposition"));
    assert.equal(
      ambiguous.every((rule) => rule.flags?.reviewNote),
      true,
    );
  });
});

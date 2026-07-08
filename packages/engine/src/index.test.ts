import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeText, bandForGrade, createEmptyReport } from "./index.js";

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

  it("flags deterministic phrase, opener, and regex rules with spans", () => {
    const report = analyzeText("Additionally, our seamless platform says: let that sink in.");

    assert.equal(report.wordCount, 9);
    assert.equal(report.band, "some-tells");
    assert.deepEqual(report.byRule, { opener: 1, "kill-word": 1, cringe: 1 });
    assert.deepEqual(
      report.findings.map((finding) => [finding.ruleId, finding.span]),
      [
        ["opener.additionally", [0, 12]],
        ["kill-word.seamless", [18, 26]],
        ["cringe.let-that-sink-in", [42, 58]],
      ],
    );
  });

  it("detects the M1 differentiator heuristics", () => {
    const report = analyzeText(
      [
        "It works.",
        "Fast.",
        "Everywhere.",
        "Our product is simple, scalable, and magical.",
        "Arguably this is generally speaking useful to some extent.",
      ].join(" "),
    );

    assert.ok(report.findings.some((finding) => finding.ruleId === "cadence.fragment-staccato"));
    assert.ok(report.findings.some((finding) => finding.ruleId === "density.forced-threes"));
    assert.equal(
      report.findings.filter((finding) => finding.ruleId === "density.hedge-stacking").length,
      3,
    );
  });

  it("layers the Synchromy pack on top of universal rules", () => {
    const report = analyzeText("We optimize everything 🙂", { packs: ["synchromy"] });

    assert.deepEqual(report.packs, ["universal", "synchromy"]);
    assert.ok(report.findings.some((finding) => finding.ruleId === "spelling.british-english"));
    assert.ok(report.findings.some((finding) => finding.ruleId === "emoji.any"));
  });
});

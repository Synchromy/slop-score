import type { PackId, Severity } from "@synchromy/slop-score-rules";

export type GradeBand = "clean" | "some-tells" | "heavy-slop";

export type Finding = {
  ruleId: string;
  severity: Severity;
  span: readonly [start: number, end: number];
  excerpt: string;
  message: string;
  suggestion: string;
};

export type Report = {
  grade: number;
  band: GradeBand;
  wordCount: number;
  packs: readonly PackId[];
  findings: readonly Finding[];
  byRule: Record<string, number>;
};

export function bandForGrade(grade: number): GradeBand {
  if (grade >= 90) return "clean";
  if (grade >= 60) return "some-tells";
  return "heavy-slop";
}

export function createEmptyReport(packs: readonly PackId[] = ["universal"]): Report {
  return {
    grade: 100,
    band: "clean",
    wordCount: 0,
    packs,
    findings: [],
    byRule: {},
  };
}

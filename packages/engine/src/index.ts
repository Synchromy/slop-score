import {
  synchromyPack,
  universalPack,
  type PackId,
  type RulePack,
  type Severity,
  type SlopRule,
} from "@synchromy/slop-score-rules";

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

export type AnalyzeOptions = {
  packs?: readonly PackId[];
};

type TextRange = {
  text: string;
  start: number;
  end: number;
};

const allPacks: Record<PackId, RulePack> = {
  universal: universalPack,
  synchromy: synchromyPack,
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

export function analyzeText(input: string, options: AnalyzeOptions = {}): Report {
  const text = input.trim();
  const packs = normalizedPacks(options.packs);
  if (!text) return createEmptyReport(packs);

  const wordCount = countWords(text);
  const findings = selectedRules(packs).flatMap((rule) => runRule(rule, text));
  const sortedFindings = findings.sort(
    (a, b) => a.span[0] - b.span[0] || a.ruleId.localeCompare(b.ruleId),
  );
  const grade = gradeFindings(sortedFindings, wordCount);

  return {
    grade,
    band: bandForGrade(grade),
    wordCount,
    packs,
    findings: sortedFindings,
    byRule: summarizeByRule(sortedFindings),
  };
}

function normalizedPacks(packs: readonly PackId[] = ["universal"]): readonly PackId[] {
  const ordered: PackId[] = [];
  if (!packs.includes("universal")) ordered.push("universal");
  for (const pack of packs) {
    if (!ordered.includes(pack)) ordered.push(pack);
  }
  return ordered;
}

function selectedRules(packs: readonly PackId[]): SlopRule[] {
  return packs.flatMap((pack) => allPacks[pack].rules);
}

function runRule(rule: SlopRule, text: string): Finding[] {
  if (rule.id === "cadence.fragment-staccato") return findFragmentCadence(rule, text);
  if (rule.id === "density.forced-threes") return findForcedThrees(rule, text);
  if (rule.id === "density.hedge-stacking") return findHedgeStacking(rule, text);
  if (rule.id === "density.title-case-nouns") return findTitleCaseNouns(rule, text);

  if (rule.kind === "phrase") return findPhrase(rule, text);
  if (rule.kind === "regex") return findRegex(rule, text);
  if (rule.kind === "denylist") return findDenylist(rule, text);
  return [];
}

function findPhrase(rule: SlopRule, text: string): Finding[] {
  const phrase = rule.match ?? rule.pattern;
  if (!phrase) return [];

  if (rule.scope === "sentence-start") {
    return sentences(text).flatMap((sentence) => {
      const leading = sentence.text.match(/^\s*/)?.[0].length ?? 0;
      const start = sentence.start + leading;
      const candidate = text.slice(start, start + phrase.length);
      if (candidate.localeCompare(phrase, undefined, { sensitivity: "accent" }) !== 0) return [];
      return [finding(rule, text, start, start + phrase.length)];
    });
  }

  return findLiteral(text, phrase).map(([start, end]) => finding(rule, text, start, end));
}

function findRegex(rule: SlopRule, text: string): Finding[] {
  const pattern = rule.pattern ?? rule.match;
  if (!pattern) return [];
  const regex = new RegExp(pattern, "giu");
  return collectMatches(regex, text).map(([start, end]) => finding(rule, text, start, end));
}

function findDenylist(rule: SlopRule, text: string): Finding[] {
  return (rule.terms ?? []).flatMap((term) =>
    findLiteral(text, term).map(([start, end]) => finding(rule, text, start, end)),
  );
}

function findFragmentCadence(rule: SlopRule, text: string): Finding[] {
  const minRun = rule.threshold ?? 3;
  const maxWords = rule.window ?? 5;
  const parts = sentences(text);
  const results: Finding[] = [];
  let run: TextRange[] = [];

  for (const part of parts) {
    if (countWords(part.text) <= maxWords) {
      run.push(part);
      continue;
    }
    pushCadenceRun(rule, text, run, minRun, results);
    run = [];
  }
  pushCadenceRun(rule, text, run, minRun, results);
  return results;
}

function pushCadenceRun(
  rule: SlopRule,
  text: string,
  run: readonly TextRange[],
  minRun: number,
  results: Finding[],
): void {
  if (run.length < minRun) return;
  const first = run[0];
  const last = run[run.length - 1];
  if (!first || !last) return;
  results.push(finding(rule, text, first.start, last.end));
}

function findForcedThrees(rule: SlopRule, text: string): Finding[] {
  const pattern = rule.pattern;
  if (!pattern) return [];
  const regex = new RegExp(pattern, "giu");
  return sentences(text).flatMap((sentence) =>
    collectMatches(regex, sentence.text).map(([start, end]) =>
      finding(rule, text, sentence.start + start, sentence.start + end),
    ),
  );
}

function findHedgeStacking(rule: SlopRule, text: string): Finding[] {
  const matches = (rule.terms ?? []).flatMap((term) =>
    findLiteral(text, term).map(([start, end]) => finding(rule, text, start, end)),
  );
  const perHundredWords = (matches.length / Math.max(countWords(text), 1)) * 100;
  if (perHundredWords < (rule.threshold ?? 2)) return [];
  return matches;
}

function findTitleCaseNouns(rule: SlopRule, text: string): Finding[] {
  const pattern = rule.pattern;
  if (!pattern) return [];
  const sentenceStartIndexes = new Set(
    sentences(text).map(
      (sentence) => sentence.start + (sentence.text.match(/^\s*/)?.[0].length ?? 0),
    ),
  );
  const matches = collectMatches(new RegExp(pattern, "gu"), text)
    .filter(([start]) => !sentenceStartIndexes.has(start))
    .map(([start, end]) => finding(rule, text, start, end));
  const perHundredWords = (matches.length / Math.max(countWords(text), 1)) * 100;
  if (perHundredWords < (rule.threshold ?? 1)) return [];
  return matches;
}

function findLiteral(text: string, term: string): Array<readonly [number, number]> {
  const regex = new RegExp(escapeRegExp(term), "giu");
  return collectMatches(regex, text);
}

function collectMatches(regex: RegExp, text: string): Array<readonly [number, number]> {
  const matches: Array<readonly [number, number]> = [];
  for (const match of text.matchAll(regex)) {
    if (match.index == null) continue;
    matches.push([match.index, match.index + match[0].length]);
  }
  return matches;
}

function sentences(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  const regex = /[^.!?\n]+[.!?]*/gu;
  for (const match of text.matchAll(regex)) {
    if (match.index == null) continue;
    const raw = match[0];
    if (!raw.trim()) continue;
    ranges.push({ text: raw, start: match.index, end: match.index + raw.length });
  }
  return ranges;
}

function finding(rule: SlopRule, text: string, start: number, end: number): Finding {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    span: [start, end],
    excerpt: excerpt(text, start, end),
    message: rule.message,
    suggestion: rule.suggestion,
  };
}

function excerpt(text: string, start: number, end: number): string {
  const before = Math.max(0, start - 36);
  const after = Math.min(text.length, end + 36);
  const prefix = before > 0 ? "..." : "";
  const suffix = after < text.length ? "..." : "";
  return `${prefix}${text.slice(before, after).replace(/\s+/g, " ").trim()}${suffix}`;
}

function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function gradeFindings(findings: readonly Finding[], wordCount: number): number {
  const weighted = findings.reduce((total, item) => total + (item.severity === "fail" ? 12 : 5), 0);
  const normalizedWords = Math.max(wordCount, 100);
  return Math.max(0, Math.round(100 - (weighted * 100) / normalizedWords));
}

function summarizeByRule(findings: readonly Finding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of findings) {
    const family = item.ruleId.split(".")[0] ?? item.ruleId;
    counts[family] = (counts[family] ?? 0) + 1;
  }
  return counts;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

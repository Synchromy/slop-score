import { readdir, readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, resolve } from "node:path";

import { analyzeText, type Report } from "@synchromy/slop-score-engine";
import type { PackId } from "@synchromy/slop-score-rules";

type Args = {
  path: string;
  threshold: number;
  packs: PackId[];
};

const proseExtensions = new Set([".md", ".mdx", ".txt", ".html", ".htm"]);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const files = await proseFiles(resolveTarget(args.path));
  if (files.length === 0) {
    console.log("Slop Score: no prose files found.");
    return;
  }

  const reports: Array<{ file: string; report: Report }> = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    reports.push({ file, report: analyzeText(text, { packs: args.packs }) });
  }

  let failed = false;
  for (const { file, report } of reports) {
    const line = `${file}: ${report.grade}/100 ${report.band} (${report.findings.length} findings)`;
    if (report.grade < args.threshold) {
      failed = true;
      console.error(line);
      for (const finding of report.findings.slice(0, 10)) {
        console.error(`  - ${finding.ruleId}: ${finding.message}`);
      }
    } else {
      console.log(line);
    }
  }

  if (failed) {
    throw new Error(`One or more files scored below ${args.threshold}.`);
  }
}

function parseArgs(argv: readonly string[]): Args {
  const normalized = argv[0] === "--" ? argv.slice(1) : argv;
  const value = (name: string, fallback: string): string => {
    const index = normalized.indexOf(`--${name}`);
    return index >= 0 ? (normalized[index + 1] ?? fallback) : fallback;
  };

  const packs = value("packs", "universal")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    path: value("path", "."),
    threshold: Number(value("threshold", "70")),
    packs: packs.every(isPackId) ? packs : ["universal"],
  };
}

function resolveTarget(target: string): string {
  if (isAbsolute(target)) return target;
  return resolve(process.env.GITHUB_WORKSPACE ?? process.env.INIT_CWD ?? process.cwd(), target);
}

async function proseFiles(target: string): Promise<string[]> {
  const info = await stat(target);
  if (info.isFile()) return proseExtensions.has(extname(target).toLowerCase()) ? [target] : [];
  if (!info.isDirectory()) return [];

  const entries = await readdir(target, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.name !== "node_modules" && entry.name !== "dist" && !entry.name.startsWith(".git"),
      )
      .map((entry) => proseFiles(join(target, entry.name))),
  );
  return nested.flat().sort();
}

function isPackId(value: string): value is PackId {
  return value === "universal" || value === "synchromy";
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

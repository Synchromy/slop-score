import { createEmptyReport } from "@synchromy/slop-score-engine";

const bootReport = createEmptyReport();

export function renderBootSummary(): string {
  return `Slop Score ready: ${bootReport.grade}/100`;
}

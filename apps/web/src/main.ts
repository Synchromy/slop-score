import {
  analyzeText,
  type Finding,
  type GradeBand,
  type Report,
} from "@synchromy/slop-score-engine";
import type { PackId } from "@synchromy/slop-score-rules";

const sampleText =
  "Additionally, our seamless AI-powered everything helps teams move the needle. It works. Fast. Everywhere. The platform is simple, scalable, and magical. Arguably, it is useful to some extent.";

type ShareState = {
  text: string;
  packs: PackId[];
};

export function renderBootSummary(): string {
  return `Slop Score ready: ${analyzeText(sampleText).grade}/100`;
}

function mount(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  root.innerHTML = `
    <main class="shell">
      <section class="workspace">
        <div class="input-pane">
          <div class="brand-row">
            <div>
              <p class="eyebrow">Deterministic copy diagnostic</p>
              <h1>Slop Score</h1>
            </div>
            <div class="score-pill" id="score-pill">100</div>
          </div>
          <textarea id="copy-input" spellcheck="true" aria-label="Paste copy to score"></textarea>
          <div class="toolbar">
            <label class="toggle">
              <input id="synchromy-pack" type="checkbox" />
              <span>Synchromy pack</span>
            </label>
            <button id="sample-button" type="button">Sample</button>
            <button id="share-button" type="button">Share</button>
          </div>
        </div>
        <div class="report-pane" id="report-pane"></div>
      </section>
    </main>
  `;

  const input = root.querySelector<HTMLTextAreaElement>("#copy-input");
  const synchromyPack = root.querySelector<HTMLInputElement>("#synchromy-pack");
  const sampleButton = root.querySelector<HTMLButtonElement>("#sample-button");
  const shareButton = root.querySelector<HTMLButtonElement>("#share-button");
  const reportPane = root.querySelector<HTMLDivElement>("#report-pane");
  const scorePill = root.querySelector<HTMLDivElement>("#score-pill");

  if (!input || !synchromyPack || !sampleButton || !shareButton || !reportPane || !scorePill)
    return;

  const shared = readShareState();
  input.value = shared?.text ?? "";
  synchromyPack.checked = shared?.packs.includes("synchromy") ?? false;

  const analyze = (): void => {
    const packs = selectedPacks(synchromyPack.checked);
    const report = analyzeText(input.value, { packs });
    scorePill.textContent = String(report.grade);
    scorePill.dataset.band = report.band;
    reportPane.innerHTML = renderReport(input.value, report);
  };

  input.addEventListener("input", analyze);
  synchromyPack.addEventListener("change", analyze);
  sampleButton.addEventListener("click", () => {
    input.value = sampleText;
    analyze();
  });
  shareButton.addEventListener("click", async () => {
    const state: ShareState = { text: input.value, packs: selectedPacks(synchromyPack.checked) };
    const url = `${location.origin}${location.pathname}#${encodeState(state)}`;
    history.replaceState(null, "", url);
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    shareButton.textContent = "Copied";
    setTimeout(() => {
      shareButton.textContent = "Share";
    }, 1200);
  });

  analyze();
}

function selectedPacks(includeSynchromy: boolean): PackId[] {
  return includeSynchromy ? ["universal", "synchromy"] : ["universal"];
}

function renderReport(text: string, report: Report): string {
  if (!text.trim()) {
    return `
      <div class="empty-state">
        <p>Paste homepage copy, landing-page text, or a social post.</p>
      </div>
    `;
  }

  return `
    <section class="grade-card" data-band="${report.band}">
      <div>
        <p class="eyebrow">Grade</p>
        <div class="grade">${report.grade}</div>
      </div>
      <div>
        <p class="band">${labelBand(report.band)}</p>
        <p>${report.wordCount} words · ${report.findings.length} findings · ${report.packs.join(", ")}</p>
      </div>
    </section>
    <section class="highlighted-copy">${highlightText(text, report.findings)}</section>
    <section class="findings">
      ${report.findings.length === 0 ? "<p>No slop signals found.</p>" : report.findings.map(renderFinding).join("")}
    </section>
  `;
}

function highlightText(text: string, findings: readonly Finding[]): string {
  const sorted = [...findings].sort((a, b) => a.span[0] - b.span[0]);
  let cursor = 0;
  let output = "";

  for (const finding of sorted) {
    const [start, end] = finding.span;
    if (start < cursor) continue;
    output += escapeHtml(text.slice(cursor, start));
    output += `<mark data-severity="${finding.severity}" title="${escapeHtml(finding.message)}">${escapeHtml(
      text.slice(start, end),
    )}</mark>`;
    cursor = end;
  }

  return `${output}${escapeHtml(text.slice(cursor))}`.replace(/\n/g, "<br />");
}

function renderFinding(finding: Finding): string {
  return `
    <article class="finding" data-severity="${finding.severity}">
      <div>
        <strong>${escapeHtml(finding.ruleId)}</strong>
        <span>${finding.severity}</span>
      </div>
      <p>${escapeHtml(finding.message)}</p>
      <p>${escapeHtml(finding.suggestion)}</p>
      <blockquote>${escapeHtml(finding.excerpt)}</blockquote>
    </article>
  `;
}

function labelBand(band: GradeBand): string {
  if (band === "clean") return "Clean";
  if (band === "some-tells") return "Some tells";
  return "Heavy slop";
}

function encodeState(state: ShareState): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function readShareState(): ShareState | undefined {
  if (!location.hash.slice(1)) return undefined;
  try {
    const normalized = location.hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as ShareState;
    if (!decoded.text || !Array.isArray(decoded.packs)) return undefined;
    return decoded;
  } catch {
    return undefined;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (typeof document !== "undefined") {
  mount();
}

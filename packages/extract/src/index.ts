export type ProseBlock = {
  text: string;
  source: "paste" | "url";
  startOffset: number;
  url?: string;
};

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function extractPlainText(input: string): ProseBlock[] {
  const text = input.trim();
  if (!text) return [];
  return [{ text, source: "paste", startOffset: 0 }];
}

const MIN_SCOPED_TEXT_LENGTH = 120;

export function extractHtmlText(html: string, url?: string): ProseBlock[] {
  const withoutHead = stripHead(html);
  const scoped = scopeToMainContent(withoutHead);

  let text = cleanupToProse(scoped);
  if (text.length < MIN_SCOPED_TEXT_LENGTH) {
    // The scoping heuristic missed the real content (e.g. no <main>/<article>,
    // or an empty <main> shell) — fall back to the whole head-stripped document
    // rather than returning empty or truncated prose.
    text = cleanupToProse(withoutHead);
  }

  if (!text) return [];
  return [{ text, source: "url", startOffset: 0, ...(url ? { url } : {}) }];
}

/** Removes the <head> element (title, meta, etc.) so it never leaks into scored prose. */
function stripHead(html: string): string {
  return html.replace(/<head\b[\s\S]*?<\/head>/giu, " ");
}

/**
 * Narrows the document to its primary content region when the page marks one:
 * concatenated <article> blocks, else a single <main> block, else the whole document.
 * This drops nav/header/footer/menus that live outside the main region even when
 * they aren't wrapped in a semantic tag we already strip.
 */
function scopeToMainContent(html: string): string {
  const articleMatches = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/giu)];
  if (articleMatches.length > 0) {
    return articleMatches.map((match) => match[1] ?? "").join("\n");
  }

  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/iu);
  if (mainMatch) return mainMatch[1] ?? "";

  return html;
}

function cleanupToProse(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
      .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/giu, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/giu, " ")
      .replace(
        /<(?:nav|header|footer|aside|form|pre|code)\b[\s\S]*?<\/(?:nav|header|footer|aside|form|pre|code)>/giu,
        " ",
      )
      .replace(/<!--[\s\S]*?-->/gu, " ")
      .replace(/<\/(?:p|div|section|article|main|h[1-6]|li|br)>/giu, "\n")
      .replace(/<[^>]+>/gu, " ")
      .replace(/[ \t\r\f\v]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export async function extractUrlText(
  url: string,
  options: { fetch?: FetchLike } = {},
): Promise<ProseBlock[]> {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error("fetch is not available in this runtime.");

  const response = await fetcher(parsed.toString(), {
    headers: { "user-agent": "slop-score/0.0.0" },
  });
  if (!response.ok) throw new Error(`URL fetch failed with ${response.status}.`);

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (contentType.includes("text/html") || /<html|<body|<article|<main/iu.test(body)) {
    return extractHtmlText(body, parsed.toString());
  }

  const text = body.trim();
  return text ? [{ text, source: "url", startOffset: 0, url: parsed.toString() }] : [];
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (entity, raw: string) => {
    if (raw.startsWith("#x")) return String.fromCodePoint(Number.parseInt(raw.slice(2), 16));
    if (raw.startsWith("#")) return String.fromCodePoint(Number.parseInt(raw.slice(1), 10));
    return named[raw.toLowerCase()] ?? entity;
  });
}

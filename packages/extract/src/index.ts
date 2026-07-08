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

export function extractHtmlText(html: string, url?: string): ProseBlock[] {
  const text = decodeEntities(
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

  if (!text) return [];
  return [{ text, source: "url", startOffset: 0, ...(url ? { url } : {}) }];
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

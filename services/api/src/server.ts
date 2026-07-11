import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

import { analyzeText, type Report } from "@synchromy/slop-score-engine";
import { extractUrlText, type FetchLike } from "@synchromy/slop-score-extract";
import type { PackId } from "@synchromy/slop-score-rules";

import type { LeadStore, StoredLead } from "./lead-store.js";

export type { LeadStore, StoredLead } from "./lead-store.js";

export type ApiOptions = {
  apiToken?: string;
  fetch?: FetchLike;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  leadStore?: LeadStore;
  staticDir?: string;
};

type ScoreRequest = {
  text?: string;
  url?: string;
  packs?: PackId[];
};

type LeadRequest = {
  email?: string;
  sourceUrl?: string;
  grade?: number;
};

const leads: StoredLead[] = [];

/** In-memory LeadStore backing the default (no store injected) behavior. */
const defaultLeadStore: LeadStore = {
  add(lead) {
    leads.push(lead);
  },
  all() {
    return leads;
  },
};

export function createApiServer(options: ApiOptions = {}) {
  const limiter = createRateLimiter(options.rateLimit);
  const leadStore = options.leadStore ?? defaultLeadStore;

  return createHttpServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") return empty(response, 204);
      if (!limiter(request)) return json(response, 429, { error: "rate_limited" });

      if (request.method === "GET" && request.url === "/health") {
        return json(response, 200, { ok: true });
      }

      if (request.method === "POST" && request.url === "/score") {
        if (!authorized(request, options.apiToken))
          return json(response, 401, { error: "unauthorized" });
        return json(
          response,
          200,
          await scoreRequest(await readJson<ScoreRequest>(request), options.fetch),
        );
      }

      if (request.method === "POST" && request.url === "/extract") {
        if (!authorized(request, options.apiToken))
          return json(response, 401, { error: "unauthorized" });
        return json(
          response,
          200,
          await extractRequest(await readJson<{ url?: string }>(request), options.fetch),
        );
      }

      if (request.method === "POST" && request.url === "/leads") {
        if (!authorized(request, options.apiToken))
          return json(response, 401, { error: "unauthorized" });
        return json(
          response,
          201,
          captureLead(await readJson<LeadRequest>(request), leadStore),
        );
      }

      if (request.method === "GET" && options.staticDir) {
        const served = serveStatic(options.staticDir, request.url ?? "/", response);
        if (served) return;
      }

      return json(response, 404, { error: "not_found" });
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : "bad_request" });
    }
  });
}

export async function scoreRequest(body: ScoreRequest, fetcher?: FetchLike): Promise<Report> {
  const packs = normalizePacks(body.packs);
  if (body.text?.trim()) return analyzeText(body.text, { packs });
  if (body.url?.trim()) {
    const blocks = await extractUrlText(body.url, fetcher ? { fetch: fetcher } : {});
    return analyzeText(blocks.map((block) => block.text).join("\n\n"), { packs });
  }
  throw new Error("text or url is required");
}

export async function extractRequest(
  body: { url?: string },
  fetcher?: FetchLike,
): Promise<{ text: string; blocks: number }> {
  if (!body.url?.trim()) throw new Error("url is required");
  const blocks = await extractUrlText(body.url, fetcher ? { fetch: fetcher } : {});
  return { text: blocks.map((block) => block.text).join("\n\n"), blocks: blocks.length };
}

export function captureLead(body: LeadRequest, store: LeadStore = defaultLeadStore): StoredLead {
  if (!body.email?.includes("@")) throw new Error("valid email is required");
  const lead: StoredLead = {
    email: body.email.trim(),
    ...(body.sourceUrl ? { sourceUrl: body.sourceUrl } : {}),
    ...(typeof body.grade === "number" ? { grade: body.grade } : {}),
    capturedAt: new Date().toISOString(),
  };
  store.add(lead);
  return lead;
}

export function storedLeads(): readonly StoredLead[] {
  return defaultLeadStore.all();
}

function normalizePacks(packs: readonly PackId[] | undefined): PackId[] {
  if (!packs || packs.length === 0) return ["universal"];
  return packs.filter((pack): pack is PackId => pack === "universal" || pack === "synchromy");
}

function authorized(request: IncomingMessage, apiToken: string | undefined): boolean {
  if (!apiToken) return true;
  return request.headers.authorization === `Bearer ${apiToken}`;
}

function createRateLimiter(rateLimit: ApiOptions["rateLimit"]) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (request: IncomingMessage): boolean => {
    if (!rateLimit) return true;
    const key = request.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const current = hits.get(key);
    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + rateLimit.windowMs });
      return true;
    }
    current.count += 1;
    return current.count <= rateLimit.maxRequests;
  };
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders(),
  });
  response.end(JSON.stringify(body));
}

function empty(response: ServerResponse, status: number): void {
  response.writeHead(status, corsHeaders());
  response.end();
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
}

const STATIC_CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

/**
 * Serves a file from `staticDir` for a GET request, falling back to
 * `index.html` (SPA-style) when the requested path has no matching file.
 * Returns false (and writes nothing) if neither the requested file nor the
 * index.html fallback exists, so the caller can fall through to a 404.
 */
function serveStatic(staticDir: string, requestUrl: string, response: ServerResponse): boolean {
  const root = resolve(staticDir);
  let pathname = "/";
  try {
    pathname = decodeURIComponent(requestUrl.split("?")[0] ?? "/");
  } catch {
    pathname = requestUrl.split("?")[0] ?? "/";
  }

  const requested = resolve(root, `.${pathname}`);
  const withinRoot = requested === root || requested.startsWith(root + sep);

  const filePath =
    withinRoot && existsSync(requested) && statSync(requested).isFile()
      ? requested
      : join(root, "index.html");

  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;

  const contentType = STATIC_CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
  response.writeHead(200, { "content-type": contentType, ...corsHeaders() });
  createReadStream(filePath).pipe(response);
  return true;
}

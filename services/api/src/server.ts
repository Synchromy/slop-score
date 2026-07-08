import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { analyzeText, type Report } from "@synchromy/slop-score-engine";
import { extractUrlText, type FetchLike } from "@synchromy/slop-score-extract";
import type { PackId } from "@synchromy/slop-score-rules";

export type ApiOptions = {
  apiToken?: string;
  fetch?: FetchLike;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
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

type StoredLead = {
  email: string;
  sourceUrl?: string;
  grade?: number;
  capturedAt: string;
};

const leads: StoredLead[] = [];

export function createApiServer(options: ApiOptions = {}) {
  const limiter = createRateLimiter(options.rateLimit);

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

      if (request.method === "POST" && request.url === "/leads") {
        if (!authorized(request, options.apiToken))
          return json(response, 401, { error: "unauthorized" });
        return json(response, 201, captureLead(await readJson<LeadRequest>(request)));
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

export function captureLead(body: LeadRequest): StoredLead {
  if (!body.email?.includes("@")) throw new Error("valid email is required");
  const lead: StoredLead = {
    email: body.email.trim(),
    ...(body.sourceUrl ? { sourceUrl: body.sourceUrl } : {}),
    ...(typeof body.grade === "number" ? { grade: body.grade } : {}),
    capturedAt: new Date().toISOString(),
  };
  leads.push(lead);
  return lead;
}

export function storedLeads(): readonly StoredLead[] {
  return leads;
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

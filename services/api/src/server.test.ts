import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";

import { createApiServer, scoreRequest, storedLeads } from "./server.js";

describe("score api helpers", () => {
  it("scores direct text", async () => {
    const report = await scoreRequest({ text: "Additionally, this is seamless." });

    assert.equal(report.findings.length, 2);
    assert.equal(report.byRule.opener, 1);
  });

  it("scores fetched url text", async () => {
    const report = await scoreRequest(
      { url: "https://example.test" },
      async () =>
        new Response("<main><p>Teams use the Signal Fabric to win 🙂</p></main>", {
          headers: { "content-type": "text/html" },
        }),
    );

    assert.ok(report.findings.some((finding) => finding.ruleId === "density.title-case-nouns"));
    assert.ok(report.findings.some((finding) => finding.ruleId === "emoji.any-advisory"));
  });
});

describe("http api", () => {
  it("serves health and protects token-gated endpoints", async () => {
    const { baseUrl, close } = await listen({ apiToken: "secret" });
    try {
      const health = await fetch(`${baseUrl}/health`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { ok: true });

      const unauthorized = await fetch(`${baseUrl}/score`, {
        method: "POST",
        body: JSON.stringify({ text: "seamless" }),
      });
      assert.equal(unauthorized.status, 401);
    } finally {
      await close();
    }
  });

  it("scores text over http and captures leads", async () => {
    const { baseUrl, close } = await listen();
    try {
      const scored = await fetch(`${baseUrl}/score`, {
        method: "POST",
        body: JSON.stringify({ text: "Additionally, this is seamless." }),
      });
      assert.equal(scored.status, 200);
      const report = (await scored.json()) as { grade: number; findings: unknown[] };
      assert.equal(typeof report.grade, "number");
      assert.equal(report.findings.length, 2);

      const lead = await fetch(`${baseUrl}/leads`, {
        method: "POST",
        body: JSON.stringify({ email: "founder@example.com", grade: report.grade }),
      });
      assert.equal(lead.status, 201);
      assert.ok(storedLeads().some((item) => item.email === "founder@example.com"));
    } finally {
      await close();
    }
  });

  it("rate-limits when configured", async () => {
    const { baseUrl, close } = await listen({ rateLimit: { maxRequests: 1, windowMs: 60_000 } });
    try {
      const first = await fetch(`${baseUrl}/health`);
      const second = await fetch(`${baseUrl}/health`);
      assert.equal(first.status, 200);
      assert.equal(second.status, 429);
    } finally {
      await close();
    }
  });
});

async function listen(options: Parameters<typeof createApiServer>[0] = {}) {
  const server = createApiServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.close();
      await once(server, "close");
    },
  };
}

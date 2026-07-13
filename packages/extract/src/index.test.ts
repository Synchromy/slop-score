import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractHtmlText, extractPlainText, extractUrlText } from "./index.js";

describe("paste extraction", () => {
  it("keeps plain prose as a deterministic block", () => {
    assert.deepEqual(extractPlainText("  Real copy.  "), [
      { text: "Real copy.", source: "paste", startOffset: 0 },
    ]);
  });

  it("drops empty paste input", () => {
    assert.deepEqual(extractPlainText("   "), []);
  });
});

describe("url extraction", () => {
  it("strips boilerplate, code, and markup from html", () => {
    assert.deepEqual(
      extractHtmlText(`
        <html>
          <head><style>.x { color: red; }</style></head>
          <body>
            <nav>Home Pricing</nav>
            <main>
              <h1>Slop Score</h1>
              <p>Paste copy &amp; get exact findings.</p>
              <pre>const nope = true</pre>
            </main>
          </body>
        </html>
      `),
      [
        {
          text: "Slop Score\nPaste copy & get exact findings.",
          source: "url",
          startOffset: 0,
        },
      ],
    );
  });

  it("fetches and extracts an http url with an injectable fetcher", async () => {
    const blocks = await extractUrlText("https://example.test/page", {
      fetch: async () =>
        new Response("<main><p>Clean copy wins.</p></main>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    });

    assert.deepEqual(blocks, [
      {
        text: "Clean copy wins.",
        source: "url",
        startOffset: 0,
        url: "https://example.test/page",
      },
    ]);
  });

  it("rejects non-http urls", async () => {
    await assert.rejects(() => extractUrlText("file:///tmp/nope"), /Only http and https/);
  });
});

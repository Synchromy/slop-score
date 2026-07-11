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

  it("strips <head> content, including the page title, from extracted prose", () => {
    const html = `
      <html>
        <head><title>Page Title | Brand</title></head>
        <body><main><p>Real prose here that is long enough to pass.</p></main></body>
      </html>
    `;

    const blocks = extractHtmlText(html);
    assert.equal(blocks.length, 1);
    assert.match(blocks[0]!.text, /Real prose here that is long enough to pass\./);
    assert.doesNotMatch(blocks[0]!.text, /Page Title/);
    assert.doesNotMatch(blocks[0]!.text, /Brand/);
  });

  it("scopes to <article> content and drops menus that live outside it", () => {
    const html = `
      <html>
        <body>
          <div class="nav">
            <a href="/">Explore</a>
            <a href="/services">Our services</a>
            <a href="/how-we-work">How we work</a>
            <a href="/contact">Contact</a>
            <a href="/faq">FAQ</a>
          </div>
          <article>
            <p>This is the real article prose that should be kept intact for scoring. It
            is long enough to clear the safety fallback threshold on its own, so the
            surrounding menu markup should never leak into the extracted output.</p>
          </article>
        </body>
      </html>
    `;

    const blocks = extractHtmlText(html);
    assert.equal(blocks.length, 1);
    assert.match(blocks[0]!.text, /real article prose that should be kept intact/);
    assert.doesNotMatch(blocks[0]!.text, /Explore/);
    assert.doesNotMatch(blocks[0]!.text, /Our services/);
    assert.doesNotMatch(blocks[0]!.text, /How we work/);
    assert.doesNotMatch(blocks[0]!.text, /FAQ/);
  });

  it("falls back to the whole document when <main> is empty and prose lives outside it", () => {
    const html = `
      <html>
        <body>
          <main>   <!-- nothing here --> </main>
          <div>
            <p>Actual prose lives here outside main and must still be extracted for scoring.</p>
          </div>
        </body>
      </html>
    `;

    const blocks = extractHtmlText(html);
    assert.equal(blocks.length, 1);
    assert.match(blocks[0]!.text, /Actual prose lives here outside main/);
  });
});

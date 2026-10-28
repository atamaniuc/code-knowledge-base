import { describe, expect, it } from "vitest";
import { htmlToText, readHtmlPosting, readMarkdownPosting, readPosting } from "../src/posting.js";

describe("htmlToText", () => {
  it("keeps one line per block and drops the markup", () => {
    const text = htmlToText("<h1>Role</h1><p>Node.js &amp; TypeScript</p><ul><li>Kafka</li></ul>");
    expect(text).toBe("Role\nNode.js & TypeScript\nKafka");
  });

  it("drops scripts and styles, which carry no requirements", () => {
    expect(htmlToText("<style>b{}</style><script>var x</script><p>PostgreSQL</p>")).toBe("PostgreSQL");
  });
});

describe("readHtmlPosting", () => {
  it("prefers the schema.org block over the rendered page", () => {
    const html = `<html><head><title>Fallback</title>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Senior Node.js","description":"<p>NestJS and Kafka</p>"}</script>
      </head><body><p>marketing copy</p></body></html>`;
    expect(readHtmlPosting(html, "Fallback")).toEqual({ title: "Senior Node.js", body: "NestJS and Kafka" });
  });

  it("falls back to the page when the block is missing or malformed", () => {
    expect(readHtmlPosting("<p>Redis</p>", "T")).toEqual({ title: "T", body: "Redis" });
    expect(readHtmlPosting('<script type="application/ld+json">{not json}</script><p>Redis</p>', "T")).toEqual({
      title: "T",
      body: "Redis",
    });
  });
});

describe("readMarkdownPosting", () => {
  it("takes the first heading as the title and strips the markers", () => {
    const md = "# Senior Node.js Engineer\n\n## Requirements\n* **NestJS** and TypeScript\n* [Kafka](https://example.com)";
    const posting = readMarkdownPosting(md, "fallback");
    expect(posting.title).toBe("Senior Node.js Engineer");
    expect(posting.body).toContain("NestJS and TypeScript");
    expect(posting.body).toContain("Kafka");
    expect(posting.body).not.toContain("**");
    expect(posting.body).not.toContain("https://example.com");
  });

  it("uses the fallback title when the file states none", () => {
    expect(readMarkdownPosting("plain text", "finverity-senior").title).toBe("finverity-senior");
  });
});

describe("readPosting", () => {
  it("decides by the bytes, so a saved page still reads", () => {
    expect(readPosting("<html><body><p>Redis</p></body></html>", "T").body).toBe("Redis");
    expect(readPosting("# Title\n\nRedis", "T").title).toBe("Title");
  });
});

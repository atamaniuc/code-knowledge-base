import { describe, expect, it } from "vitest";
import { escapeHtml, renderMarkdown, slugifyHeading } from "../src/markdown.js";

/** Backticks are the one character these tests cannot write literally inside a template. */
const BT = String.fromCharCode(96);
const span = (text: string): string => BT + text + BT;
const fence = (text: string): string => BT + BT + BT + "\n" + text + "\n" + BT + BT + BT;

/** Tags the renderer owns; anything else that starts with "<" is a hole. */
const ALLOWED = /<\/?(?:h[1-6]|p|ul|ol|li|strong|code|pre)(?:\s[^>]*)?>/g;

function unexpectedTagStarts(html: string): string[] {
  return html.replace(ALLOWED, "").match(/</g) ?? [];
}

describe("escapeHtml", () => {
  it("escapes the characters that can start markup or close an attribute", () => {
    expect(escapeHtml('<img src="x" onerror=alert(1)>')).toBe("&lt;img src=&quot;x&quot; onerror=alert(1)&gt;");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("escapes ampersands first, so an entity cannot be reassembled", () => {
    expect(escapeHtml("&lt;script&gt;")).toBe("&amp;lt;script&amp;gt;");
  });
});

describe("slugifyHeading", () => {
  it("matches the anchors wiki_refs use", () => {
    expect(slugifyHeading("Position effects")).toBe("position-effects");
    expect(slugifyHeading("When a modular monolith is the right answer?")).toBe(
      "when-a-modular-monolith-is-the-right-answer",
    );
  });

  it("ignores inline markup", () => {
    expect(slugifyHeading("**Single**-flight with a " + span("lease"))).toBe("single-flight-with-a-lease");
  });
});

describe("renderMarkdown", () => {
  it("renders headings with anchor ids", () => {
    expect(renderMarkdown("## Position effects")).toContain('<h2 id="position-effects">Position effects</h2>');
  });

  it("suffixes a repeated heading so the first anchor stays addressable", () => {
    const html = renderMarkdown("## Same\n\n## Same");
    expect(html).toContain('id="same"');
    expect(html).toContain('id="same-2"');
  });

  it("wraps consecutive lines in one paragraph and splits on a blank line", () => {
    expect(renderMarkdown("one\ntwo\n\nthree")).toBe("<p>one two</p>\n<p>three</p>");
  });

  it("renders bold and inline code", () => {
    expect(renderMarkdown("**not** uniform")).toContain("<strong>not</strong>");
    expect(renderMarkdown("use " + span("recall@k") + " here")).toContain("<code>recall@k</code>");
  });

  it("does not treat markup inside a code span as markup", () => {
    expect(renderMarkdown(span("**x**"))).toBe("<p><code>**x**</code></p>");
  });

  it("renders unordered and ordered lists as separate lists", () => {
    expect(renderMarkdown("- a\n- b")).toBe("<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
    expect(renderMarkdown("1. a\n2. b")).toBe("<ol>\n<li>a</li>\n<li>b</li>\n</ol>");
  });

  it("escapes fenced code and never renders tags inside it", () => {
    expect(renderMarkdown(fence("<script>alert(1)</script>"))).toBe(
      "<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>",
    );
  });

  it("never emits a tag the renderer does not own", () => {
    const nasty = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "**<svg/onload=alert(1)>**",
      "[link](javascript:alert(1))",
      "> quote\n\n| a | b |\n| - | - |",
      "# <iframe src=x>",
      fence("<b>bold?</b>"),
      "a &lt; b &amp;&amp; c",
      "<a href=" + span("x") + ">click</a>",
    ];
    for (const input of nasty) {
      const html = renderMarkdown(input);
      expect(unexpectedTagStarts(html), input).toEqual([]);
      expect(html, input).not.toContain("<script");
      expect(html, input).not.toContain("<img");
      expect(html, input).not.toContain("<iframe");
      // A URL in content stays literal escaped text: links are not rendered at all, so
      // there is no anchor for it to land in.
      expect(html, input).not.toMatch(/<a[\s>]/);
    }
  });

  it("keeps the whole body escaped, so the output is safe in innerHTML", () => {
    const html = renderMarkdown("Use <b>bold</b> and " + span("<i>code</i>") + ".");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("<code>&lt;i&gt;code&lt;/i&gt;</code>");
    expect(unexpectedTagStarts(html)).toEqual([]);
  });
});

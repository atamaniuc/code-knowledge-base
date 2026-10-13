/**
 * A Markdown renderer small enough to audit.
 *
 * Wiki bodies are Markdown, and the wiki is authored here rather than fetched, but
 * "authored here" is not a security boundary: a `<` in prose, a code fence containing
 * markup, or a stray `<img onerror>` must never become structure. So the whole document
 * is HTML-escaped first and only then are the few supported constructs turned into tags.
 * There is no raw-HTML escape hatch and no attribute interpolation from content, which is
 * why the output can be assigned to innerHTML at all.
 *
 * Supported: headings (with GitHub-style ids so wiki_refs anchors resolve), paragraphs,
 * unordered and ordered lists, bold, inline code, fenced code blocks.
 * Deliberately not supported: raw HTML, links, images, tables, blockquotes. Each of those
 * needs a URL or an attribute, and the panel must never emit one on content's word.
 */

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The anchor a wiki_ref names: "Position effects" → "position-effects". */
export function slugifyHeading(text: string): string {
  return text
    .replace(/[\x60*_]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueId(slug: string, used: Map<string, number>): string {
  const base = slug.length > 0 ? slug : "section";
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : base + "-" + String(count + 1);
}

/** Bold and inline code inside an already-escaped line. Code wins over bold. */
function inline(escaped: string): string {
  return escaped
    .split("\x60")
    .map((part, index) =>
      index % 2 === 1 ? "<code>" + part + "</code>" : part.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"),
    )
    .join("");
}

export function renderMarkdown(markdown: string): string {
  const lines = escapeHtml(markdown.replace(/\r\n?/g, "\n")).split("\n");
  const out: string[] = [];
  const usedIds = new Map<string, number>();
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) out.push("<p>" + inline(paragraph.join(" ")) + "</p>");
    paragraph = [];
  };
  const closeList = (): void => {
    if (list) out.push("</" + list + ">");
    list = null;
  };
  const openList = (kind: "ul" | "ol"): void => {
    if (list !== kind) {
      closeList();
      out.push("<" + kind + ">");
      list = kind;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (/^\x60\x60\x60/.test(trimmed)) {
      flushParagraph();
      closeList();
      i += 1;
      const code: string[] = [];
      while (i < lines.length && !/^\x60\x60\x60/.test((lines[i] ?? "").trim())) {
        code.push(lines[i] ?? "");
        i += 1;
      }
      i += 1; // the closing fence, or the end of the document
      out.push("<pre><code>" + code.join("\n") + "</code></pre>");
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = (heading[1] ?? "#").length;
      const title = (heading[2] ?? "").trim();
      out.push('<h' + level + ' id="' + uniqueId(slugifyHeading(title), usedIds) + '">' + inline(title) + "</h" + level + ">");
      i += 1;
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      openList("ul");
      out.push("<li>" + inline(bullet[1] ?? "") + "</li>");
      i += 1;
      continue;
    }

    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      openList("ol");
      out.push("<li>" + inline(ordered[1] ?? "") + "</li>");
      i += 1;
      continue;
    }

    if (trimmed === "") {
      flushParagraph();
      closeList();
      i += 1;
      continue;
    }

    closeList();
    paragraph.push(trimmed);
    i += 1;
  }

  flushParagraph();
  closeList();
  return out.join("\n");
}

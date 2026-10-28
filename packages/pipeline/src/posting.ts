/**
 * Reading a posting, wherever it came from.
 *
 * A posting is HTML from a board or Markdown somebody saved, and the gazetteer only ever
 * sees text: entities decoded, tags gone, one line per block. The title matters as much as
 * the body, because it is often the only place a posting states a level.
 *
 * Nothing here fetches. The caller hands in bytes, so every branch — a schema.org block, a
 * page with none, a saved Markdown file — is testable without a network.
 */

export interface PostingText {
  title: string;
  body: string;
}

/** Boards escape their own markup twice over; both passes are undone before anything reads it. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|hellip|mdash|ndash|rsquo|lsquo|rdquo|ldquo);/g, (_, name: string) => {
      const table: Record<string, string> = {
        amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "\u2026",
        mdash: "\u2014", ndash: "\u2013", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c",
      };
      return table[name] ?? " ";
    });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|li|h[1-6]|div|tr|ul|ol)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    // A tag becomes a space, so every block arrives with one on its left.
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Title and body, preferring the schema.org block a job board publishes for machines.
 *
 * Boards that emit structured data put the whole description there, unrendered; falling
 * back to the page means a posting whose markup changes still parses.
 */
export function readHtmlPosting(html: string, fallbackTitle: string): PostingText {
  for (const block of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1] ?? "");
    } catch {
      continue;
    }
    for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
      const node = item as { "@type"?: string; title?: string; name?: string; description?: string };
      if (node["@type"] !== "JobPosting" || !node.description) continue;
      return { title: node.title ?? node.name ?? fallbackTitle, body: htmlToText(node.description) };
    }
  }
  return { title: fallbackTitle, body: htmlToText(html) };
}

/** The first heading is the title; the rest is text with the markup markers taken out. */
export function readMarkdownPosting(markdown: string, fallbackTitle: string): PostingText {
  const title = /^#{1,6}[ \t]+(.+)$/m.exec(markdown)?.[1]?.trim() || fallbackTitle;
  const body = markdown
    .replace(/^#{1,6}[ \t]+/gm, "")
    .replace(/[*_>]+/g, " ")
    .replace(/`+/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[ \t\u00a0]+/g, " ")
    .trim();
  return { title, body: body.length > 0 ? body : markdown.trim() };
}

/** Which reader to use is decided by the bytes: a posting saved from a page still reads. */
export function readPosting(raw: string, fallbackTitle: string): PostingText {
  const looksLikeHtml = /<\s*(!doctype|html|body|p|div|li)\b/i.test(raw);
  return looksLikeHtml ? readHtmlPosting(raw, fallbackTitle) : readMarkdownPosting(raw, fallbackTitle);
}

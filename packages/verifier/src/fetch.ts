import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { SourceDocument } from "./gate.js";

/**
 * Fetches and caches the documents a gate checks against.
 *
 * Cached because the verdict has to be re-checkable against the text that was actually
 * read: a source that changes between the check and the audit would make an honest verdict
 * look wrong, and a dishonest one look fine.
 */
const UA = "interview-prep/0.1 (source grounding)";

const stripHtml = (html: string) =>
  html
    .replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

export async function fetchSource(url: string, cacheDir: string): Promise<SourceDocument> {
  mkdirSync(cacheDir, { recursive: true });
  const key = createHash("sha256").update(url).digest("hex").slice(0, 32);
  const path = join(cacheDir, `${key}.txt`);

  if (existsSync(path)) {
    return { url, text: readFileSync(path, "utf8") };
  }

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const text = stripHtml(await res.text());
  writeFileSync(path, text);
  return { url, text };
}

/**
 * Fetches every source an article cites, keeping going when one is unavailable.
 *
 * A dead link is a grounding failure for the claims that depended on it, not a crash: one
 * unreachable source must not stop the other claims from being checked.
 */
export async function fetchAll(urls: string[], cacheDir: string): Promise<{ sources: SourceDocument[]; failed: string[] }> {
  const sources: SourceDocument[] = [];
  const failed: string[] = [];
  for (const url of urls) {
    try {
      sources.push(await fetchSource(url, cacheDir));
    } catch {
      failed.push(url);
    }
  }
  return { sources, failed };
}

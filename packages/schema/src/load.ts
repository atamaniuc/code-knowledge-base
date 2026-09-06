import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";

export interface LoadedFile<T = unknown> {
  /** Path relative to the repo root, used verbatim in error output. */
  file: string;
  data: T;
  /** Markdown body for files that have one. */
  body?: string;
}

export function walk(dir: string, ext: string[]): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out = out.concat(walk(full, ext));
    } else if (ext.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out.sort();
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Splits a Markdown file into YAML frontmatter and body. */
export function readMarkdown(root: string, file: string): LoadedFile {
  const raw = readFileSync(file, "utf8");
  const match = FRONTMATTER.exec(raw);
  if (!match) {
    throw new Error(
      `${relative(root, file)}: no YAML frontmatter found\n` +
        "  why:  the loader reads article metadata from frontmatter; without it the article is invisible to search and to questions\n" +
        "  fix:  start the file with a --- fenced YAML block containing at least slug, title, domain, tech and sources",
    );
  }
  return {
    file: relative(root, file),
    data: parseYaml(match[1] ?? ""),
    body: match[2] ?? "",
  };
}

export function readYaml(root: string, file: string): LoadedFile {
  return {
    file: relative(root, file),
    data: parseYaml(readFileSync(file, "utf8")),
  };
}

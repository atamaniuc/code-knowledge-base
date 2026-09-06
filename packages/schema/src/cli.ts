#!/usr/bin/env tsx
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { validateContent } from "./validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

const { errors, counts } = validateContent(root);

const summary = Object.entries(counts)
  .map(([k, v]) => `${k}=${v}`)
  .join("  ");

if (errors.length > 0) {
  for (const e of errors) console.error(e + "\n");
  console.error(`content invalid: ${errors.length} problem(s)   [${summary}]`);
  process.exit(1);
}

console.log(`content valid   [${summary}]`);

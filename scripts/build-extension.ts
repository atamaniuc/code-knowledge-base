#!/usr/bin/env tsx
/**
 * Builds the unpacked extension into apps/extension/dist.
 *
 * Everything is bundled locally: Manifest V3 forbids remotely hosted code, and the
 * product promise is that the bank works with the network off.
 */
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "apps/extension");
const OUT = join(SRC, "dist");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(SRC, "public"), OUT, { recursive: true });

await build({
  entryPoints: [join(SRC, "src/panel.ts")],
  outfile: join(OUT, "panel.js"),
  bundle: true,
  format: "esm",
  target: "chrome120",
  minify: true,
  alias: {
    "@scheduling": join(ROOT, "packages/scheduling/src"),
    "@schema": join(ROOT, "packages/schema/src"),
  },
});

console.log(`built extension -> apps/extension/dist`);

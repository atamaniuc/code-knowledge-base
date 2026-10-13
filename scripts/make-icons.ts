#!/usr/bin/env tsx
/**
 * Draws the extension icon.
 *
 * Chrome wants raster icons, and the mark is two letters on a rounded square, so this is a
 * tiny PNG encoder rather than a dependency on an image library: the art is deterministic, it
 * is regenerated the same way every time, and the repository keeps the bytes it ships. Run it
 * with make icons after changing the colour or the mark.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "apps/extension/public/icons");

/** Matches --accent in panel.css, so the toolbar and the panel header agree. */
const BLUE = [36, 86, 214] as const;
const WHITE = [255, 255, 255] as const;
const SIZES = [16, 32, 48, 128];

/** 5x7 capitals, the smallest grid that still reads at 16px. */
const GLYPHS: Record<string, string[]> = {
  I: ["111", "010", "010", "010", "010", "010", "111"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
};

function mark(): { width: number; height: number; rows: string[] } {
  const left = GLYPHS.I ?? [];
  const right = GLYPHS.P ?? [];
  const height = Math.max(left.length, right.length);
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    rows.push((left[y] ?? "") + "0" + (right[y] ?? ""));
  }
  return { width: 4 + (right[0]?.length ?? 0), height, rows };
}

function insideRounded(x: number, y: number, size: number, radius: number): boolean {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/** Colour with 3x3 supersampling on the corners only; the letters are drawn after, unscaled. */
function render(size: number): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = Math.round(size * 0.22);
  const letters = mark();
  const scale = Math.max(1, Math.floor((size * 0.5) / letters.height));
  const markWidth = letters.width * scale;
  const markHeight = letters.height * scale;
  const offsetX = Math.round((size - markWidth) / 2);
  const offsetY = Math.round((size - markHeight) / 2);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let covered = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          if (insideRounded(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3, size, radius)) covered += 1;
        }
      }
      const alpha = Math.round((covered / 9) * 255);
      const gx = Math.floor((x - offsetX) / scale);
      const gy = Math.floor((y - offsetY) / scale);
      const letter = gx >= 0 && gy >= 0 && gx < letters.width && gy < letters.height ? letters.rows[gy]?.[gx] === "1" : false;
      const [r, g, b] = letter ? WHITE : BLUE;
      const at = (y * size + x) * 4;
      pixels[at] = r;
      pixels[at + 1] = g;
      pixels[at + 2] = b;
      pixels[at + 3] = alpha;
    }
  }
  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function png(size: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT, `icon${size}.png`);
  writeFileSync(file, png(size, render(size)));
  console.log("wrote " + file.replace(ROOT + "/", ""));
}

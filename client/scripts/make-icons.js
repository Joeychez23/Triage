// Renders the Triage app icons as PNGs (no dependencies): the "Signal" mark,
// three dots biggest first, in the light-mode colors (installed-app icons
// can't follow the theme). Matches public/favicon.svg.
// Usage: npm run icons
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const TILE = [31, 26, 22];
const ACCENT = [234, 88, 12];
const CREAM = [243, 238, 230];

// Shapes live in a 64-unit square, the same coordinates as favicon.svg.
const DOTS = [
  { x: 20, y: 32, r: 9.5, color: ACCENT, alpha: 1 },
  { x: 38.5, y: 32, r: 6.2, color: CREAM, alpha: 0.85 },
  { x: 51, y: 32, r: 3.6, color: CREAM, alpha: 0.45 },
];

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function render(size, { maskable = false } = {}) {
  const ss = 4;
  const W = size * ss;
  const out = Buffer.alloc(size * size * 4);
  // Maskable icons need the artwork inside the central safe zone.
  const scale = maskable ? 0.74 : 1;
  const offset = (64 - 64 * scale) / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = ((px * ss + sx + 0.5) / W) * 64;
          const v = ((py * ss + sy + 0.5) / W) * 64;
          if (!maskable) {
            // Rounded tile, radius 15.
            const rr = 15;
            const qx = Math.max(Math.abs(u - 32) - (32 - rr), 0);
            const qy = Math.max(Math.abs(v - 32) - (32 - rr), 0);
            if (Math.hypot(qx, qy) > rr) continue;
          }
          const x = (u - offset) / scale;
          const y = (v - offset) / scale;
          let col = TILE;
          for (const d of DOTS) if (Math.hypot(x - d.x, y - d.y) <= d.r) col = mix(TILE, d.color, d.alpha);
          r += col[0];
          g += col[1];
          b += col[2];
          a += 1;
        }
      }
      const o = (py * size + px) * 4;
      out[o] = a ? r / a : 0;
      out[o + 1] = a ? g / a : 0;
      out[o + 2] = a ? b / a : 0;
      out[o + 3] = (a / (ss * ss)) * 255;
    }
  }
  return png(size, out);
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const outDir = path.join(__dirname, "..", "public");
for (const [name, size] of [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["logo192.png", 192],
  ["logo512.png", 512],
]) {
  fs.writeFileSync(path.join(outDir, name), render(size));
}
fs.writeFileSync(path.join(outDir, "maskable512.png"), render(512, { maskable: true }));
console.log("Icons written to public/");

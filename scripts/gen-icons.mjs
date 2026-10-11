// Generates CrediScout PWA icons (pure Node, no dependencies).
// Navy rounded square + gold diamond mark. Run: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const NAVY = [11, 61, 145];
const GOLD = [233, 180, 76];
const WHITE = [255, 255, 255];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([td, data])));
  return Buffer.concat([len, td, data, crc]);
}

function roundedRectDist(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  const dx = x - cx, dy = y - cy;
  if (x >= radius && x <= size - radius) return Math.abs(y - size / 2) <= size / 2 ? -1 : 1;
  if (y >= radius && y <= size - radius) return Math.abs(x - size / 2) <= size / 2 ? -1 : 1;
  return Math.sqrt(dx * dx + dy * dy) - radius;
}

function diamondDist(x, y, cx, cy, half) {
  return (Math.abs(x - cx) + Math.abs(y - cy)) / half - 1;
}

// size: px, opts: { maskable } — maskable keeps art inside the центраl 66% safe zone.
function renderIcon(size, { maskable = false, bg = NAVY } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const art = maskable ? 0.5 : 1; // scale art for safe zone
  const cx = size / 2, cy = size / 2;
  const half = size * 0.21 * art;
  const inner = size * 0.085 * art;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r, g, b, a = 255;
      if (!maskable && roundedRectDist(x + 0.5, y + 0.5, size, radius) > 0) {
        a = 0; r = g = b = 0;
      } else {
        const d = diamondDist(x + 0.5, y + 0.5, cx, cy, half);
        const hole = diamondDist(x + 0.5, y + 0.5, cx, cy, inner);
        if (d <= 0.02 && hole > 0.02) { [r, g, b] = GOLD; }
        else if (!maskable && d > 0.02 && d < 0.12) { [r, g, b] = WHITE; }
        else { [r, g, b] = bg; }
      }
      const o = (y * size + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a;
    }
  }
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", renderIcon(192));
writeFileSync("public/icons/icon-512.png", renderIcon(512));
writeFileSync("public/icons/maskable-512.png", renderIcon(512, { maskable: true }));
writeFileSync("public/icons/apple-touch-icon.png", renderIcon(180));
console.log("icons written to public/icons/");

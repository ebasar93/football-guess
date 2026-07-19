// Generates assets/icon.png, assets/adaptive-icon.png and assets/splash.png
// (a simple football on a pitch-green background) with no image libraries.
//   node scripts/generate-assets.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pentagon(cx, cy, r, rotation) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = rotation + (i * 2 * Math.PI) / 5 - Math.PI / 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function drawBall(size, background) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const ballR = size * 0.34;
  const center = pentagon(cx, cy, ballR * 0.42, 0);
  // Outer pentagons peeking in from the ball's edge.
  const outer = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2 + Math.PI / 5;
    outer.push(
      pentagon(cx + ballR * 1.05 * Math.cos(a), cy + ballR * 1.05 * Math.sin(a), ballR * 0.38, a),
    );
  }
  const [bgR, bgG, bgB] = background;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      let r = bgR, g = bgG, b = bgB;
      if (d <= ballR) {
        const dark =
          inPolygon(x, y, center) || outer.some((p) => inPolygon(x, y, p));
        if (dark || d > ballR - size * 0.008) {
          r = 27; g = 27; b = 27; // panel / outline
        } else {
          r = 244; g = 251; b = 246; // ball white
        }
      }
      const o = (y * size + x) * 4;
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const pitch = [11, 61, 31]; // #0b3d1f
fs.writeFileSync(path.join(outDir, 'icon.png'), drawBall(1024, pitch));
fs.writeFileSync(path.join(outDir, 'adaptive-icon.png'), drawBall(1024, pitch));
fs.writeFileSync(path.join(outDir, 'splash.png'), drawBall(1024, pitch));
console.log('Assets written to', outDir);

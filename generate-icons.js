import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // Construct raw RGBA buffer
  const rowSize = width * 4;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  // Compress with deflate
  const compressed = zlib.deflateSync(rawData);

  // Build PNG chunks
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA (6)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(8 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);

  const crc = crc32(buffer.subarray(4, 8 + length));
  buffer.writeUInt32BE(crc, 8 + length);
  return buffer;
}

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve('public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const png = createPng(size, size, (x, y, w, h) => {
    // Center & radius
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 1;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Rounded app icon shape
    const cornerR = w * 0.22;
    const inBox = Math.abs(dx) <= (cx - cornerR) || Math.abs(dy) <= (cy - cornerR) ||
      Math.hypot(Math.abs(dx) - (cx - cornerR), Math.abs(dy) - (cy - cornerR)) <= cornerR;

    if (!inBox) {
      return [0, 0, 0, 0]; // Transparent
    }

    // Gradient background: Dark slate blue (#1E293B -> #0F172A)
    const t = y / h;
    const bgR = Math.round(30 * (1 - t) + 15 * t);
    const bgG = Math.round(41 * (1 - t) + 23 * t);
    const bgB = Math.round(59 * (1 - t) + 42 * t);

    // Center recording dot / wave ring
    const dotR = w * 0.22;
    if (dist <= dotR) {
      // Vivid recording red (#EF4444)
      return [239, 68, 68, 255];
    }

    // Outer subtle cyan/blue ring
    const ringR1 = w * 0.32;
    const ringR2 = w * 0.38;
    if (dist >= ringR1 && dist <= ringR2) {
      return [59, 130, 246, 200]; // Blue 500
    }

    return [bgR, bgG, bgB, 255];
  });

  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png`);
});

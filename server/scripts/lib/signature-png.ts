import zlib from 'node:zlib';

/**
 * Draws a handwriting-like squiggle and encodes it as a transparent PNG, so the
 * seed data and tests have realistic signature images without shipping binaries.
 * Purely illustrative: it is not meant to resemble anyone's real signature.
 */
export function renderSignaturePng(seedText: string, width = 420, height = 140): Buffer {
  const pixels = new Uint8Array(width * height * 4);
  const ink = [30, 41, 99]; // dark navy

  // Deterministic pseudo-random numbers from the seed text.
  let state = [...seedText].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 2166136261) || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10_000) / 10_000;
  };

  const plot = (cx: number, cy: number, radius: number) => {
    const x0 = Math.max(0, Math.floor(cx - radius - 1));
    const x1 = Math.min(width - 1, Math.ceil(cx + radius + 1));
    const y0 = Math.max(0, Math.floor(cy - radius - 1));
    const y1 = Math.min(height - 1, Math.ceil(cy + radius + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const coverage = Math.min(1, Math.max(0, radius + 0.5 - Math.hypot(x - cx, y - cy)));
        if (coverage <= 0) continue;
        const i = (y * width + x) * 4;
        pixels[i] = ink[0]!;
        pixels[i + 1] = ink[1]!;
        pixels[i + 2] = ink[2]!;
        pixels[i + 3] = Math.max(pixels[i + 3]!, Math.round(coverage * 255));
      }
    }
  };

  const stroke = (points: Array<[number, number]>, radius: number) => {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1]!;
      const [bx, by] = points[i]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.6));
      for (let s = 0; s <= steps; s++) plot(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps, radius);
    }
  };

  // Cursive body: slanted loops of varying height and width, starting with a big "capital".
  const letters = Math.min(9, Math.max(5, seedText.replace(/\W/g, '').length));
  const baseline = height * 0.68;
  const baseWidth = (width - 130) / letters;
  const body: Array<[number, number]> = [];
  let cursor = 34;
  for (let letter = 0; letter < letters; letter++) {
    const size = letter === 0 ? 2.1 : 0.45 + rand() * 1.3;
    const advance = baseWidth * (letter === 0 ? 1.25 : 0.7 + rand() * 0.6);
    const r = 12 * size;
    for (let u = 0; u <= 2 * Math.PI; u += 0.03) {
      const y = baseline - r * (1 - Math.cos(u)) * 0.85;
      const x = cursor + advance * (u / (2 * Math.PI)) - r * 0.55 * Math.sin(u);
      body.push([x + (baseline - y) * 0.32, y]);
    }
    cursor += advance;
  }
  stroke(body, 1.7);

  // Underline flourish sweeping back under the name.
  const [endX, endY] = body.at(-1)!;
  const flourish: Array<[number, number]> = [];
  for (let t = 0; t <= 1; t += 0.01) {
    const x = (1 - t) ** 2 * endX + 2 * (1 - t) * t * (endX + 30) + t ** 2 * 30;
    const y = (1 - t) ** 2 * endY + 2 * (1 - t) * t * (height - 8) + t ** 2 * (baseline + 22);
    flourish.push([x, y]);
  }
  stroke(flourish, 1.3);

  return encodePng(width, height, pixels);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    typeAndData.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(typeAndData), 8 + data.length);
    return out;
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // compression, filter and interlace stay 0

  const rowLength = width * 4;
  const raw = Buffer.alloc((rowLength + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowLength + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * rowLength, rowLength).copy(raw, y * (rowLength + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

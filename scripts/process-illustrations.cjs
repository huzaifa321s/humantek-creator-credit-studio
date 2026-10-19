const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = 'C:/Users/Humantek Morning/.gemini/antigravity/brain/9742c919-c52c-4c60-be33-768ca231e829';
const OUT = path.join(__dirname, '..', 'public', 'illustrations');
const files = {
  'empty-projects': 'empty_projects_1792396454681.jpg',
  'empty-wallet': 'empty_wallet_1792396481474.jpg',
  'empty-messages': 'empty_messages_1792396537609.jpg',
  'empty-notifications': 'empty_notifications_1792396564915.jpg',
  success: 'success_1792396589938.jpg',
};
const T = 238; // near-white threshold
const LENIENT = new Set((process.env.LENIENT || 'empty-projects').split(','));
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, file] of Object.entries(files)) {
    if (ONLY && !ONLY.has(name)) continue;
    const { data, info } = await sharp(path.join(SRC, file))
      .resize(512, 512, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    // Lenient mode: after the standard cutout, drop detached low-saturation blobs (baked shadow)
    const lenient = LENIENT.has(name);
    const isBg = (i) => data[i] >= T && data[i + 1] >= T && data[i + 2] >= T;
    const seen = new Uint8Array(w * h);
    const queue = [];
    const push = (x, y) => {
      const p = y * w + x;
      if (!seen[p] && isBg(p * 4)) {
        seen[p] = 1;
        queue.push(p);
      }
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (queue.length) {
      const p = queue.pop();
      const x = p % w, y = (p / w) | 0;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
    for (let p = 0; p < w * h; p++) if (seen[p]) data[p * 4 + 3] = 0;
    // feather the cutout edge with a lightly blurred binary mask
    const mask = Buffer.alloc(w * h);
    for (let p = 0; p < w * h; p++) mask[p] = seen[p] ? 0 : 255;
    if (lenient) {
      // Remove detached, low-saturation components (the baked ground shadow)
      const comp = new Int32Array(w * h).fill(-1);
      const stats = [];
      for (let s = 0; s < w * h; s++) {
        if (!mask[s] || comp[s] !== -1) continue;
        const id = stats.length;
        let area = 0, satSum = 0;
        const stack = [s];
        comp[s] = id;
        while (stack.length) {
          const p = stack.pop();
          area++;
          const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          satSum += mx ? (mx - mn) / mx : 0;
          const x = p % w, y = (p / w) | 0;
          const nb = [];
          if (x > 0) nb.push(p - 1);
          if (x < w - 1) nb.push(p + 1);
          if (y > 0) nb.push(p - w);
          if (y < h - 1) nb.push(p + w);
          for (const q of nb) if (mask[q] && comp[q] === -1) { comp[q] = id; stack.push(q); }
        }
        stats.push({ area, sat: satSum / area });
      }
      const maxArea = Math.max(...stats.map((c) => c.area));
      for (let p = 0; p < w * h; p++) {
        if (comp[p] < 0) continue;
        const c = stats[comp[p]];
        const keep = c.area >= maxArea * 0.25 || (c.sat > 0.3 && c.area >= 150);
        if (!keep) { mask[p] = 0; seen[p] = 1; data[p * 4 + 3] = 0; }
      }
    }
    if (lenient && name === 'empty-projects') {
      // Peel the pale glow surrounding the sparkle star: iteratively remove light,
      // low-saturation edge pixels, only inside the sparkle region (top-right).
      const x0 = Math.floor(w * 0.7), y1 = Math.floor(h * 0.5);
      for (let iter = 0; iter < 14; iter++) {
        const rm = [];
        for (let y = 1; y < y1; y++) {
          for (let x = x0; x < w - 1; x++) {
            const p = y * w + x;
            if (!mask[p]) continue;
            if (mask[p - 1] && mask[p + 1] && mask[p - w] && mask[p + w]) continue;
            const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            if (mx >= 200 && (mx - mn) / mx < 0.42) rm.push(p);
          }
        }
        if (!rm.length) break;
        for (const p of rm) { mask[p] = 0; seen[p] = 1; data[p * 4 + 3] = 0; }
      }
    }
    if (lenient) {
      // erode 1px: any pixel touching background becomes background (kills light fringe)
      const eroded = Buffer.from(mask);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const p = y * w + x;
          if (mask[p] && (!mask[p - 1] || !mask[p + 1] || !mask[p - w] || !mask[p + w])) eroded[p] = 0;
        }
      }
      for (let p = 0; p < w * h; p++) { mask[p] = eroded[p]; seen[p] = eroded[p] ? 0 : 1; }
    }
    const blurred = await sharp(mask, { raw: { width: w, height: h, channels: 1 } })
      .blur(0.7)
      .extractChannel(0)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const stride = blurred.info.channels;
    for (let p = 0; p < w * h; p++) data[p * 4 + 3] = seen[p] ? 0 : blurred.data[p * stride];
    const outFile = path.join(OUT, name + '.webp');
    await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .trim()
      .extend({ top: 14, bottom: 14, left: 14, right: 14, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80, alphaQuality: 90 })
      .toFile(outFile);
    console.log(name, fs.statSync(outFile).size, 'bytes');
  }
}
run().catch((e) => { console.error(e); process.exit(1); });

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

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, file] of Object.entries(files)) {
    const { data, info } = await sharp(path.join(SRC, file))
      .resize(512, 512, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
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
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80, alphaQuality: 90 })
      .toFile(outFile);
    console.log(name, fs.statSync(outFile).size, 'bytes');
  }
}
run().catch((e) => { console.error(e); process.exit(1); });

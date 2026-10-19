// One-off: generates logo + favicon assets from public/humantekart-38-300x115.webp
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SRC = path.join(root, 'public', 'humantekart-38-300x115.webp');
const BRAND = path.join(root, 'public', 'brand');
const APP = path.join(root, 'src', 'app');
fs.mkdirSync(BRAND, { recursive: true });

// Minimal ICO writer embedding PNG images (supported by all modern browsers)
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

async function run() {
  // 1. Full logo: trimmed, transparent, upscaled 3x for crisp display + PDF
  const trimmed = await sharp(SRC).trim().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const logoPng = await sharp(trimmed)
    .resize(meta.width * 3, meta.height * 3, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(BRAND, 'logo.png'), logoPng);
  await sharp(logoPng).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(BRAND, 'logo.webp'));

  // Light variant for dark surfaces: near-black letter fill -> white, yellow outline kept
  {
    const { data, info } = await sharp(logoPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) {
        data[i] = data[i + 1] = data[i + 2] = 255;
      }
    }
    const lightPng = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(BRAND, 'logo-light.png'), lightPng);
    await sharp(lightPng).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(BRAND, 'logo-light.webp'));
  }

  // 2. Icon mark: whole logo on a TRANSPARENT square (no background tile)
  const artCrop = trimmed;

  async function tile(size) {
    const pad = Math.round(size * 0.04);
    const inner = size - pad * 2;
    return sharp(artCrop)
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }

  fs.writeFileSync(path.join(BRAND, 'icon-512.png'), await tile(512));
  fs.writeFileSync(path.join(APP, 'icon.png'), await tile(512));
  fs.writeFileSync(path.join(APP, 'apple-icon.png'), await tile(180));
  const ico = buildIco([
    { size: 16, buf: await tile(16) },
    { size: 32, buf: await tile(32) },
    { size: 48, buf: await tile(48) },
  ]);
  fs.writeFileSync(path.join(APP, 'favicon.ico'), ico);
  console.log('brand assets generated');
}
run().catch((e) => { console.error(e); process.exit(1); });

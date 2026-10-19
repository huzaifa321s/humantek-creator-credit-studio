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

  // 2. Icon mark: the "ART" part (bottom ~58% of logo) on a rounded dark tile
  const m = await sharp(trimmed).metadata();
  const artCrop = trimmed;

  async function tile(size) {
    const pad = Math.round(size * 0.12);
    const inner = size - pad * 2;
    const art = await sharp(artCrop)
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    const radius = Math.round(size * 0.22);
    const bg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBBF24"/><stop offset="1" stop-color="#F59E0B"/></linearGradient></defs><rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/></svg>`
    );
    return sharp(bg)
      .composite([{ input: art, gravity: 'center' }])
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

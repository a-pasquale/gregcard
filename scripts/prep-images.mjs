#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const SRC_BASE = path.join(
  REPO_ROOT,
  '_backup/backup-5.6.2026_09-16-34_gregcard/homedir/public_html/images'
);
const DEST_BASE = path.join(REPO_ROOT, 'public/images');
const FOLIO_JSON = path.join(REPO_ROOT, 'src/data/folio.json');

// Renditions that are raw-copied from source (no transformation).
const COPY_RENDITIONS = ['small', 'large'];

// Thumb output suffix is hardcoded — we always generate from small/, never from source thumbs.
const THUMB_SUFFIX = 'thm.jpg';

async function copyOne(srcDir, destDir, filename) {
  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(path.join(srcDir, filename), path.join(destDir, filename));
}

async function main() {
  const folio = JSON.parse(await fs.readFile(FOLIO_JSON, 'utf8'));
  const stems = new Set();
  for (const w of folio) {
    stems.add(w.image_root);
    if (w.image2_root) stems.add(w.image2_root);
  }

  // Discover suffixes for copy renditions (small, large) by sampling source directories.
  const suffixes = {};
  for (const r of COPY_RENDITIONS) {
    const files = await fs.readdir(path.join(SRC_BASE, r));
    const f = files.find((x) => /^[a-z]{2}\d{2}_\d{4}.*\.(jpg|gif)$/.test(x));
    if (!f) throw new Error(`no jpg/gif in ${r}/`);
    suffixes[r] = f.replace(/^[a-z]{2}\d{2}_\d{4}/, '');
  }

  const sharp = (await import('sharp')).default;
  let copied = 0;
  const missing = [];

  for (const stem of stems) {
    // --- small and large: raw byte copy ---
    for (const r of COPY_RENDITIONS) {
      const srcFilename = `${stem}${suffixes[r]}`;
      const srcPath = path.join(SRC_BASE, r, srcFilename);
      const destDir = path.join(DEST_BASE, r);
      try {
        await fs.access(srcPath);
        await copyOne(path.join(SRC_BASE, r), destDir, srcFilename);
        copied++;
      } catch {
        missing.push(`${r}/${srcFilename}`);
      }
    }

    // --- thumb: always regenerate from small/ at 600px wide ---
    const smallSuffix = suffixes.small;
    const smallFilename = `${stem}${smallSuffix}`;
    const smallPath = path.join(DEST_BASE, 'small', smallFilename);
    const thumbFilename = `${stem}${THUMB_SUFFIX}`;
    const thumbPath = path.join(DEST_BASE, 'thumb', thumbFilename);
    try {
      await fs.access(smallPath);
      await fs.mkdir(path.join(DEST_BASE, 'thumb'), { recursive: true });
      await sharp(smallPath)
        .resize({ width: 600, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(thumbPath);
      copied++;
    } catch {
      missing.push(`thumb/${thumbFilename}`);
    }
  }

  console.log(`processed ${copied} files; ${missing.length} missing`);
  console.log(`suffixes: ${JSON.stringify(suffixes)}`);
  if (missing.length) {
    console.error('MISSING:');
    missing.forEach((m) => console.error('  ', m));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

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

const RENDITIONS = ['thumb', 'small', 'large'];

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

  // Discover suffixes per rendition by sampling the source directory.
  // Thumbs in the source are .gif; we'll detect both jpg and gif.
  const suffixes = {};
  for (const r of RENDITIONS) {
    const files = await fs.readdir(path.join(SRC_BASE, r));
    const f = files.find((x) => /^[a-z]{2}\d{2}_\d{4}.*\.(jpg|gif)$/.test(x));
    if (!f) throw new Error(`no jpg/gif in ${r}/`);
    suffixes[r] = f.replace(/^[a-z]{2}\d{2}_\d{4}/, '');
  }

  let copied = 0;
  const missing = [];
  for (const stem of stems) {
    for (const r of RENDITIONS) {
      const srcFilename = `${stem}${suffixes[r]}`;
      const srcPath = path.join(SRC_BASE, r, srcFilename);
      // Output is always .jpg — strip any .gif extension and replace with .jpg
      const destFilename = srcFilename.replace(/\.gif$/, '.jpg');
      const destPath = path.join(DEST_BASE, r, destFilename);
      try {
        await fs.access(srcPath);
        const destDir = path.join(DEST_BASE, r);
        if (srcFilename === destFilename) {
          // Direct copy — same extension
          await copyOne(path.join(SRC_BASE, r), destDir, srcFilename);
        } else {
          // Convert gif → jpg via sharp
          const sharp = (await import('sharp')).default;
          await fs.mkdir(destDir, { recursive: true });
          await sharp(srcPath).jpeg({ quality: 85 }).toFile(destPath);
        }
        copied++;
      } catch {
        missing.push(`${r}/${destFilename}`);
      }
    }
  }

  // If any files are still missing, try regenerating thumbs from small/ via sharp.
  const stillMissing = [];
  if (missing.length > 0) {
    const sharp = (await import('sharp')).default;
    for (const m of missing) {
      if (!m.startsWith('thumb/')) { stillMissing.push(m); continue; }
      const filename = m.slice('thumb/'.length);
      const stem = filename.replace(/\.jpg$/, '').replace(/(thm|tnl)$/, '');
      const smallSuffix = suffixes.small;
      const smallFilename = `${stem}${smallSuffix}`;
      const smallPath = path.join(SRC_BASE, 'small', smallFilename);
      const destPath = path.join(DEST_BASE, 'thumb', filename);
      try {
        await fs.access(smallPath);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await sharp(smallPath).resize({ width: 300, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(destPath);
        copied++;
        console.log(`  generated thumb from small: ${filename}`);
      } catch {
        stillMissing.push(m);
      }
    }
  }

  console.log(`copied ${copied} files; ${stillMissing.length} still missing`);
  console.log(`suffixes: ${JSON.stringify(suffixes)}`);
  if (stillMissing.length) {
    console.error('MISSING:');
    stillMissing.forEach((m) => console.error('  ', m));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

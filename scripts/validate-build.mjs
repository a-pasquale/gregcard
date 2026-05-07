#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'dist');
const FOLIO_JSON = path.join(REPO_ROOT, 'src/data/folio.json');
const REDIRECTS = path.join(DIST, '_redirects');

const errors = [];
function err(msg) { errors.push(msg); }

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function checkSlugsUnique() {
  const folio = JSON.parse(await fs.readFile(FOLIO_JSON, 'utf8'));
  const seen = new Set();
  for (const w of folio) {
    if (seen.has(w.slug)) err(`duplicate slug: ${w.slug}`);
    seen.add(w.slug);
  }
  console.log(`✓ all ${folio.length} slugs unique`);
}

async function checkWorkPagesExist() {
  const folio = JSON.parse(await fs.readFile(FOLIO_JSON, 'utf8'));
  for (const w of folio) {
    const p = path.join(DIST, 'folio', `${w.slug}.html`);
    if (!(await fileExists(p))) err(`missing work page: ${path.relative(DIST, p)}`);
  }
  console.log(`✓ ${folio.length} work pages exist`);
}

async function checkImagesExist() {
  const folio = JSON.parse(await fs.readFile(FOLIO_JSON, 'utf8'));
  const SUFFIX = { thumb: 'thm', small: 'sml', large: 'lrg' };
  for (const w of folio) {
    for (const r of ['thumb', 'small', 'large']) {
      const p = path.join(DIST, 'images', r, `${w.image_root}${SUFFIX[r]}.jpg`);
      if (!(await fileExists(p))) err(`missing image: ${path.relative(DIST, p)}`);
    }
    if (w.image2_root) {
      for (const r of ['thumb', 'small', 'large']) {
        const p = path.join(DIST, 'images', r, `${w.image2_root}${SUFFIX[r]}.jpg`);
        if (!(await fileExists(p))) err(`missing image2: ${path.relative(DIST, p)}`);
      }
    }
  }
  console.log(`✓ all images exist`);
}

async function checkRedirectTargets() {
  const lines = (await fs.readFile(REDIRECTS, 'utf8')).split('\n');
  const checked = new Set();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    // Forms:
    //   /from /to 301
    //   /from query=val /to 301
    //   /from query=val /to 301!
    let to;
    // Find the destination — it's the first part starting with `/` after the source
    if (parts[1] && parts[1].startsWith('/')) {
      to = parts[1];
    } else if (parts[2] && parts[2].startsWith('/')) {
      // Query-param form: /from query=val /to status
      to = parts[2];
    }
    if (!to) continue;
    if (to.startsWith('http')) continue;
    const targetPath = to.split('#')[0].replace(/^\//, '');
    if (checked.has(targetPath)) continue;
    checked.add(targetPath);
    const candidates = [
      path.join(DIST, targetPath),
      path.join(DIST, targetPath, 'index.html'),
      path.join(DIST, `${targetPath}.html`),
      ...(targetPath === '' ? [path.join(DIST, 'index.html')] : []),
    ];
    let found = false;
    for (const c of candidates) {
      if (await fileExists(c)) { found = true; break; }
    }
    if (!found) err(`redirect target does not exist: ${to}`);
  }
  console.log(`✓ all redirect targets resolve`);
}

async function checkCorePages() {
  const required = [
    'index.html',
    'folio.html',
    'biography.html',
    'bibliography.html',
    'writings.html',
    'intro.html',
    'links.html',
    'contact.html',
    '404.html',
  ];
  for (const f of required) {
    if (!(await fileExists(path.join(DIST, f)))) err(`missing core page: ${f}`);
  }
  console.log(`✓ all core pages built`);
}

async function main() {
  await checkSlugsUnique();
  await checkWorkPagesExist();
  await checkImagesExist();
  await checkCorePages();
  await checkRedirectTargets();

  if (errors.length) {
    console.error('\nBUILD VALIDATION FAILED:');
    errors.forEach((e) => console.error('  ✗', e));
    process.exit(1);
  }
  console.log('\nAll build validations passed.');
}

main().catch((err) => { console.error(err); process.exit(1); });

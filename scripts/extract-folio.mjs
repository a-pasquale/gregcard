#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugifyWork } from '../src/lib/slugify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const SQL_PATH = path.join(
  REPO_ROOT,
  '_backup/backup-5.6.2026_09-16-34_gregcard/mysql/gregcard_gscard.sql'
);
const OUT_PATH = path.join(REPO_ROOT, 'src/data/folio.json');

const COLUMNS = [
  'id', 'ref', 'image_root', 'image2_root',
  'small_width', 'small_height', 'large_width', 'large_height',
  'available', 'title', 'medium', 'description',
  'decade', 'the_year', 'dimensions',
];

// Tokenizer: walk a tuple body, splitting on top-level commas, respecting single-quoted strings
// (escape sequences in this dump are MySQL-style: \\, \', \", but no embedded unescaped quotes).
function tokenizeTuple(body) {
  const tokens = [];
  let buf = '';
  let inStr = false;
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (inStr) {
      if (c === '\\' && i + 1 < body.length) {
        buf += c + body[i + 1];
        i += 2;
        continue;
      }
      if (c === "'") {
        inStr = false;
        buf += c;
        i++;
        continue;
      }
      buf += c;
      i++;
      continue;
    }
    if (c === "'") {
      inStr = true;
      buf += c;
      i++;
      continue;
    }
    if (c === ',') {
      tokens.push(buf.trim());
      buf = '';
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  if (buf.length) tokens.push(buf.trim());
  return tokens;
}

function unquoteString(token) {
  if (token.length >= 2 && token.startsWith("'") && token.endsWith("'")) {
    return token.slice(1, -1).replace(/\\'/g, "'");
  }
  return token;
}

export function parseFolioRow(tuple) {
  // Tuple looks like: (2,146,'sc80_0146','',...)
  const trimmed = tuple.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
    throw new Error(`malformed tuple: ${trimmed.slice(0, 60)}`);
  }
  const body = trimmed.slice(1, -1);
  const tokens = tokenizeTuple(body);
  if (tokens.length !== COLUMNS.length) {
    throw new Error(`expected ${COLUMNS.length} columns, got ${tokens.length}: ${trimmed.slice(0, 80)}`);
  }
  const row = {};
  COLUMNS.forEach((col, idx) => {
    const tok = tokens[idx];
    if (['id', 'ref', 'small_width', 'small_height', 'large_width', 'large_height', 'available', 'decade'].includes(col)) {
      row[col] = parseInt(tok, 10);
    } else {
      row[col] = unquoteString(tok);
    }
  });
  return row;
}

export function parseFolioSql(sql) {
  // Find the INSERT INTO `folio` ... VALUES (...),(...),...; statement
  const insertMatch = sql.match(/INSERT INTO `folio`[^;]+VALUES\s+([\s\S]+?);/);
  if (!insertMatch) throw new Error('no INSERT INTO folio found in dump');
  const valuesBlock = insertMatch[1];
  // Split on `),(`-style boundaries by walking with parenthesis balance and string-awareness
  const tuples = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  for (let i = 0; i < valuesBlock.length; i++) {
    const c = valuesBlock[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === "'") inStr = false;
      continue;
    }
    if (c === "'") { inStr = true; continue; }
    if (c === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === ')') {
      depth--;
      if (depth === 0 && start !== -1) {
        tuples.push(valuesBlock.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return tuples.map(parseFolioRow);
}

function buildFolioJson(rows) {
  // Compute slugs with collision handling
  const slugCounts = new Map();
  rows.forEach((r) => {
    const base = slugifyWork(r.title, r.the_year);
    slugCounts.set(base, (slugCounts.get(base) || 0) + 1);
  });
  return rows.map((r) => {
    const base = slugifyWork(r.title, r.the_year);
    let slug = base;
    if (slugCounts.get(base) > 1) {
      // Append image_root with dash for uniqueness
      slug = `${base}-${r.image_root.replace('_', '-')}`;
    }
    return {
      id: r.id,
      slug,
      title: r.title,
      year: r.the_year,
      decade: r.decade,
      medium: r.medium,
      description: r.description,
      dimensions: r.dimensions,
      image_root: r.image_root,
      image2_root: r.image2_root || null,
      small: { width: r.small_width, height: r.small_height },
      large: { width: r.large_width, height: r.large_height },
      available: Boolean(r.available),
    };
  });
}

async function main() {
  const sql = await fs.readFile(SQL_PATH, 'utf8');
  const rows = parseFolioSql(sql);
  const folio = buildFolioJson(rows);

  // Sanity assertions
  if (folio.length !== 228) {
    throw new Error(`expected 228 works, got ${folio.length}`);
  }
  const slugs = new Set();
  for (const w of folio) {
    if (slugs.has(w.slug)) throw new Error(`duplicate slug: ${w.slug}`);
    slugs.add(w.slug);
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(folio, null, 2) + '\n', 'utf8');
  console.log(`wrote ${folio.length} works → ${path.relative(REPO_ROOT, OUT_PATH)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

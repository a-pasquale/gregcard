# Greg Card Archive Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a long-lived archival static site for Greg Card's body of work (1963–2003) using Astro, deployed to Netlify, replacing the legacy PHP site at gregcard.com.

**Architecture:** Astro static site generator reads structured content (JSON for the 227-work folio, MDX for essays) extracted once from a cPanel backup of the legacy site, generates one HTML page per work and per content page at build time, deploys to Netlify with `_redirects` mapping every legacy URL (`folio.php?…`, `intro.html`, `popup.php?image=…`, etc.) to its new home. Output is plain static HTML/CSS/images — no runtime server, no database, minimal JS.

**Tech Stack:** Astro 4.x, Node 20+, Netlify static hosting, Sharp (Astro image pipeline), self-hosted Crimson Pro + Inter fonts.

**Spec:** `docs/superpowers/specs/2026-05-06-gregcard-archive-design.md`

**Source backup:** `_backup/backup-5.6.2026_09-16-34_gregcard/` (already extracted in working directory).

---

## Repository File Structure

Files created across all tasks:

```
gregscard/
├── .gitignore
├── README.md
├── package.json
├── astro.config.mjs
├── tsconfig.json
├── netlify.toml
├── docs/superpowers/
│   ├── specs/2026-05-06-gregcard-archive-design.md   (already exists)
│   └── plans/2026-05-06-gregcard-archive.md          (this file)
├── scripts/
│   ├── extract-folio.mjs            # SQL → folio.json
│   ├── extract-biography.mjs        # biog_*.html → biography.json
│   ├── extract-essays.mjs           # essay HTML → MDX
│   ├── prep-images.mjs              # backup images → public/images/
│   ├── generate-redirects.mjs       # folio.json → public/_redirects entries
│   └── validate-build.mjs           # post-build assertions
├── tests/
│   ├── extract-folio.test.mjs
│   ├── slugify.test.mjs
│   └── parse-dimensions.test.mjs
├── src/
│   ├── data/
│   │   ├── folio.json               # generated, committed
│   │   ├── biography.json           # generated, committed
│   │   └── bibliography.json        # generated, committed
│   ├── content/
│   │   ├── config.ts
│   │   └── writings/                # generated MDX files, committed
│   ├── lib/
│   │   ├── slugify.mjs              # shared slug logic
│   │   ├── parse-dimensions.mjs     # shared dimension parser
│   │   └── folio.ts                 # data accessors
│   ├── layouts/
│   │   └── Base.astro
│   ├── components/
│   │   ├── Nav.astro
│   │   ├── Footer.astro
│   │   ├── FolioTimeline.astro
│   │   ├── FolioCard.astro
│   │   ├── WorkMeta.astro
│   │   └── FilterPills.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── intro.astro
│   │   ├── folio/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── biography.astro
│   │   ├── bibliography.astro
│   │   ├── writings/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── links.astro
│   │   ├── contact.astro
│   │   └── 404.astro
│   └── styles/
│       └── global.css
└── public/
    ├── images/{thumb,small,large}/  # copied from backup
    ├── fonts/                        # self-hosted woff2
    └── _redirects                    # generated, committed
```

---

## Task 1: Initialize repository and Astro project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `README.md`, `src/pages/index.astro`, `src/styles/global.css`

- [ ] **Step 1: Initialize git and ignore the backup tarball + extracted backup folder**

```bash
cd /Users/drew/Sites/gregscard
git init
```

Create `.gitignore`:

```
# Dependencies
node_modules/

# Build output
dist/
.astro/

# Backup (large; not source-of-truth for git)
_backup/
backup-*.tar.gz

# Visual companion artifacts
.superpowers/

# Editor / OS
.DS_Store
.vscode/
.idea/
*.swp

# Env
.env
.env.*
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "gregscard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "node scripts/generate-redirects.mjs && astro build && node scripts/validate-build.mjs",
    "preview": "astro preview",
    "test": "node --test tests/",
    "extract": "node scripts/extract-folio.mjs && node scripts/extract-biography.mjs && node scripts/extract-essays.mjs && node scripts/prep-images.mjs"
  },
  "dependencies": {
    "astro": "^4.16.0",
    "@astrojs/mdx": "^3.1.0",
    "@astrojs/sitemap": "^3.2.0",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 3: Create `astro.config.mjs`**

```javascript
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://gregcard.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [mdx(), sitemap()],
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
});
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "_backup", "node_modules"]
}
```

- [ ] **Step 5: Create minimal `src/pages/index.astro` and `src/styles/global.css`**

`src/pages/index.astro`:

```astro
---
import '../styles/global.css';
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Greg Card</title>
  </head>
  <body>
    <main>
      <h1>Greg Card</h1>
      <p>Site under construction.</p>
    </main>
  </body>
</html>
```

`src/styles/global.css`:

```css
:root {
  --bg: #fbfaf7;
  --text: #1a1a1a;
  --muted: #7a7368;
  --rule: #e8e4dc;
  --accent: #5d4f3f;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
}
```

Create a minimal `README.md`:

```markdown
# gregcard.com archive

Static archival site for Greg Card's body of work (1963–2003).
Built with Astro, deployed to Netlify.

## Development
- `npm install`
- `npm run extract` (one-time, after backup is in place)
- `npm run dev` → http://localhost:4321

## Build
- `npm run build` produces `dist/`

See `docs/superpowers/specs/` for the design spec and `docs/superpowers/plans/` for the implementation plan.
```

- [ ] **Step 6: Install and verify build**

```bash
npm install
npm run build
```

Expected: Build completes; `dist/index.html` exists. (`generate-redirects.mjs` and `validate-build.mjs` don't exist yet — temporarily simplify the build script for this step.)

For this initial verification only, edit `package.json` `build` to just `astro build`, then restore it to the full pipeline after Task 11 (where the validators come online).

- [ ] **Step 7: Commit**

```bash
git add .gitignore README.md package.json package-lock.json astro.config.mjs tsconfig.json src/pages/index.astro src/styles/global.css docs/
git commit -m "scaffold: initialize Astro project with archival design tokens"
```

---

## Task 2: Shared slugify library + tests

**Files:**
- Create: `src/lib/slugify.mjs`, `tests/slugify.test.mjs`

- [ ] **Step 1: Write failing test `tests/slugify.test.mjs`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, slugifyWork } from '../src/lib/slugify.mjs';

test('slugify lowercases and dashes ASCII', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
});

test('slugify removes apostrophes and quotes', () => {
  assert.equal(slugify("Mass-Con's Title"), 'mass-cons-title');
});

test('slugify collapses whitespace and punctuation runs', () => {
  assert.equal(slugify('  Above & Beyond  '), 'above-beyond');
});

test('slugify handles parenthetical', () => {
  assert.equal(
    slugify('All Airline Everything (two cylinder paintings shown)'),
    'all-airline-everything-two-cylinder-paintings-shown'
  );
});

test('slugify handles em-dash and unicode', () => {
  assert.equal(slugify('Frame of Reference — 30th scale'), 'frame-of-reference-30th-scale');
});

test('slugifyWork combines title and first year', () => {
  assert.equal(slugifyWork('Dyad', '1980'), 'dyad-1980');
});

test('slugifyWork uses first year of range', () => {
  assert.equal(slugifyWork('Act of Squared Reflection', '1976-80'), 'act-of-squared-reflection-1976');
});

test('slugifyWork handles 4-digit hyphenated year', () => {
  assert.equal(slugifyWork('Double Vision', '1979-1980'), 'double-vision-1979');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern slugify
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/slugify.mjs`**

```javascript
export function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')         // strip combining marks
    .toLowerCase()
    .replace(/['']/g, '')                     // drop apostrophes
    .replace(/[^a-z0-9]+/g, '-')              // non-alphanum → dash
    .replace(/^-+|-+$/g, '');                 // trim leading/trailing dashes
}

export function slugifyWork(title, theYear) {
  const firstYear = String(theYear).match(/\d{4}/)?.[0] ?? 'unknown';
  return `${slugify(title)}-${firstYear}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --test-name-pattern slugify
```

Expected: 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slugify.mjs tests/slugify.test.mjs
git commit -m "feat(lib): slugify and slugifyWork helpers with tests"
```

---

## Task 3: Dimension parser library + tests

**Files:**
- Create: `src/lib/parse-dimensions.mjs`, `tests/parse-dimensions.test.mjs`

The DB stores dimensions as escaped strings like `60\"h X 70.75\"w X 10\"d` or `21.75\" diam.`. We need two functions:
1. `normalizeDimensions(raw)` — for display: replaces `\"` with `″` and `X` with `×`.
2. `parseDimensions(raw)` — for JSON-LD: returns `{height, width}` in inches if a clean h×w pattern matches, else `null`.

- [ ] **Step 1: Write failing test `tests/parse-dimensions.test.mjs`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDimensions, parseDimensions } from '../src/lib/parse-dimensions.mjs';

test('normalizeDimensions replaces escaped quotes with prime', () => {
  assert.equal(normalizeDimensions('60\\"h X 70.75\\"w X 10\\"d'), '60″h × 70.75″w × 10″d');
});

test('normalizeDimensions handles diameter notation', () => {
  assert.equal(normalizeDimensions('21.75\\" diam.'), '21.75″ diam.');
});

test('normalizeDimensions handles unescaped quotes', () => {
  assert.equal(normalizeDimensions('72"h X 60"w'), '72″h × 60″w');
});

test('normalizeDimensions returns empty string unchanged', () => {
  assert.equal(normalizeDimensions(''), '');
});

test('parseDimensions extracts h and w from canonical form', () => {
  assert.deepEqual(parseDimensions('60\\"h X 70.75\\"w X 10\\"d'), {
    height: 60,
    width: 70.75,
    unit: 'in',
  });
});

test('parseDimensions extracts h and w with no depth', () => {
  assert.deepEqual(parseDimensions('48\\"h X 36\\"w'), {
    height: 48,
    width: 36,
    unit: 'in',
  });
});

test('parseDimensions returns null for diameter-only', () => {
  assert.equal(parseDimensions('21.75\\" diam.'), null);
});

test('parseDimensions returns null for empty string', () => {
  assert.equal(parseDimensions(''), null);
});

test('parseDimensions returns null for unparseable string', () => {
  assert.equal(parseDimensions('various sizes'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern Dimensions
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/parse-dimensions.mjs`**

```javascript
export function normalizeDimensions(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/\\"/g, '″')
    .replace(/"/g, '″')
    .replace(/\s*X\s*/g, ' × ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HW_PATTERN = /(\d+(?:\.\d+)?)["″]?\s*h\s*[X×]\s*(\d+(?:\.\d+)?)["″]?\s*w/i;

export function parseDimensions(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\\"/g, '"');
  const m = cleaned.match(HW_PATTERN);
  if (!m) return null;
  return {
    height: parseFloat(m[1]),
    width: parseFloat(m[2]),
    unit: 'in',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --test-name-pattern Dimensions
```

Expected: 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parse-dimensions.mjs tests/parse-dimensions.test.mjs
git commit -m "feat(lib): dimension display normalizer and JSON-LD parser"
```

---

## Task 4: Folio extraction script + tests

**Files:**
- Create: `scripts/extract-folio.mjs`, `tests/extract-folio.test.mjs`
- Reads: `_backup/backup-5.6.2026_09-16-34_gregcard/mysql/gregcard_gscard.sql`
- Writes: `src/data/folio.json`

Strategy: parse INSERT VALUES tuples directly with a regex tuned for this dump (we control the dump, no need for a SQL parser).

- [ ] **Step 1: Write failing test `tests/extract-folio.test.mjs`**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFolioRow, parseFolioSql } from '../scripts/extract-folio.mjs';

test('parseFolioRow extracts canonical row fields', () => {
  const tuple = `(2,146,'sc80_0146','',288,329,437,500,0,'2-Side Slant','sculpture','acrylic, birch plywood, mirror',80,'1980','31.25\\"h X 25.25\\"w X 5\\"d')`;
  const row = parseFolioRow(tuple);
  assert.equal(row.id, 2);
  assert.equal(row.image_root, 'sc80_0146');
  assert.equal(row.image2_root, '');
  assert.equal(row.title, '2-Side Slant');
  assert.equal(row.medium, 'sculpture');
  assert.equal(row.description, 'acrylic, birch plywood, mirror');
  assert.equal(row.decade, 80);
  assert.equal(row.the_year, '1980');
  assert.equal(row.dimensions, '31.25\\"h X 25.25\\"w X 5\\"d');
  assert.equal(row.available, 0);
});

test('parseFolioRow handles row with image2_root', () => {
  const tuple = `(33,70,'pa02_0070','pa02_0002',267,354,377,500,1,'Hue-Scrip 6vrc','painting','acrylic colorshift on PVC',0,'2002','48\\"h X 36\\"w')`;
  const row = parseFolioRow(tuple);
  assert.equal(row.image2_root, 'pa02_0002');
  assert.equal(row.available, 1);
});

test('parseFolioRow handles title containing a comma', () => {
  const tuple = `(40,23,'pa69_0023','',282,336,419,500,0,'Mem-Com, right panel','painting','cast resin, fiberglass',60,'1969','72\\"h X 60\\"w')`;
  const row = parseFolioRow(tuple);
  assert.equal(row.title, 'Mem-Com, right panel');
  assert.equal(row.description, 'cast resin, fiberglass');
});

test('parseFolioSql returns 227 rows from the real backup', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const sql = await fs.readFile(
    path.resolve('_backup/backup-5.6.2026_09-16-34_gregcard/mysql/gregcard_gscard.sql'),
    'utf8'
  );
  const rows = parseFolioSql(sql);
  assert.equal(rows.length, 227);
  // Spot-check the first row
  assert.equal(rows[0].image_root, 'in68_0029');
  // Spot-check medium counts
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.medium]: (acc[r.medium] || 0) + 1 }), {});
  assert.equal(counts.painting, 106);
  assert.equal(counts.paper, 82);
  assert.equal(counts.sculpture, 18);
  assert.equal(counts.installation, 4);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern parseFolioRow
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/extract-folio.mjs`**

```javascript
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
  const slugUseCount = new Map();
  return rows.map((r) => {
    const base = slugifyWork(r.title, r.the_year);
    let slug = base;
    if (slugCounts.get(base) > 1) {
      // Append image_root with dash for uniqueness
      slug = `${base}-${r.image_root.replace('_', '-')}`;
    }
    slugUseCount.set(slug, (slugUseCount.get(slug) || 0) + 1);
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
  if (folio.length !== 227) {
    throw new Error(`expected 227 works, got ${folio.length}`);
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
```

- [ ] **Step 4: Run unit tests**

```bash
npm test -- --test-name-pattern parseFolioRow
npm test -- --test-name-pattern parseFolioSql
```

Expected: all PASS (4 tests).

- [ ] **Step 5: Run the script end-to-end**

```bash
node scripts/extract-folio.mjs
```

Expected output: `wrote 227 works → src/data/folio.json`.

Verify: `cat src/data/folio.json | head -40` shows JSON array of work objects with `slug`, `title`, etc.

- [ ] **Step 6: Commit**

```bash
git add scripts/extract-folio.mjs tests/extract-folio.test.mjs src/data/folio.json
git commit -m "feat(extract): parse SQL dump → folio.json with stable slugs (227 works)"
```

---

## Task 5: Image preparation script

**Files:**
- Create: `scripts/prep-images.mjs`
- Reads: `_backup/backup-5.6.2026_09-16-34_gregcard/homedir/public_html/images/{thumb,small,large}/`
- Writes: `public/images/{thumb,small,large}/`

- [ ] **Step 1: Implement `scripts/prep-images.mjs`**

```javascript
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
const SUFFIX = { thumb: 'tnl.jpg', small: 'sml.jpg', large: 'lrg.jpg' };

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

  // First confirm source filename suffix convention by listing one rendition.
  const sample = await fs.readdir(path.join(SRC_BASE, 'large'));
  const oneLarge = sample.find((f) => f.endsWith('.jpg'));
  if (!oneLarge) throw new Error('no .jpg files in source large/');
  const largeSuffix = oneLarge.replace(/^[a-z]{2}\d{2}_\d{4}/, ''); // e.g., 'lrg.jpg'

  // Discover suffixes per rendition
  const suffixes = {};
  for (const r of RENDITIONS) {
    const files = await fs.readdir(path.join(SRC_BASE, r));
    const f = files.find((x) => x.endsWith('.jpg'));
    if (!f) throw new Error(`no jpg in ${r}/`);
    suffixes[r] = f.replace(/^[a-z]{2}\d{2}_\d{4}/, '');
  }

  let copied = 0;
  const missing = [];
  for (const stem of stems) {
    for (const r of RENDITIONS) {
      const filename = `${stem}${suffixes[r]}`;
      const srcPath = path.join(SRC_BASE, r, filename);
      try {
        await fs.access(srcPath);
        await copyOne(path.join(SRC_BASE, r), path.join(DEST_BASE, r), filename);
        copied++;
      } catch {
        missing.push(`${r}/${filename}`);
      }
    }
  }

  console.log(`copied ${copied} files; ${missing.length} missing`);
  if (missing.length) {
    console.error('MISSING:');
    missing.forEach((m) => console.error('  ', m));
    process.exit(1);
  }
  console.log(`suffixes: ${JSON.stringify(suffixes)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script**

```bash
node scripts/prep-images.mjs
```

Expected output: `copied 702 files; 0 missing` (234 stems × 3 renditions = 702). Print of suffixes.

- [ ] **Step 3: Verify output**

```bash
ls public/images/large/ | wc -l
ls public/images/small/ | wc -l
ls public/images/thumb/ | wc -l
```

Expected: 234, 234, 234. (Note: spec said 231 thumbs originally — re-verify with this script. If thumbs come up short, that's data we need to know.)

- [ ] **Step 4: Handle thumb shortfall if any**

If thumbs come up short, the script will exit non-zero with the missing list. For each missing thumb, we have two options:

1. Skip those works in the folio grid (degraded).
2. Generate the missing thumb on-the-fly from `small/` using sharp.

Implement option 2 if needed. Add this block before the `console.log` in `main()`:

```javascript
// Auto-generate missing thumbs from small/ via sharp
import('sharp').then(async ({ default: sharp }) => {
  const stillMissing = [];
  for (const m of missing) {
    if (!m.startsWith('thumb/')) { stillMissing.push(m); continue; }
    const filename = m.slice('thumb/'.length);
    const stem = filename.replace(suffixes.thumb, '');
    const smallPath = path.join(SRC_BASE, 'small', `${stem}${suffixes.small}`);
    const destPath = path.join(DEST_BASE, 'thumb', filename);
    try {
      await fs.access(smallPath);
      await sharp(smallPath).resize({ width: 300, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(destPath);
      copied++;
    } catch (e) {
      stillMissing.push(m);
    }
  }
  // ...
});
```

(Implement only if Step 3 reports a shortfall.)

- [ ] **Step 5: Commit**

Note: do not commit the image bytes individually — they're large but bounded (~21 MB total). Acceptable for a tiny archive site repo. If repo size becomes a concern later, switch to Git LFS — but for ~700 files at ~21 MB total, plain git is fine.

```bash
git add scripts/prep-images.mjs public/images/
git commit -m "feat(prep): copy artwork renditions from backup to public/images/"
```

---

## Task 6: Base layout, nav, footer, global styles

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`
- Modify: `src/styles/global.css`, `src/pages/index.astro`

- [ ] **Step 1: Expand `src/styles/global.css` with the design-system tokens and base styles**

```css
:root {
  --bg: #fbfaf7;
  --text: #1a1a1a;
  --muted: #7a7368;
  --rule: #e8e4dc;
  --accent: #5d4f3f;
  --max-width-prose: 75ch;
  --max-width-folio: 1100px;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --space-5: 2rem;
  --space-6: 3rem;
  --space-7: 5rem;
  --font-serif: 'Crimson Pro', Georgia, 'Times New Roman', serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 17px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-family: var(--font-serif);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.005em;
  margin: 0 0 var(--space-3);
}

h1 { font-size: 2.25rem; }
h2 { font-size: 1.75rem; }
h3 { font-size: 1.25rem; }

p { margin: 0 0 var(--space-3); }

a { color: var(--text); text-decoration: underline; text-decoration-color: var(--rule); text-underline-offset: 3px; transition: text-decoration-color 0.15s; }
a:hover { text-decoration-color: var(--accent); }

a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 2px; }

img { max-width: 100%; height: auto; display: block; }

.label {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.muted { color: var(--muted); }

.container {
  max-width: var(--max-width-folio);
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.container-prose {
  max-width: var(--max-width-prose);
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  position: fixed;
  top: var(--space-2);
  left: var(--space-2);
  background: var(--text);
  color: var(--bg);
  padding: var(--space-2) var(--space-3);
  z-index: 100;
}
```

- [ ] **Step 2: Create `src/components/Nav.astro`**

```astro
---
const { current } = Astro.props;
const links = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/intro', label: 'Intro', key: 'intro' },
  { href: '/folio', label: 'Folio', key: 'folio' },
  { href: '/biography', label: 'Biography', key: 'biography' },
  { href: '/bibliography', label: 'Bibliography', key: 'bibliography' },
  { href: '/writings', label: 'Writings', key: 'writings' },
  { href: '/links', label: 'Links', key: 'links' },
  { href: '/contact', label: 'Contact', key: 'contact' },
];
---
<nav class="site-nav" aria-label="Primary">
  <a class="brand" href="/">Greg Card</a>
  <ul>
    {links.filter((l) => l.key !== 'home').map((l) => (
      <li><a href={l.href} aria-current={current === l.key ? 'page' : undefined}>{l.label}</a></li>
    ))}
  </ul>
</nav>

<style>
  .site-nav {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-3) var(--space-5);
    padding: var(--space-4) 0;
    border-bottom: 1px solid var(--rule);
    margin-bottom: var(--space-5);
  }
  .brand {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    text-decoration: none;
  }
  .site-nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-4);
    margin-left: auto;
  }
  .site-nav a {
    text-decoration: none;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .site-nav a[aria-current='page'] {
    color: var(--text);
  }
  .site-nav a:hover { color: var(--text); }
  @media (max-width: 640px) {
    .site-nav ul { margin-left: 0; }
  }
</style>
```

- [ ] **Step 3: Create `src/components/Footer.astro`**

```astro
---
const year = new Date().getFullYear();
---
<footer class="site-footer">
  <div class="container">
    <p class="label">© 2003 Greg Card. Copyright requests handled by the Artists' Rights Society (ARS) NY.</p>
    <p class="label">This site preserves the body of work 1963–2003. Last updated {year}.</p>
  </div>
</footer>

<style>
  .site-footer {
    margin-top: var(--space-7);
    padding: var(--space-5) 0;
    border-top: 1px solid var(--rule);
  }
  .site-footer p { margin: 0; }
  .site-footer p + p { margin-top: var(--space-2); }
</style>
```

- [ ] **Step 4: Create `src/layouts/Base.astro`**

```astro
---
import '../styles/global.css';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description?: string;
  current?: string;
  ogImage?: string;
  jsonLd?: object;
}

const {
  title,
  description = "Archive of Greg Card's body of work, 1963–2003.",
  current,
  ogImage,
  jsonLd,
} = Astro.props;

const fullTitle = title === 'Greg Card' ? title : `${title} — Greg Card`;
const canonical = new URL(Astro.url.pathname, Astro.site).toString();
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:type" content="website" />
    {ogImage && <meta property="og:image" content={ogImage} />}
    <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
    <title>{fullTitle}</title>
    {jsonLd && <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />}
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="container">
      <Nav current={current} />
    </div>
    <main id="main" class="container">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 5: Update `src/pages/index.astro` to use the layout (placeholder content for now)**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Greg Card" current="home" description="Greg Card · contemporary abstractions, 1963–2003.">
  <section class="hero">
    <p class="label">Contemporary abstractions</p>
    <h1>Greg Card</h1>
    <p class="muted">1963–2003</p>
    <p>An archive of paintings, sculpture, paper, and installations.</p>
    <p><a href="/folio">Enter the folio →</a></p>
  </section>
</Base>

<style>
  .hero {
    padding: var(--space-6) 0;
    max-width: var(--max-width-prose);
  }
</style>
```

- [ ] **Step 6: Verify dev server**

```bash
npm run dev
```

Visit http://localhost:4321 — page renders with nav, hero, footer. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/ src/components/ src/styles/global.css src/pages/index.astro
git commit -m "feat(layout): base layout, nav, footer, design tokens"
```

---

## Task 7: Folio data accessor library

**Files:**
- Create: `src/lib/folio.ts`

This is the typed accessor that pages use to query `folio.json`. Centralizing it keeps page templates simple and makes refactors safe.

- [ ] **Step 1: Create `src/lib/folio.ts`**

```typescript
import folio from '../data/folio.json';

export type Medium = 'painting' | 'paper' | 'sculpture' | 'installation';

export interface Work {
  id: number;
  slug: string;
  title: string;
  year: string;
  decade: number;
  medium: Medium;
  description: string;
  dimensions: string;
  image_root: string;
  image2_root: string | null;
  small: { width: number; height: number };
  large: { width: number; height: number };
  available: boolean;
}

const ALL: Work[] = folio as Work[];

export function getAllWorks(): Work[] {
  return ALL;
}

export function getWorkBySlug(slug: string): Work | undefined {
  return ALL.find((w) => w.slug === slug);
}

export function getAdjacentWorks(slug: string): { prev?: Work; next?: Work } {
  const sorted = sortChronological(ALL);
  const idx = sorted.findIndex((w) => w.slug === slug);
  if (idx === -1) return {};
  return {
    prev: idx > 0 ? sorted[idx - 1] : undefined,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : undefined,
  };
}

export function getRelatedWorks(work: Work, limit = 4): Work[] {
  // Same decade, same medium first; fall back to same medium, any decade.
  const sameBoth = ALL.filter(
    (w) => w.id !== work.id && w.medium === work.medium && w.decade === work.decade
  );
  const sameMedium = ALL.filter(
    (w) => w.id !== work.id && w.medium === work.medium && w.decade !== work.decade
  );
  return [...sameBoth, ...sameMedium].slice(0, limit);
}

export function sortChronological(works: Work[]): Work[] {
  // year DESC (newest first), title ASC; matches legacy `ORDER BY the_year DESC, title`
  return [...works].sort((a, b) => {
    const ay = parseFirstYear(a.year);
    const by = parseFirstYear(b.year);
    if (ay !== by) return by - ay;
    return a.title.localeCompare(b.title);
  });
}

function parseFirstYear(year: string): number {
  const m = year.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 0;
}

export function groupByDecade(works: Work[]): Array<{ decade: number; label: string; works: Work[] }> {
  const order = [0, 90, 80, 70, 60]; // 2000s first, 1960s last
  const map = new Map<number, Work[]>();
  for (const w of works) {
    const arr = map.get(w.decade) ?? [];
    arr.push(w);
    map.set(w.decade, arr);
  }
  return order
    .filter((d) => map.has(d))
    .map((d) => ({
      decade: d,
      label: d === 0 ? '2000s' : `19${d}s`,
      works: sortChronological(map.get(d)!),
    }));
}

export const MEDIA: Medium[] = ['painting', 'paper', 'sculpture', 'installation'];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/folio.ts
git commit -m "feat(lib): typed folio data accessors"
```

---

## Task 8: Folio timeline page (`/folio`) and components

**Files:**
- Create: `src/pages/folio/index.astro`, `src/components/FolioCard.astro`, `src/components/FilterPills.astro`

- [ ] **Step 1: Create `src/components/FolioCard.astro`**

```astro
---
import type { Work } from '../lib/folio';
import { normalizeDimensions } from '../lib/parse-dimensions.mjs';

interface Props {
  work: Work;
}
const { work } = Astro.props;
const alt = `${work.title} (${work.year}), ${work.medium}`;
---
<a class="folio-card" href={`/folio/${work.slug}`} data-medium={work.medium} aria-label={alt}>
  <img
    src={`/images/thumb/${work.image_root}tnl.jpg`}
    alt={alt}
    loading="lazy"
    decoding="async"
  />
  <div class="caption">
    <span class="title">{work.title}</span>
    <span class="meta">{work.year}</span>
  </div>
</a>

<style>
  .folio-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-decoration: none;
    color: inherit;
  }
  .folio-card img {
    aspect-ratio: 1;
    object-fit: cover;
    background: var(--rule);
    transition: opacity 0.15s;
  }
  .folio-card:hover img { opacity: 0.85; }
  .caption {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .caption .title {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 0.95rem;
    line-height: 1.3;
  }
  .caption .meta {
    font-size: 0.75rem;
    color: var(--muted);
    letter-spacing: 0.04em;
  }
</style>
```

- [ ] **Step 2: Create `src/components/FilterPills.astro`**

```astro
---
import { MEDIA } from '../lib/folio';
---
<div class="filter-pills" role="group" aria-label="Filter by medium">
  <button type="button" class="pill" data-medium="all" aria-pressed="true">All</button>
  {MEDIA.map((m) => (
    <button type="button" class="pill" data-medium={m} aria-pressed="false">
      {m.charAt(0).toUpperCase() + m.slice(1)}
    </button>
  ))}
</div>

<script>
  const root = document.querySelector('.folio-grid') as HTMLElement | null;
  const pills = document.querySelectorAll<HTMLButtonElement>('.filter-pills .pill');

  function applyFilter(medium: string) {
    if (!root) return;
    root.dataset.activeMedium = medium;
    pills.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.medium === medium)));
  }

  pills.forEach((p) => {
    p.addEventListener('click', () => applyFilter(p.dataset.medium ?? 'all'));
  });

  // Honor legacy ?media=... query coming from /folio.php redirect
  const params = new URLSearchParams(window.location.search);
  const legacy = params.get('media');
  if (legacy && Array.from(pills).some((p) => p.dataset.medium === legacy)) {
    applyFilter(legacy);
  }
  // And ?decade=... → scroll to anchor
  const decade = params.get('decade');
  if (decade) {
    const decLabel = decade === '0' ? '2000s' : `19${decade}s`;
    const target = document.getElementById(decLabel);
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
</script>

<style>
  .filter-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-5);
  }
  .pill {
    background: transparent;
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 6px 14px;
    font: inherit;
    font-size: 0.8125rem;
    color: var(--muted);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .pill:hover { color: var(--text); border-color: var(--accent); }
  .pill[aria-pressed='true'] {
    background: var(--text);
    border-color: var(--text);
    color: var(--bg);
  }
</style>
```

- [ ] **Step 3: Create `src/pages/folio/index.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import FolioCard from '../../components/FolioCard.astro';
import FilterPills from '../../components/FilterPills.astro';
import { getAllWorks, groupByDecade } from '../../lib/folio';

const all = getAllWorks();
const groups = groupByDecade(all);
---
<Base
  title="Folio"
  current="folio"
  description={`${all.length} works · 1963–2003 · paintings, paper, sculpture, installations.`}
>
  <header class="folio-header">
    <h1>Folio</h1>
    <p class="muted">{all.length} works · 1963–2003</p>
  </header>

  <FilterPills />

  <div class="folio-grid" data-active-medium="all">
    {groups.map((g) => (
      <section class="decade-section" id={g.label}>
        <h2 class="decade-heading"><span class="label">{g.label}</span></h2>
        <div class="decade-grid">
          {g.works.map((w) => <FolioCard work={w} />)}
        </div>
      </section>
    ))}
  </div>
</Base>

<style>
  .folio-header { margin-bottom: var(--space-4); }
  .folio-header h1 { margin-bottom: var(--space-1); }

  .decade-section { margin-bottom: var(--space-6); }
  .decade-heading {
    position: sticky;
    top: 0;
    background: var(--bg);
    padding: var(--space-3) 0 var(--space-2);
    margin: 0 0 var(--space-3);
    border-bottom: 1px solid var(--rule);
    z-index: 1;
  }
  .decade-heading .label { font-size: 0.875rem; }

  .decade-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
  }
  @media (min-width: 640px) {
    .decade-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (min-width: 900px) {
    .decade-grid { grid-template-columns: repeat(4, 1fr); }
  }
  @media (min-width: 1100px) {
    .decade-grid { grid-template-columns: repeat(5, 1fr); }
  }

  /* Filter behavior: hide non-matching cards */
  .folio-grid[data-active-medium='painting'] .folio-card:not([data-medium='painting']) { display: none; }
  .folio-grid[data-active-medium='paper'] .folio-card:not([data-medium='paper']) { display: none; }
  .folio-grid[data-active-medium='sculpture'] .folio-card:not([data-medium='sculpture']) { display: none; }
  .folio-grid[data-active-medium='installation'] .folio-card:not([data-medium='installation']) { display: none; }

  /* Hide empty decade sections when filter eliminates all of them */
  .folio-grid[data-active-medium]:not([data-active-medium='all']) .decade-section:has(.decade-grid > .folio-card[style*='display: none'], .decade-grid:not(:has(.folio-card:not([style*='display: none'])))) {
    /* fallback handled by JS — see Step 4 */
  }
</style>
```

- [ ] **Step 4: Enhance the filter script to also collapse empty decade sections**

Append to the `<script>` block in `src/components/FilterPills.astro`:

```javascript
function recomputeEmptySections() {
  document.querySelectorAll('.decade-section').forEach((sec) => {
    const visible = sec.querySelectorAll('.folio-card:not([hidden])').length;
    (sec as HTMLElement).hidden = visible === 0;
  });
}

function applyFilterWithSections(medium: string) {
  if (!root) return;
  root.dataset.activeMedium = medium;
  pills.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.medium === medium)));
  document.querySelectorAll<HTMLElement>('.folio-card').forEach((card) => {
    const matches = medium === 'all' || card.dataset.medium === medium;
    card.hidden = !matches;
  });
  recomputeEmptySections();
}
```

Replace the earlier `applyFilter` callers with `applyFilterWithSections`. (Use `hidden` attribute instead of CSS `display: none` so JavaScript can count visibility cleanly.)

Drop the `[data-active-medium='X']` CSS rules (the JS now drives visibility directly).

- [ ] **Step 5: Run dev server, manually verify**

```bash
npm run dev
```

Visit http://localhost:4321/folio. Verify:
- Header shows "Folio · 227 works · 1963–2003".
- Decade sections render in order: 2000s, 1990s, 1980s, 1970s, 1960s.
- Click "Painting" → only painting cards visible; sculpture/installation/etc. hidden.
- Click "All" → everything returns.
- Visit `/folio?media=sculpture&decade=80` → on load, sculpture filter active and viewport at 1980s section.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/pages/folio/index.astro src/components/FolioCard.astro src/components/FilterPills.astro
git commit -m "feat(folio): timeline browse with medium filter and legacy query support"
```

---

## Task 9: Folio detail page (`/folio/[slug]`)

**Files:**
- Create: `src/pages/folio/[slug].astro`, `src/components/WorkMeta.astro`

- [ ] **Step 1: Create `src/components/WorkMeta.astro`**

```astro
---
import type { Work } from '../lib/folio';
import { normalizeDimensions } from '../lib/parse-dimensions.mjs';

interface Props { work: Work; }
const { work } = Astro.props;
const dims = normalizeDimensions(work.dimensions);
---
<dl class="work-meta">
  <div>
    <dt class="label">Year</dt>
    <dd>{work.year}</dd>
  </div>
  <div>
    <dt class="label">Medium</dt>
    <dd>{work.medium}</dd>
  </div>
  {work.description && (
    <div>
      <dt class="label">Materials</dt>
      <dd>{work.description}</dd>
    </div>
  )}
  {dims && (
    <div>
      <dt class="label">Dimensions</dt>
      <dd>{dims}</dd>
    </div>
  )}
</dl>

<style>
  .work-meta {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  .work-meta div {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: var(--space-3);
    align-items: baseline;
  }
  .work-meta dt { margin: 0; }
  .work-meta dd { margin: 0; font-family: var(--font-serif); font-size: 1.0625rem; }
  @media (max-width: 640px) {
    .work-meta div { grid-template-columns: 1fr; gap: var(--space-1); }
  }
</style>
```

- [ ] **Step 2: Create `src/pages/folio/[slug].astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import WorkMeta from '../../components/WorkMeta.astro';
import FolioCard from '../../components/FolioCard.astro';
import { getAllWorks, getWorkBySlug, getAdjacentWorks, getRelatedWorks, type Work } from '../../lib/folio';
import { parseDimensions, normalizeDimensions } from '../../lib/parse-dimensions.mjs';

export async function getStaticPaths() {
  return getAllWorks().map((w) => ({ params: { slug: w.slug }, props: { work: w } }));
}

interface Props { work: Work; }
const { work } = Astro.props;

const { prev, next } = getAdjacentWorks(work.slug);
const related = getRelatedWorks(work);

const alt = `${work.title} (${work.year}), ${work.medium}`;
const dims = parseDimensions(work.dimensions);

const ogImage = new URL(`/images/large/${work.image_root}lrg.jpg`, Astro.site).toString();

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'VisualArtwork',
  name: work.title,
  dateCreated: work.year,
  artMedium: work.medium,
  artworkSurface: work.description || undefined,
  creator: { '@type': 'Person', name: 'Greg Card' },
  ...(dims ? { width: { '@type': 'QuantitativeValue', value: dims.width, unitCode: 'INH' }, height: { '@type': 'QuantitativeValue', value: dims.height, unitCode: 'INH' } } : {}),
  image: ogImage,
};

const description = `${work.title} (${work.year}). ${work.medium}${work.description ? ', ' + work.description : ''}.${dims ? ' ' + normalizeDimensions(work.dimensions) + '.' : ''}`;
---
<Base
  title={work.title}
  description={description}
  current="folio"
  ogImage={ogImage}
  jsonLd={jsonLd}
>
  <article class="work">
    <div class="work-image-wrap">
      <a href={`/images/large/${work.image_root}lrg.jpg`}>
        <img
          src={`/images/large/${work.image_root}lrg.jpg`}
          srcset={`/images/small/${work.image_root}sml.jpg ${work.small.width}w, /images/large/${work.image_root}lrg.jpg ${work.large.width}w`}
          sizes="(max-width: 800px) 100vw, 800px"
          width={work.large.width}
          height={work.large.height}
          alt={alt}
          loading="eager"
          decoding="async"
        />
      </a>
      {work.image2_root && (
        <img
          class="work-image-secondary"
          src={`/images/large/${work.image2_root}lrg.jpg`}
          alt={`${alt} — additional view`}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>

    <header class="work-head">
      <h1>{work.title}</h1>
      <WorkMeta work={work} />
    </header>

    <nav class="prev-next" aria-label="Adjacent works">
      {prev ? <a href={`/folio/${prev.slug}`} rel="prev">← {prev.title} ({prev.year})</a> : <span />}
      {next ? <a href={`/folio/${next.slug}`} rel="next">{next.title} ({next.year}) →</a> : <span />}
    </nav>

    {related.length > 0 && (
      <section class="related" aria-labelledby="related-heading">
        <h2 id="related-heading" class="label">Related works</h2>
        <div class="related-grid">
          {related.map((w) => <FolioCard work={w} />)}
        </div>
      </section>
    )}
  </article>
</Base>

<style>
  .work {
    max-width: 900px;
    margin: 0 auto;
  }
  .work-image-wrap {
    margin-bottom: var(--space-5);
  }
  .work-image-secondary {
    margin-top: var(--space-3);
  }
  .work-head { margin-bottom: var(--space-6); }
  .work-head h1 {
    font-style: italic;
    margin-bottom: var(--space-4);
  }
  .prev-next {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4) 0;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
    font-size: 0.875rem;
  }
  .prev-next a { text-decoration: none; color: var(--muted); }
  .prev-next a:hover { color: var(--text); }
  .related { margin-top: var(--space-6); }
  .related-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
    margin-top: var(--space-3);
  }
  @media (min-width: 640px) {
    .related-grid { grid-template-columns: repeat(4, 1fr); }
  }
</style>
```

- [ ] **Step 3: Verify dev server and a sample work page**

```bash
npm run dev
```

Visit http://localhost:4321/folio/dyad-1980 (or pick any slug from `src/data/folio.json`). Verify:
- Image loads at large size.
- Title in italic serif, metadata grid below.
- Prev/next nav at bottom.
- Related works (4 thumbs) when applicable.
- View source: `<title>` is `Dyad — Greg Card`, JSON-LD `<script type="application/ld+json">` present.

Stop the dev server.

- [ ] **Step 4: Verify build generates 227 work pages**

```bash
npm run build
ls dist/folio/ | wc -l
```

Expected: 228 (227 work files + `index.html`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/folio/\[slug\].astro src/components/WorkMeta.astro
git commit -m "feat(folio): single-work detail pages with OG tags and JSON-LD"
```

---

## Task 10: Static content pages — Intro, Contact, Links, 404

**Files:**
- Create: `src/pages/intro.astro`, `src/pages/contact.astro`, `src/pages/links.astro`, `src/pages/404.astro`

The text content for `intro.html` lives in the backup. Extract it inline into the Astro page (not enough to warrant a JSON file). Same for `contact` and `links`.

- [ ] **Step 1: Extract intro text from backup**

```bash
cat _backup/backup-5.6.2026_09-16-34_gregcard/homedir/public_html/intro.html
```

The page contains the 2003 statement. Extract all paragraph text (strip nav and image tags). Use the result as the page body in the next step.

- [ ] **Step 2: Create `src/pages/intro.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Intro" current="intro" description="Greg Card's 2003 statement on the body of work archived here.">
  <article class="prose">
    <h1>Intro</h1>
    <p class="lead">
      I had not exhibited solo for twenty years prior to fall 2002. This site
      represents the second step in the counter-turn to that decision.
    </p>
    <p>
      The portfolio contains over 200 images spanning 1963–2003 — paintings,
      sculpture, installations, photographs, and written material. These are not
      everything produced; they are a fair sampling. Some bodies of work have
      been omitted.
    </p>
    <p>
      The work reflects a modernist sense and uses contemporary materials and
      abstract approaches. The pieces are about themselves and your perception
      of them — they are not academic exercises or post-modern speculation. Most
      exist in small groups rather than extended series.
    </p>
    <p>
      Visit more than once. Return as one would do with a picture book or
      exhibition catalog.
    </p>
    <p class="signoff">This is a beginning — change follows.</p>
    <p class="signature">g s c<br /><span class="muted">July 2003</span></p>
  </article>
</Base>

<style>
  .prose { max-width: var(--max-width-prose); margin: 0 auto; }
  .prose h1 { margin-bottom: var(--space-5); }
  .prose .lead {
    font-family: var(--font-serif);
    font-size: 1.375rem;
    line-height: 1.4;
    margin-bottom: var(--space-4);
  }
  .prose p { font-size: 1.0625rem; }
  .signoff { font-style: italic; margin-top: var(--space-5); }
  .signature { margin-top: var(--space-4); font-family: var(--font-serif); }
</style>
```

> **NOTE:** This is the prose extracted from `intro.html`, lightly rewritten for clean punctuation and dashes. If the user wants verbatim original phrasing instead, swap the body paragraphs with the exact text from the backup file. Confirm with user during phase 6 polish.

- [ ] **Step 3: Create `src/pages/contact.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Contact" current="contact" description="Contact information for Greg Card.">
  <article class="prose">
    <h1>Contact</h1>
    <p>
      For inquiries about works, exhibitions, or rights, write to:
    </p>
    <p><a href="mailto:gssee1@gmail.com">gssee1@gmail.com</a></p>
    <p class="muted">
      Copyright requests are handled by the Artists' Rights Society (ARS) NY.
    </p>
  </article>
</Base>

<style>
  .prose { max-width: var(--max-width-prose); margin: 0 auto; }
</style>
```

- [ ] **Step 4: Create `src/pages/links.astro`**

```astro
---
import Base from '../layouts/Base.astro';

const links = [
  { name: 'Larry Bell', url: 'https://www.larrybell.com' },
  { name: 'Ned Evans', url: 'https://www.nedevans.com' },
  { name: 'Gus Foster', url: 'https://www.gusfoster.com' },
  { name: 'James Wrinkle', url: 'https://www.jameswrinkle.com' },
  { name: 'Abstract Art', url: 'https://www.abstract-art.com' },
  { name: 'Charles Arnoldi Studio', url: 'https://www.charlesarnoldistudio.com/' },
  { name: 'Raul Guerrero', url: 'https://www.raulguerrero.com' },
  { name: 'Dennis Hollingsworth', url: 'https://www.dennishollingsworth.us/' },
  { name: 'Mons Mart', url: 'https://www.monsmart.com' },
];
---
<Base title="Links" current="links" description="Peer artists referenced from the original gregcard.com.">
  <article class="prose">
    <h1>Links</h1>
    <p class="muted">Peer artists, preserved from the original site.</p>
    <ul class="links-list">
      {links.map((l) => (
        <li><a href={l.url} rel="noopener">{l.name}</a></li>
      ))}
    </ul>
  </article>
</Base>

<style>
  .prose { max-width: var(--max-width-prose); margin: 0 auto; }
  .links-list {
    list-style: none;
    padding: 0;
    margin: var(--space-4) 0;
  }
  .links-list li {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rule);
  }
  .links-list a {
    text-decoration: none;
    font-family: var(--font-serif);
    font-size: 1.125rem;
  }
  .links-list a:hover { color: var(--accent); }
</style>
```

> **NOTE:** Live-link checks for these URLs are deferred to phase 6 polish per spec §12. Annotation `(archived — site no longer available)` to be added then for any dead links.

- [ ] **Step 5: Create `src/pages/404.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Page not found" description="That page doesn't exist on the archive.">
  <article class="prose">
    <h1>Not found</h1>
    <p>That page isn't here. Try the <a href="/folio">folio</a> or the <a href="/">home page</a>.</p>
  </article>
</Base>

<style>
  .prose { max-width: var(--max-width-prose); margin: 0 auto; }
</style>
```

- [ ] **Step 6: Verify all four pages render**

```bash
npm run dev
```

Visit each: `/intro`, `/contact`, `/links`, `/404` (force a not-found URL like `/no-such-page`). Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/pages/intro.astro src/pages/contact.astro src/pages/links.astro src/pages/404.astro
git commit -m "feat(pages): static content pages — intro, contact, links, 404"
```

---

## Task 11: Biography extraction + page

**Files:**
- Create: `scripts/extract-biography.mjs`, `src/pages/biography.astro`, `src/pages/bibliography.astro`, `src/data/biography.json` (generated), `src/data/bibliography.json` (generated)

The legacy `biog_*.html` files are nav-heavy with content embedded. The script strips chrome and extracts the lists.

- [ ] **Step 1: Implement `scripts/extract-biography.mjs`**

```javascript
#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(REPO_ROOT, '_backup/backup-5.6.2026_09-16-34_gregcard/homedir/public_html');
const OUT_DIR = path.join(REPO_ROOT, 'src/data');

const SECTIONS = [
  { key: 'solo',        file: 'biog_solo.html', heading: 'Solo Exhibitions' },
  { key: 'group',       file: 'biog_grou.html', heading: 'Group Exhibitions' },
  { key: 'awards',      file: 'biog_awar.html', heading: 'Awards & Grants' },
  { key: 'lectures',    file: 'biog_lect.html', heading: 'Lectures' },
  { key: 'collections', file: 'biog_coll.html', heading: 'Collections' },
];

function stripHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function extractListLines(html) {
  // Heuristic: legacy pages have chrome (nav, copyright) and a content list of dated entries.
  // Filter to lines that look like entries (year, venue/title) and drop nav cruft.
  const lines = stripHtml(html);
  const blacklist = [
    /^home$/i, /^intro$/i, /^folio$/i, /^bio/i, /^bibliography$/i, /^writings?$/i,
    /^links$/i, /^contact$/i, /^writeon$/i, /^paintings?$/i, /^sculptures?$/i,
    /^paper$/i, /^installations?$/i, /^photos?$/i, /^boxes$/i,
    /^60s$/i, /^70s$/i, /^80s$/i, /^90s$/i, /^00s$/i,
    /^website by/i, /^©/i, /^copyright/i,
    /^artists['']? rights society/i,
    /^solo exhibitions?$/i, /^group exhibitions?$/i, /^awards/i, /^lectures$/i, /^collections$/i,
    /^greg card portfolio$/i, /^contemp/i,
  ];
  return lines.filter((l) => !blacklist.some((rx) => rx.test(l)));
}

async function main() {
  const sections = {};
  for (const { key, file } of SECTIONS) {
    const html = await fs.readFile(path.join(SRC, file), 'utf8');
    sections[key] = extractListLines(html);
  }

  const biography = {
    sections,
    narrative: null, // user-provided / drafted later in phase 4 polish
  };

  const bibliographyHtml = await fs.readFile(path.join(SRC, 'biog_bibl.html'), 'utf8');
  const bibliography = { entries: extractListLines(bibliographyHtml) };

  await fs.writeFile(path.join(OUT_DIR, 'biography.json'), JSON.stringify(biography, null, 2) + '\n');
  await fs.writeFile(path.join(OUT_DIR, 'bibliography.json'), JSON.stringify(bibliography, null, 2) + '\n');

  for (const { key } of SECTIONS) {
    console.log(`  ${key}: ${sections[key].length} lines`);
  }
  console.log(`  bibliography: ${bibliography.entries.length} lines`);
  console.log('biography.json + bibliography.json written.');
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the script and inspect output**

```bash
node scripts/extract-biography.mjs
cat src/data/biography.json | head -40
cat src/data/bibliography.json | head -20
```

Expected: each section has a non-empty `entries` array. Some line cleanup may still be needed if the legacy HTML has odd cruft. Eyeball the output; if blacklist patterns missed something, add them and re-run.

- [ ] **Step 3: Create `src/pages/biography.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import biography from '../data/biography.json';

const SECTIONS = [
  { key: 'solo',        anchor: 'solo',        heading: 'Solo Exhibitions' },
  { key: 'group',       anchor: 'group',       heading: 'Group Exhibitions' },
  { key: 'awards',      anchor: 'awards',      heading: 'Awards & Grants' },
  { key: 'lectures',    anchor: 'lectures',    heading: 'Lectures' },
  { key: 'collections', anchor: 'collections', heading: 'Collections' },
];
---
<Base title="Biography" current="biography" description="Greg Card — biographical record: exhibitions, awards, lectures, collections.">
  <article class="biography prose">
    <h1>Biography</h1>
    {biography.narrative ? (
      <p class="lead">{biography.narrative}</p>
    ) : (
      <p class="lead muted">A narrative paragraph synthesized from the records below is forthcoming.</p>
    )}

    {SECTIONS.map((s) => (
      <section id={s.anchor}>
        <h2>{s.heading}</h2>
        <ul class="entries">
          {biography.sections[s.key].map((line) => <li>{line}</li>)}
        </ul>
      </section>
    ))}
  </article>
</Base>

<style>
  .prose { max-width: var(--max-width-prose); margin: 0 auto; }
  .lead { font-family: var(--font-serif); font-size: 1.125rem; }
  section { margin-top: var(--space-6); }
  .entries {
    list-style: none;
    padding: 0;
    margin: var(--space-3) 0;
  }
  .entries li {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rule);
    font-size: 0.9375rem;
  }
</style>
```

- [ ] **Step 4: Create `src/pages/bibliography.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import bibliography from '../data/bibliography.json';
---
<Base title="Bibliography" current="bibliography" description="Critical writings about Greg Card's work, 1968–2002.">
  <article class="prose">
    <h1>Bibliography</h1>
    <p class="muted">Critical writings about the work, 1968–2002.</p>
    <ul class="entries">
      {bibliography.entries.map((line) => <li>{line}</li>)}
    </ul>
  </article>
</Base>

<style>
  .prose { max-width: var(--max-width-prose); margin: 0 auto; }
  .entries { list-style: none; padding: 0; margin: var(--space-4) 0; }
  .entries li {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rule);
    font-size: 0.9375rem;
  }
</style>
```

- [ ] **Step 5: Verify pages render**

```bash
npm run dev
```

Visit `/biography` and `/biography#solo` — entries render, anchor scroll works. Visit `/bibliography`. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add scripts/extract-biography.mjs src/data/biography.json src/data/bibliography.json src/pages/biography.astro src/pages/bibliography.astro
git commit -m "feat(bio): extract and render biography + bibliography from legacy pages"
```

---

## Task 12: Writings — extract essays to MDX, render

**Files:**
- Create: `scripts/extract-essays.mjs`, `src/content/config.ts`, `src/content/writings/*.mdx` (5 files, generated), `src/pages/writings/index.astro`, `src/pages/writings/[slug].astro`

- [ ] **Step 1: Create `src/content/config.ts`**

```typescript
import { defineCollection, z } from 'astro:content';

const writings = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    order: z.number(),
    description: z.string().optional(),
  }),
});

export const collections = { writings };
```

- [ ] **Step 2: Implement `scripts/extract-essays.mjs`**

```javascript
#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(REPO_ROOT, '_backup/backup-5.6.2026_09-16-34_gregcard/homedir/public_html');
const OUT_DIR = path.join(REPO_ROOT, 'src/content/writings');

const ESSAYS = [
  { file: '1999.html',                  slug: '1999',                            title: '1999',                          order: 1, description: 'A 1999 reflection on the work.' },
  { file: 'acts_of_art.html',           slug: 'acts-of-art',                     title: 'Acts of Art',                   order: 2, description: 'On the act of making.' },
  { file: 'adventures.html',            slug: 'adventures-in-actual-abstraction', title: 'Adventures in Actual Abstraction', order: 3, description: 'On abstraction grounded in materials and perception.' },
  { file: 'notes_of_engagement.html',   slug: 'notes-on-engagement',             title: 'Notes on Engagement',           order: 4, description: 'On engagement with the viewer.' },
  { file: 'statement.html',             slug: 'statement',                       title: 'Statement',                     order: 5, description: "The artist's statement." },
];

function htmlToMdx(html) {
  // Strip nav chrome — same approach as biography but preserve paragraph structure.
  const noScripts = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  // Pull <p>...</p> blocks; if there aren't any, fall back to splitting on <br>+<br>.
  const ps = [...noScripts.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1]);
  let paras;
  if (ps.length > 0) {
    paras = ps;
  } else {
    paras = noScripts
      .replace(/<br\s*\/?>/gi, '\n\n')
      .split(/\n{2,}/);
  }
  const cleaned = paras
    .map((p) =>
      p
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((p) => p.length > 30); // drop nav-text fragments
  return cleaned.join('\n\n');
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const e of ESSAYS) {
    const html = await fs.readFile(path.join(SRC, e.file), 'utf8');
    const body = htmlToMdx(html);
    const frontmatter = [
      '---',
      `title: ${JSON.stringify(e.title)}`,
      `slug: ${JSON.stringify(e.slug)}`,
      `order: ${e.order}`,
      `description: ${JSON.stringify(e.description)}`,
      '---',
      '',
      body,
      '',
    ].join('\n');
    await fs.writeFile(path.join(OUT_DIR, `${e.slug}.mdx`), frontmatter, 'utf8');
    console.log(`wrote ${e.slug}.mdx (${body.length} chars)`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Run the script**

```bash
node scripts/extract-essays.mjs
```

Expected: 5 .mdx files in `src/content/writings/`. Inspect one:

```bash
cat src/content/writings/statement.mdx
```

If output is mostly empty or full of nav cruft, tighten `htmlToMdx` (the legacy pages are inconsistent — be ready to handle one or two of them as special cases).

- [ ] **Step 4: Create `src/pages/writings/index.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import { getCollection } from 'astro:content';

const all = await getCollection('writings');
all.sort((a, b) => a.data.order - b.data.order);
---
<Base title="Writings" current="writings" description="Essays by Greg Card on his practice and abstraction.">
  <article class="prose">
    <h1>Writings</h1>
    <p class="muted">Essays by Greg Card on his practice and on abstraction.</p>
    <ul class="essays">
      {all.map((e) => (
        <li>
          <a href={`/writings/${e.data.slug}`}>
            <h2>{e.data.title}</h2>
            <p class="muted">{e.data.description}</p>
          </a>
        </li>
      ))}
    </ul>
  </article>
</Base>

<style>
  .prose { max-width: var(--max-width-prose); margin: 0 auto; }
  .essays { list-style: none; padding: 0; margin: var(--space-5) 0; }
  .essays li {
    padding: var(--space-4) 0;
    border-bottom: 1px solid var(--rule);
  }
  .essays a { text-decoration: none; display: block; }
  .essays h2 { font-size: 1.375rem; margin-bottom: var(--space-1); }
  .essays a:hover h2 { color: var(--accent); }
  .essays p { margin: 0; font-size: 0.9375rem; }
</style>
```

- [ ] **Step 5: Create `src/pages/writings/[slug].astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import { getCollection, type CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const all = await getCollection('writings');
  return all.map((e) => ({ params: { slug: e.data.slug }, props: { entry: e } }));
}

interface Props { entry: CollectionEntry<'writings'>; }
const { entry } = Astro.props;
const { Content } = await entry.render();

const all = await getCollection('writings');
all.sort((a, b) => a.data.order - b.data.order);
const idx = all.findIndex((e) => e.data.slug === entry.data.slug);
const prev = idx > 0 ? all[idx - 1] : null;
const next = idx < all.length - 1 ? all[idx + 1] : null;
---
<Base
  title={entry.data.title}
  description={entry.data.description ?? `Essay by Greg Card: ${entry.data.title}.`}
  current="writings"
>
  <article class="essay prose">
    <header>
      <h1>{entry.data.title}</h1>
    </header>
    <div class="essay-body">
      <Content />
    </div>
    <nav class="prev-next" aria-label="Adjacent essays">
      {prev ? <a href={`/writings/${prev.data.slug}`} rel="prev">← {prev.data.title}</a> : <span />}
      {next ? <a href={`/writings/${next.data.slug}`} rel="next">{next.data.title} →</a> : <span />}
    </nav>
  </article>
</Base>

<style>
  .prose { max-width: var(--max-width-prose); margin: 0 auto; }
  .essay h1 { font-style: italic; margin-bottom: var(--space-5); }
  .essay-body :global(p) {
    font-family: var(--font-serif);
    font-size: 1.125rem;
    line-height: 1.7;
    margin-bottom: var(--space-3);
  }
  .prev-next {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    margin-top: var(--space-6);
    padding: var(--space-4) 0;
    border-top: 1px solid var(--rule);
    font-size: 0.875rem;
  }
  .prev-next a { text-decoration: none; color: var(--muted); }
  .prev-next a:hover { color: var(--text); }
</style>
```

- [ ] **Step 6: Verify**

```bash
npm run dev
```

Visit `/writings` and one essay (e.g., `/writings/statement`). Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add scripts/extract-essays.mjs src/content/ src/pages/writings/
git commit -m "feat(writings): essays extracted to MDX with index and per-essay pages"
```

---

## Task 13: Self-host fonts, refine homepage with featured works

**Files:**
- Create: `public/fonts/*` (Crimson Pro + Inter woff2 files)
- Modify: `src/styles/global.css`, `src/pages/index.astro`, `src/data/folio.json` (add `featured` flag)

Self-hosting fonts: download Crimson Pro and Inter from Google Fonts (or fontsource), place woff2 files in `public/fonts/`. Two weights of each is sufficient: 400 + 500 (or 400 + 600 for Inter).

- [ ] **Step 1: Add fonts**

```bash
mkdir -p public/fonts
# Manual step: download from https://fonts.google.com/ — pick subset latin only.
# Required files:
#   public/fonts/crimson-pro-400.woff2
#   public/fonts/crimson-pro-400-italic.woff2
#   public/fonts/crimson-pro-500.woff2
#   public/fonts/inter-400.woff2
#   public/fonts/inter-500.woff2
```

If automated install via fontsource is preferred:

```bash
npm install @fontsource/crimson-pro @fontsource/inter
```

Then in `src/styles/global.css` add at the very top:

```css
@import '@fontsource/crimson-pro/400.css';
@import '@fontsource/crimson-pro/400-italic.css';
@import '@fontsource/crimson-pro/500.css';
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
```

(Astro will inline these at build time, served from the same origin — equivalent to self-hosting.)

- [ ] **Step 2: Pick featured works**

Edit `src/data/folio.json`: add `"featured": true` to two works from 2003 (any two of your choice). Example: pick the first two works whose `year === "2003"`.

A small helper to do this without manual editing:

```bash
node -e "
const fs = require('fs');
const folio = JSON.parse(fs.readFileSync('src/data/folio.json', 'utf8'));
const candidates = folio.filter(w => w.year === '2003').slice(0, 2);
const featured = new Set(candidates.map(w => w.slug));
const out = folio.map(w => featured.has(w.slug) ? { ...w, featured: true } : w);
fs.writeFileSync('src/data/folio.json', JSON.stringify(out, null, 2) + '\n');
console.log('featured:', [...featured]);
"
```

Update `src/lib/folio.ts` to expose featured works:

```typescript
export function getFeaturedWorks(): Work[] {
  return ALL.filter((w) => (w as any).featured === true);
}
```

And add `featured?: boolean` to the `Work` interface.

- [ ] **Step 3: Update `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import FolioCard from '../components/FolioCard.astro';
import { getFeaturedWorks } from '../lib/folio';

const featured = getFeaturedWorks();
---
<Base title="Greg Card" current="home" description="Greg Card · contemporary abstractions, 1963–2003.">
  <section class="hero">
    <p class="label">Contemporary abstractions</p>
    <h1>Greg Card</h1>
    <p class="meta muted">1963–2003 · paintings, paper, sculpture, installations</p>
    <p class="lead">
      An archive of forty years of work. Browse the <a href="/folio">folio</a>,
      read the artist's <a href="/intro">intro</a>, or explore the
      <a href="/writings">writings</a>.
    </p>
  </section>

  {featured.length > 0 && (
    <section class="featured">
      <h2 class="label">Featured</h2>
      <div class="featured-grid">
        {featured.map((w) => <FolioCard work={w} />)}
      </div>
    </section>
  )}
</Base>

<style>
  .hero {
    padding: var(--space-6) 0 var(--space-5);
    max-width: var(--max-width-prose);
  }
  .hero h1 { margin: var(--space-2) 0; font-size: 3rem; }
  .hero .meta { font-size: 0.9375rem; }
  .hero .lead {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    margin-top: var(--space-4);
  }

  .featured { margin-top: var(--space-6); }
  .featured-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
    margin-top: var(--space-3);
    max-width: 700px;
  }
</style>
```

- [ ] **Step 4: Verify dev server**

```bash
npm run dev
```

Visit `/`. Verify fonts load (no FOUT, serif on H1), featured works render. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add public/fonts/ package.json package-lock.json src/styles/global.css src/data/folio.json src/lib/folio.ts src/pages/index.astro
git commit -m "feat(home): self-host fonts, featured-works hero"
```

---

## Task 14: Redirects and Netlify config

**Files:**
- Create: `netlify.toml`, `scripts/generate-redirects.mjs`
- Generated: `public/_redirects` (committed)

- [ ] **Step 1: Create `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), camera=(), microphone=()"

[[headers]]
  for = "/images/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/fonts/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
```

- [ ] **Step 2: Implement `scripts/generate-redirects.mjs`**

```javascript
#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const FOLIO_JSON = path.join(REPO_ROOT, 'src/data/folio.json');
const OUT = path.join(REPO_ROOT, 'public/_redirects');

const STATIC_REDIRECTS = `
# Static page renames
/intro.html                /intro                301
/biog_bibl.html            /bibliography         301
/biog_solo.html            /biography#solo       301
/biog_grou.html            /biography#group      301
/biog_awar.html            /biography#awards     301
/biog_lect.html            /biography#lectures   301
/biog_coll.html            /biography#collections 301
/writeon.html              /writings             301
/1999.html                 /writings/1999        301
/acts_of_art.html          /writings/acts-of-art 301
/adventures.html           /writings/adventures-in-actual-abstraction 301
/notes_of_engagement.html  /writings/notes-on-engagement 301
/statement.html            /writings/statement   301
/links.html                /links                301
/contact.html              /contact              301
/index.htm                 /                     301

# PHP folio
/folio.php                 /folio                301
/folioBU.php               /folio                301
/popup.php                 /folio                301

# Generated per-work popup.php redirects (image_root → slug)
`.trimStart();

async function main() {
  const folio = JSON.parse(await fs.readFile(FOLIO_JSON, 'utf8'));
  const popupLines = folio.map((w) =>
    `/popup.php           /folio/${w.slug}       301?image=${w.image_root}`
  );
  // Netlify _redirects supports query-string matching with the syntax: /path  /target  301?  but the
  // canonical form is "from-path  to-path  status  query=val" via "Conditions". For broad compat
  // we use the splat: when popup.php is hit with ?image=X, we send to /folio/<slug>.
  // Netlify documentation: https://docs.netlify.com/routing/redirects/redirect-options/#query-parameters
  // Correct syntax:
  //   /popup.php image=:img  /folio/:img  301
  // But that requires our slug == image_root, which it doesn't.
  // Solution: emit one explicit rule per image_root with a specific query match.
  const popupRules = folio.map((w) => `/popup.php  image=${w.image_root}  /folio/${w.slug}  301!`);

  const out =
    STATIC_REDIRECTS +
    popupRules.join('\n') +
    '\n';

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, out, 'utf8');
  console.log(`wrote ${popupRules.length + STATIC_REDIRECTS.split('\n').filter((l) => l && !l.startsWith('#')).length} redirect rules → ${path.relative(REPO_ROOT, OUT)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Run and inspect**

```bash
node scripts/generate-redirects.mjs
head -30 public/_redirects
tail -10 public/_redirects
wc -l public/_redirects
```

Expected: 18 static lines + 227 popup-per-work rules = ~245 useful lines (plus comments).

- [ ] **Step 4: Build and verify `_redirects` lands in `dist/`**

```bash
npm run build
test -f dist/_redirects && echo OK || echo MISSING
head dist/_redirects
```

Expected: file exists, mirrors `public/_redirects`.

- [ ] **Step 5: Commit**

```bash
git add netlify.toml scripts/generate-redirects.mjs public/_redirects
git commit -m "feat(deploy): netlify.toml and generated redirects for legacy URLs"
```

---

## Task 15: Build validators

**Files:**
- Create: `scripts/validate-build.mjs`

This script runs after `astro build` and asserts the post-build invariants from spec §10.

- [ ] **Step 1: Implement `scripts/validate-build.mjs`**

```javascript
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

async function checkWorkPagesExist() {
  const folio = JSON.parse(await fs.readFile(FOLIO_JSON, 'utf8'));
  for (const w of folio) {
    const p = path.join(DIST, 'folio', `${w.slug}.html`);
    if (!(await fileExists(p))) err(`missing work page: ${p}`);
  }
  console.log(`✓ ${folio.length} work pages exist`);
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

async function checkImagesExist() {
  const folio = JSON.parse(await fs.readFile(FOLIO_JSON, 'utf8'));
  for (const w of folio) {
    for (const r of ['thumb', 'small', 'large']) {
      const suffix = r === 'thumb' ? 'tnl' : r === 'small' ? 'sml' : 'lrg';
      const p = path.join(DIST, 'images', r, `${w.image_root}${suffix}.jpg`);
      if (!(await fileExists(p))) err(`missing image: ${path.relative(DIST, p)}`);
    }
    if (w.image2_root) {
      for (const r of ['thumb', 'small', 'large']) {
        const suffix = r === 'thumb' ? 'tnl' : r === 'small' ? 'sml' : 'lrg';
        const p = path.join(DIST, 'images', r, `${w.image2_root}${suffix}.jpg`);
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
    let to = parts[1];
    if (parts[2] && /^\d{3}/.test(parts[2])) {
      to = parts[1];
    } else if (parts[1].includes('=')) {
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
  const required = ['index.html', 'folio.html', 'biography.html', 'bibliography.html', 'writings.html', 'intro.html', 'links.html', 'contact.html', '404.html'];
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
```

- [ ] **Step 2: Restore the full build pipeline in `package.json`**

Confirm `package.json` `build` script is:

```json
"build": "node scripts/generate-redirects.mjs && astro build && node scripts/validate-build.mjs",
```

- [ ] **Step 3: Run the full build**

```bash
npm run build
```

Expected output:
```
wrote NN redirect rules → public/_redirects
[astro] ...build output...
✓ all 227 slugs unique
✓ 227 work pages exist
✓ all images exist
✓ all core pages built
✓ all redirect targets resolve

All build validations passed.
```

If any check fails, fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-build.mjs package.json
git commit -m "feat(ci): post-build validators wired into npm run build"
```

---

## Task 16: Final polish, smoke checklist, deploy prep

**Files:**
- Modify: any minor polish discovered during smoke checks

This task is deliberately broad — it's the manual review pass before the user signs off.

- [ ] **Step 1: Run Lighthouse on the built site**

```bash
npm run build
npx http-server dist -p 8080 -s &
sleep 2
npx lighthouse http://localhost:8080/ --quiet --chrome-flags='--headless' --output=json --output-path=/tmp/lh-home.json
npx lighthouse http://localhost:8080/folio --quiet --chrome-flags='--headless' --output=json --output-path=/tmp/lh-folio.json
npx lighthouse http://localhost:8080/folio/dyad-1980 --quiet --chrome-flags='--headless' --output=json --output-path=/tmp/lh-work.json
kill %1
node -e "['/tmp/lh-home.json','/tmp/lh-folio.json','/tmp/lh-work.json'].forEach(f => { const r = require(f); const c = r.categories; console.log(f, 'perf', c.performance.score, 'a11y', c.accessibility.score, 'best', c['best-practices'].score, 'seo', c.seo.score); })"
```

Expected: each category ≥ 0.95 (Performance), 1.00 (Accessibility), ≥ 0.95 (Best Practices), 1.00 (SEO).

If any score is below threshold, fix the lowest-hanging issues:
- Performance: check image sizes, font preload, defer scripts
- Accessibility: alt text, focus rings, color contrast, headings
- Best Practices: HTTPS-only image URLs, no console errors
- SEO: meta description, viewport, canonical

Iterate until thresholds are met.

- [ ] **Step 2: Manual smoke checklist (run on local dev, mark each)**

```bash
npm run dev
```

- [ ] Spot-check 10 work pages across decades and media render correctly with metadata.
- [ ] All five medium pills filter correctly; "All" restores full set.
- [ ] All five decade anchors (`/folio#1960s` etc.) scroll into view.
- [ ] `/folio?media=sculpture&decade=80` lands with sculpture filter active and viewport at 1980s.
- [ ] Keyboard-only nav: Tab through home → folio → first thumb → Enter → work page → prev/next.
- [ ] On a mobile viewport (DevTools 375×667), folio grid is 2-column and decade headers are sticky.
- [ ] All five legacy redirects checked manually with curl-via-served-_redirects (run on Netlify deploy preview, not locally — `_redirects` only applies on Netlify):
  - This step is deferred to Step 4 (Netlify deploy preview).

- [ ] **Step 3: Commit any polish changes**

```bash
git add -A
git commit -m "polish: Lighthouse fixes and smoke-test corrections"
```

- [ ] **Step 4: Push to a staging branch and connect to Netlify**

This is a user-driven step. Provide instructions:

```bash
# User: create the GitHub repo (or your preferred git host), then:
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/gregscard.git
git push -u origin main

git checkout -b staging
git push -u origin staging
```

Then in the Netlify UI:
1. New site → import from Git → select repo.
2. Branch deploys: production = `main`, branch deploys for `staging`.
3. Build settings already declared in `netlify.toml` — no manual fields needed.
4. After first deploy, copy the staging URL.

- [ ] **Step 5: Post-deploy smoke checklist (against staging URL)**

Replace `<STAGING>` with the staging URL. For each, expect HTTP 200 (or 301 → 200 for redirects).

```bash
STAGING="https://staging-url.netlify.app"  # placeholder

for url in /intro.html /biog_solo.html /folio.php /writeon.html /links.html /contact.html /1999.html /statement.html "/popup.php?image=pa81_0044"; do
  status=$(curl -s -o /dev/null -w "%{http_code} → %{redirect_url}" "$STAGING$url")
  echo "$url  $status"
done
```

Expected: each prints `301 → <new-url>`. Then `curl -I <new-url>` returns 200.

For 5 random work pages (pick slugs from `src/data/folio.json`):
- Visit `<STAGING>/folio/<slug>` → HTTP 200, image loads, OG tags present (`view-source:` confirms).

For Lighthouse against staging (after Cloudflare-style cold start has warmed up):
- Run Lighthouse mobile on `/`, `/folio`, one work page, one essay. Confirm ≥95 / 100 / ≥95 / 100.

- [ ] **Step 6: Final commit and tag**

```bash
git checkout main
git merge staging
git tag v0.1.0
git push origin main --tags
```

The site is now ready for the user to flip DNS at gregcard.com → Netlify when they choose. (DNS cutover is intentionally not automated — user-driven step.)

---

## Self-Review

**1. Spec coverage**

- §1 Goals — covered by Task 1 (Lighthouse targets in Task 16) ✓
- §2 Source material — Tasks 4, 5, 11, 12 ingest each subset ✓
- §3 Architecture (file layout) — Task 1 scaffolds, every subsequent task fills in ✓
- §4 Routes — Tasks 8, 9, 10, 11, 12 implement every URL ✓
- §5 Redirects — Task 14 ✓
- §6 Components (folio, work detail, home, intro, biography, bibliography, writings, links, contact, 404) — Tasks 8, 9, 10, 11, 12, 13 ✓
- §7 Visual system — Tasks 6, 13 ✓
- §8 Build & deploy — Tasks 1, 14, 16 ✓
- §9 Extraction scripts — Tasks 4, 5, 11, 12 ✓
- §10 Validators — Task 15 ✓
- §11 Phasing — plan order matches spec phasing ✓
- §12 Open items — flagged with "NOTE" callouts in Tasks 10, 13, 16 (link-rot check, narrative bio, italic title convention). User-resolved at polish time.
- §13 Out of scope — nothing snuck in.

No gaps.

**2. Placeholder scan**

- One "manual step" in Task 13 Step 1 (downloading fonts) — provided alternative via `@fontsource` packages. Not a placeholder; it's a "either-or" choice with full instructions for both paths.
- Task 16 Step 4 deliberately defers to user (DNS / Netlify UI). Spec §11 explicitly marks DNS cutover as user-driven, so this is correct.
- Task 13 Step 2 picks featured works "any two of your choice" — provides a concrete one-liner that picks deterministically. Acceptable.
- No "TBD", "TODO", "implement later", or vague "appropriate error handling" in the plan body.

**3. Type consistency**

- `Work` interface defined once in Task 7, re-exported and reused by Tasks 8, 9, 13.
- `MEDIA` array exported from `src/lib/folio.ts`, reused by `FilterPills.astro`.
- `slugify`, `slugifyWork` from `src/lib/slugify.mjs` — consistent across Tasks 2, 4.
- `parseDimensions`, `normalizeDimensions` from `src/lib/parse-dimensions.mjs` — consistent across Tasks 3, 9.
- Image-rendition suffix convention: `tnl.jpg`, `sml.jpg`, `lrg.jpg` — Task 5 discovers them dynamically; Task 8/9/15 hard-code them. Consistent assumption — verified by Task 5 Step 2 console output before any consumer relies on the convention.
- `SECTIONS` array shape (key/heading) consistent between extract script (Task 11) and render page (Task 11).

No inconsistencies.

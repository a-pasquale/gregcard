#!/usr/bin/env node
/**
 * extract-biography.mjs
 * Parses 6 legacy HTML biography files into structured JSON.
 *
 * All files share a two-column table layout: year (bodyTextBD) + content (bodyText).
 * The Collections file uses <p> tags in a single colspan="2" cell instead.
 */
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

// Unicode constants to avoid encoding issues in source file
const LDQUO = '“'; // left double quote
const RDQUO = '”'; // right double quote
const LSQUO = '‘'; // left single quote
const RSQUO = '’'; // right single quote / apostrophe
const NDASH = '–'; // en dash
const MDASH = '—'; // em dash

/**
 * Decode Windows-1252 character entities and standard HTML entities.
 * The legacy HTML uses both &#NNN; (with semicolon) and &#NNN (without semicolon).
 * We handle both forms explicitly for the common Win-1252 ranges.
 */
function decodeEntities(str) {
  return str
    // Win-1252 smart quotes and dashes (with or without trailing semicolon)
    .replace(/&#147;?/g, LDQUO)
    .replace(/&#148;?/g, RDQUO)
    .replace(/&#146;?/g, RSQUO)
    .replace(/&#145;?/g, LSQUO)
    .replace(/&#150;?/g, NDASH)
    .replace(/&#151;?/g, MDASH)
    // Standard entities
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&ndash;/g, NDASH)
    .replace(/&mdash;/g, MDASH)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Handle any remaining standard numeric entities (semicolon form only)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Strip all HTML tags from a string */
function stripTags(str) {
  return str.replace(/<[^>]*>/g, '');
}

/** Normalise whitespace: collapse runs of spaces/newlines into a single space */
function normalise(str) {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Extract structured entries from the content area of a biography HTML file.
 *
 * Strategy: scan all <tr> blocks that contain bodyText class cells.
 * Entries are <tr> rows with two <td> cells: year + content.
 * Returns an array of { year: string|null, text: string } objects.
 *
 * The Collections file uses <td colspan="2"> with <p> tags instead.
 */
function parseEntries(html) {
  const entries = [];

  // Match all <tr> blocks (non-greedy, case-insensitive)
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];

    // Skip nav rows (they contain rollover image links)
    if (/IMG\s+NAME=/i.test(rowHtml)) continue;
    if (/ONMOUSEOVER/i.test(rowHtml)) continue;

    // Case 1: Collections — single cell with colspan="2" containing <p> tags
    if (/colspan\s*=\s*["']?2["']?/i.test(rowHtml) && /<p>/i.test(rowHtml)) {
      const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let pMatch;
      while ((pMatch = pRegex.exec(rowHtml)) !== null) {
        const text = normalise(decodeEntities(stripTags(pMatch[1])));
        if (text && text.length > 3) {
          entries.push({ year: null, text });
        }
      }
      continue;
    }

    // Case 2: Standard two-column rows (year + content)
    // Require bodyText class to confirm this is a content row
    const hasBodyText = /class\s*=\s*["']bodyText/i.test(rowHtml);
    if (!hasBodyText) continue;

    // Find all <td> cells in this row
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1]);
    }

    if (cells.length < 2) continue;

    // First cell: year (may be &nbsp; for continued / undated entries)
    const yearRaw = normalise(decodeEntities(stripTags(cells[0]))).replace(/\s+/g, '');
    // Accept 4-digit years and year ranges like 1993-1994 or 1999-2000
    const year = /^\d{4}(-\d{2,4})?$/.test(yearRaw) ? yearRaw : null;

    // Second cell: content — drop img tags, split on <br>, clean each line
    const contentHtml = cells[1].replace(/<img[^>]*>/gi, '');
    const lines = contentHtml
      .split(/<br\s*\/?>/i)
      .map((s) => normalise(decodeEntities(stripTags(s))))
      .filter((s) => s.length > 0);

    if (lines.length === 0) continue;

    const text = lines.join('\n');
    if (!text.trim()) continue;

    entries.push({ year, text });
  }

  return entries;
}

async function main() {
  const sections = {};

  for (const { key, file } of SECTIONS) {
    const html = await fs.readFile(path.join(SRC, file), 'utf8');
    const entries = parseEntries(html);
    sections[key] = entries;
    console.log(`  ${key}: ${entries.length} entries`);
  }

  const biography = {
    sections,
    narrative: null, // user-provided / drafted later (phase 4 polish)
  };

  // Bibliography
  const bibliographyHtml = await fs.readFile(path.join(SRC, 'biog_bibl.html'), 'utf8');
  const biblioEntries = parseEntries(bibliographyHtml);
  const bibliography = { entries: biblioEntries };
  console.log(`  bibliography: ${biblioEntries.length} entries`);

  await fs.writeFile(
    path.join(OUT_DIR, 'biography.json'),
    JSON.stringify(biography, null, 2) + '\n'
  );
  await fs.writeFile(
    path.join(OUT_DIR, 'bibliography.json'),
    JSON.stringify(bibliography, null, 2) + '\n'
  );

  console.log('biography.json + bibliography.json written.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

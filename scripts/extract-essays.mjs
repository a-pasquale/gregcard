#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(REPO_ROOT, '_backup/backup-5.6.2026_09-16-34_gregcard/homedir/public_html');
const OUT_DIR = path.join(REPO_ROOT, 'src/content/writings');

const ESSAYS = [
  { file: '1999.html',                slug: '1999',                             title: '1999',                           order: 1, description: 'A 1999 reflection on invention, influence, and the language of Modernism.' },
  { file: 'acts_of_art.html',         slug: 'acts-of-art',                      title: 'Acts of Art',                    order: 2, description: 'On the act of making: mirrors, light, illusion, and sculptural works from the 1970s.' },
  { file: 'adventures.html',          slug: 'adventures-in-actual-abstraction', title: 'Adventures in Actual Abstraction', order: 3, description: 'On abstraction grounded in materials and perception: resin castings, cylinders, and studio installation.' },
  { file: 'notes_of_engagement.html', slug: 'notes-on-engagement',              title: 'Notes on Engagement',            order: 4, description: 'On engagement with abstraction, and the artists who kept it alive.' },
  { file: 'statement.html',           slug: 'statement',                        title: 'Statement',                      order: 5, description: "The artist's statement." },
];

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&#146;/g, '’')
    .replace(/&#147;/g, '“')
    .replace(/&#148;/g, '”')
    .replace(/&#150;/g, '–')
    .replace(/&#151;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&copy;/g, '©')
    .replace(/&#169;/g, '©')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Extract the content TD — always the one with class="workTitle"
function extractContentRegion(html) {
  // Strip scripts and comments first
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Find the content TD — marked by class="workTitle"
  const tdMatch = clean.match(/<TD[^>]*class="workTitle"[^>]*>([\s\S]*?)<\/TD>\s*<TD valign="top">\s*<IMG/i);
  if (tdMatch) return tdMatch[1];

  // Fallback: everything after the last nav TABLE (the 165-wide nav column)
  const parts = clean.split(/<\/TABLE>/i);
  return parts[parts.length - 3] || clean;
}

function normaliseForCompare(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function htmlToMdx(html, essayTitle) {
  const region = extractContentRegion(html);

  // Pull all <p>...</p> blocks from the content region
  const paraMatches = [...region.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];

  const paras = paraMatches
    .map((m) => {
      let inner = m[1];
      // Use a sentinel so intentional <br> newlines survive whitespace normalisation
      inner = inner.replace(/<br\s*\/?>/gi, '|||BR|||');
      // Strip all remaining tags
      inner = inner.replace(/<[^>]+>/g, '');
      inner = decodeEntities(inner);
      // Normalise all whitespace (including HTML source indentation newlines) to single spaces
      inner = inner.replace(/\s+/g, ' ').trim();
      // Restore intentional line breaks; trim each resulting line
      inner = inner
        .replace(/\|\|\|BR\|\|\|/g, '\n')
        .split('\n')
        .map((l) => l.trim())
        .join('\n')
        .trim();
      return inner;
    })
    .filter((p) => {
      if (!p) return false;
      // Filter bare whitespace / nbsp-only paragraphs
      const stripped = p.replace(/[ \s]/g, '');
      if (!stripped) return false;
      // Filter nav chrome: "Back to WRITE ON menu" link text
      if (/back to write on menu/i.test(p)) return false;
      // Filter "Website by sweetandfizzy" chrome
      if (/sweetandfizzy/i.test(p)) return false;
      // Filter copyright lines
      if (/^©\s*\d{4}/i.test(p) || /^copyright/i.test(p)) return false;
      // Filter very short fragments (single chars, stray punctuation)
      if (stripped.length < 2) return false;
      // Filter the essay title repeated as first paragraph heading
      if (essayTitle && normaliseForCompare(p) === normaliseForCompare(essayTitle)) return false;
      return true;
    });

  return paras.join('\n\n');
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const e of ESSAYS) {
    const html = await fs.readFile(path.join(SRC, e.file), 'utf8');
    const body = htmlToMdx(html, e.title);
    const frontmatter = [
      '---',
      `title: ${JSON.stringify(e.title)}`,
      `order: ${e.order}`,
      `description: ${JSON.stringify(e.description)}`,
      '---',
      '',
      body,
      '',
    ].join('\n');
    await fs.writeFile(path.join(OUT_DIR, `${e.slug}.mdx`), frontmatter, 'utf8');
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    console.log(`wrote ${e.slug}.mdx  (${body.length} chars, ~${wordCount} words)`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

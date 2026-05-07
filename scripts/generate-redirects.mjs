#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const FOLIO_JSON = path.join(REPO_ROOT, 'src/data/folio.json');
const OUT = path.join(REPO_ROOT, 'public/_redirects');

// All legacy redirects use the `301!` "force" flag so they win over any
// shadowing static file (Astro generates dist/intro.html, dist/links.html,
// etc., which would otherwise serve directly and prevent the redirect).
const STATIC_REDIRECTS = `# Static page renames (force: win over shadowing static files)
/intro.html                 /intro                301!
/biog_bibl.html             /bibliography         301!
/biog_solo.html             /biography#solo       301!
/biog_grou.html             /biography#group      301!
/biog_awar.html             /biography#awards     301!
/biog_lect.html             /biography#lectures   301!
/biog_coll.html             /biography#collections 301!
/writeon.html               /writings             301!
/1999.html                  /writings/1999        301!
/acts_of_art.html           /writings/acts-of-art 301!
/adventures.html            /writings/adventures-in-actual-abstraction 301!
/notes_of_engagement.html   /writings/notes-on-engagement 301!
/statement.html             /writings/statement   301!
/links.html                 /links                301!
/contact.html               /contact              301!
/index.htm                  /                     301!

# PHP folio (no query string preserved — handled by client-side script on /folio)
/folio.php                  /folio                301!
/folioBU.php                /folio                301!

# Per-work popup.php redirects (image_root → slug). MUST come before the catch-all below.
`;

const POPUP_FALLBACK = `
# popup.php with no matching image — fallback to folio
/popup.php                  /folio                301!
`;

async function main() {
  const folio = JSON.parse(await fs.readFile(FOLIO_JSON, 'utf8'));

  // Netlify _redirects supports query-parameter conditions.
  // Syntax: /from query=val  /to  301!
  // Netlify processes rules top-to-bottom and stops on first match, so per-work
  // rules must precede the catch-all `/popup.php /folio` fallback.
  const popupRules = folio.map((w) =>
    `/popup.php image=${w.image_root}  /folio/${w.slug}  301!`
  );

  const out = STATIC_REDIRECTS + popupRules.join('\n') + '\n' + POPUP_FALLBACK;

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, out, 'utf8');

  const totalLines = STATIC_REDIRECTS.split('\n').filter((l) => l && !l.startsWith('#')).length + popupRules.length;
  console.log(`wrote ${totalLines} active redirect rules → ${path.relative(REPO_ROOT, OUT)}`);
  console.log(`  ${popupRules.length} per-work popup rules`);
}

main().catch((err) => { console.error(err); process.exit(1); });

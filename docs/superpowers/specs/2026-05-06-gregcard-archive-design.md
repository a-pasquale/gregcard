# Greg Card Archive Site — Design Spec

**Status:** Draft
**Date:** 2026-05-06
**Project root:** `/Users/drew/Sites/gregscard/`

## 1. Goals

Recreate `gregcard.com` as a long-lived archival site for Greg Card's body of work (1963–2003), hosted as static files on Netlify.

**Audience:** researchers, curators, art historians, interested visitors.

**Success criteria**
- Every work has a stable, citable URL.
- Every old URL on the legacy site (`folio.php?…`, `intro.html`, `biog_*.html`, etc.) 301s to its new home.
- Loads fast on any device; meets WCAG AA; readable without JavaScript.
- Maintainable by one person occasionally — no database, no server runtime, no auth.
- Lighthouse: Performance ≥ 95, Accessibility = 100, SEO = 100.

**Non-goals (explicit YAGNI):** site search, free-text tags, comments, social share widgets, analytics dashboards, dark mode, multi-language, e-commerce, CMS.

## 2. Source material

A cPanel backup is extracted at `_backup/backup-5.6.2026_09-16-34_gregcard/`. Contents we rely on:

- `homedir/public_html/` — legacy HTML, PHP, CSS, GIFs.
- `homedir/public_html/images/{thumb,small,large}/` — 234 artwork image files in three renditions:
  - `thumb/` ~924 KB total, ~370px wide
  - `small/` ~6 MB total
  - `large/` ~14 MB total, capped ~750px wide
- `mysql/gregcard_gscard.sql` — full database dump.
- `homedir/public_html/folio.php` — query semantics for the original folio (`WHERE medium=X AND decade=Y ORDER BY the_year DESC, title`).

### Database schema (single relevant table: `folio`)

| Field | Type | Notes |
|---|---|---|
| `id` | smallint PK | |
| `ref` | smallint | legacy reference no., not surfaced |
| `image_root` | varchar(9) | e.g., `pa81_0044`; primary image filename stem |
| `image2_root` | varchar(9) | optional second image (6 rows have one) |
| `small_width` / `small_height` | smallint | for `<img>` sizing |
| `large_width` / `large_height` | smallint | |
| `available` | tinyint(1) | for-sale flag — kept in data, **not displayed** |
| `title` | varchar(255) | |
| `medium` | varchar(25) | one of: `painting` (106), `paper` (82), `sculpture` (18), `boxes` (18), `installation` (4) |
| `description` | varchar(255) | materials line, e.g., `acrylic on canvas with mirror` |
| `decade` | tinyint(2) | one of: 0 (2000s), 60, 70, 80, 90 |
| `the_year` | varchar(16) | e.g., `1980` or `1976-80` |
| `dimensions` | varchar(35) | e.g., `60\"h X 70.75\"w X 10\"d` |

**Inventory:** 228 works total. 6 works have a non-empty `image2_root`. Combined unique image stems (primary + secondary) = 234, matching exactly the 234 files in `large/`. No orphans, no missing files. The 5 media break down as painting (106), paper (82), sculpture (18), boxes (18), installation (4) — `boxes` is a sculptural-object body of work Greg classified separately, primarily late-1990s through 2002 (image-root prefix `bx`). Preserved in the archive per the artist's own taxonomy.

### Other backup HTML to absorb

- `intro.html` — 2003 artist statement. Ingest verbatim.
- `biog_bibl.html` — bibliography of writings about Greg Card's work, 1968–2002.
- `biog_solo.html`, `biog_grou.html`, `biog_awar.html`, `biog_lect.html`, `biog_coll.html` — solo/group exhibitions, awards, lectures, collections. Combined into `/biography`.
- `1999.html`, `acts_of_art.html`, `adventures.html`, `notes_of_engagement.html`, `statement.html` — 5 essays by Greg, ingested into `/writings/[slug]`.
- `links.html` — 9 peer-artist external links.
- `contact.html` — Greg's contact details (only email surfaced on the new site).

## 3. Architecture

**Stack:** Astro static site → Netlify.

**Why this shape**
- Astro reads structured content (`folio.json`, `biography.json`, MDX essays) and generates one HTML page per work at build time.
- No runtime JavaScript required for any view. (~30 lines of vanilla JS for the timeline filter pills, optional progressive enhancement.)
- Build output is plain static HTML/CSS/images. If Astro ceases to exist, the built site keeps working forever.
- Astro's image pipeline produces responsive `srcset` (WebP/AVIF + JPEG fallback) at build time.

**Repository layout**

```
gregscard/
├── src/
│   ├── data/
│   │   ├── folio.json           # 228 works, extracted from SQL dump
│   │   ├── biography.json       # bio paragraph + lists from biog_*.html
│   │   └── bibliography.json    # critical writings list from biog_bibl.html
│   ├── content/
│   │   └── writings/            # 5 essays as MDX
│   ├── pages/
│   │   ├── index.astro          # /
│   │   ├── intro.astro          # /intro
│   │   ├── folio/
│   │   │   ├── index.astro      # /folio (timeline)
│   │   │   └── [slug].astro     # /folio/<slug>
│   │   ├── biography.astro      # /biography
│   │   ├── bibliography.astro   # /bibliography
│   │   ├── writings/
│   │   │   ├── index.astro      # /writings
│   │   │   └── [slug].astro     # /writings/<slug>
│   │   ├── links.astro          # /links
│   │   ├── contact.astro        # /contact
│   │   └── 404.astro
│   ├── layouts/
│   │   └── Base.astro
│   ├── components/
│   │   ├── Nav.astro
│   │   ├── Footer.astro
│   │   ├── FolioTimeline.astro  # decade-grouped grid + filter pills
│   │   ├── FolioCard.astro
│   │   └── WorkMeta.astro       # title/year/medium/dimensions block
│   └── styles/
│       └── global.css
├── public/
│   ├── images/
│   │   ├── thumb/               # copied from backup
│   │   ├── small/
│   │   └── large/
│   └── fonts/                   # self-hosted Crimson Pro + Inter
├── scripts/
│   ├── extract-folio.mjs        # one-time SQL → folio.json
│   ├── extract-biography.mjs    # one-time biog_*.html → biography.json
│   ├── extract-essays.mjs       # one-time HTML → MDX
│   ├── prep-images.mjs          # copy backup images into public/
│   ├── generate-redirects.mjs   # build _redirects from folio.json
│   └── validate-build.mjs       # CI assertions (see §10)
├── netlify.toml
├── astro.config.mjs
└── package.json
```

**Data flow**
- One-time, at project setup: SQL dump + HTML pages → JSON/MDX in `src/data` and `src/content` (committed to git).
- Going forward, edits are JSON/MDX edits in git, not database queries.

## 4. Routes

| Section | URL |
|---|---|
| Home | `/` |
| Intro | `/intro` |
| Folio (timeline browse) | `/folio` |
| Single work | `/folio/<slug>` |
| Biography | `/biography` (with `#solo`, `#group`, `#awards`, `#lectures`, `#collections` anchors) |
| Bibliography | `/bibliography` |
| Writings index | `/writings` |
| Single essay | `/writings/<slug>` |
| Links | `/links` |
| Contact | `/contact` |
| 404 | `/404` |

**Slug rule (works):** `slugify(title)-<year>`. The four-digit year is the first one in `the_year` (always either `YYYY` or `YYYY-YY`/`YYYY-YYYY`; verified against the 38 distinct values in the dump). On collision, append a short `image_root` suffix (e.g., `mass-con-1969-pa69-0019`). Slugs are computed once, written into `folio.json`, and stable forever.

**Slug rule (essays):** human-readable derived from filename: `1999`, `acts-of-art`, `adventures-in-actual-abstraction`, `notes-on-engagement`, `statement`.

## 5. Redirects (Netlify, all 301)

Declared in `netlify.toml` for static cases; `public/_redirects` auto-generated for per-work `popup.php` → `/folio/<slug>` mappings.

```
# Static page renames
/intro.html                → /intro
/biog_bibl.html            → /bibliography
/biog_solo.html            → /biography#solo
/biog_grou.html            → /biography#group
/biog_awar.html            → /biography#awards
/biog_lect.html            → /biography#lectures
/biog_coll.html            → /biography#collections
/writeon.html              → /writings
/1999.html                 → /writings/1999
/acts_of_art.html          → /writings/acts-of-art
/adventures.html           → /writings/adventures-in-actual-abstraction
/notes_of_engagement.html  → /writings/notes-on-engagement
/statement.html            → /writings/statement
/links.html                → /links
/contact.html              → /contact
/index.htm                 → /
/index.html                → /

# PHP folio
/folio.php                 → /folio
/folioBU.php               → /folio
/popup.php                 → /folio    (fallback when query missing)

# Generated entries (one per work, from folio.json):
/popup.php?image=<root>    → /folio/<slug>
```

For the legacy filter URLs (`/folio.php?media=painting&decade=80`), the new `/folio` page reads the query string on first load via the same small JS handler that powers the filter pills, and applies the matching medium and scrolls to the matching decade anchor. Without JS, the redirect still lands on `/folio` and all 228 works are visible — the visitor sees the full archive instead of a filtered slice, which for an archive is acceptable graceful degradation.

## 6. Components

### 6.1 Folio browse — `/folio`

Single page. Title block ("Folio · 228 works · 1963–2003") plus filter pills (`All`, `Painting`, `Paper`, `Sculpture`, `Boxes`, `Installation`). Below: thumbs grouped under decade headings (`2000s`, `1990s`, `1980s`, `1970s`, `1960s`, in that order). Each decade heading is an in-page anchor (`#1990s`).

- Sort within decade: `the_year DESC, title ASC`.
- Each thumb: `<a>` to `/folio/<slug>` with `aria-label="<title> (<year>) — <medium>"`. Title appears below or on hover.
- All 228 thumbs render at build time, lazy-loaded with `loading="lazy"` and `decoding="async"`.
- Filter pills toggle a `data-active-medium` attribute on the container; CSS hides non-matching cards. Without JS, all works show — fully functional.
- Mobile: 2-column grid; decade headers `position: sticky` at top.

### 6.2 Work detail — `/folio/<slug>`

```
[ nav ]
─────────────────────────────────────────────
[ large image — 1× and 2× srcset, click → unstyled full-res ]

  Title
  Year · medium
  Description (materials line)
  Dimensions

  [ optional second image, if image2_root present ]
─────────────────────────────────────────────
Adjacent works (prev/next within current chronological order;
same-decade or same-medium thumbs as a "see also" row)
[ nav ]
```

**Field rendering**
- `title` → H1 (italic if convention from peer artist sites suits; final call during polish).
- `the_year` rendered as-is (preserves `1976-80` ranges).
- `medium` lowercased; combined with `description` as one line: e.g., `1980 · sculpture · acrylic on canvas, birch plywood, mirror`.
- `dimensions` normalized once at extract time: `\"` → `″`, `X` → `×`, no other changes.
- `available` field: not displayed in this revision. Kept in `folio.json` for future use.

**`<head>` metadata**
- `<title>` = `<title> (<year>) — Greg Card`.
- Open Graph tags (`og:title`, `og:description`, `og:image`, `og:type=article`).
- JSON-LD `VisualArtwork` schema with title, dateCreated, artMedium, creator. `width`/`height` populated only when the `dimensions` string parses cleanly (regex like `^(\d+(?:\.\d+)?)["″]?h\s*[X×]\s*(\d+(?:\.\d+)?)["″]?w`); skipped silently otherwise rather than guessing.

**Image markup:** `<picture>` with AVIF + WebP + JPEG fallback. Alt text = `"<title> (<year>), <medium>"`.

### 6.3 Home — `/`

Title block (`Greg Card · contemporary abstractions, 1963–2003`), 1–2 featured works (hand-picked via `featured: true` flag in `folio.json` — start with two works from 2003), short orienting paragraph, primary nav. Quiet, sets tone, links into `/folio`.

### 6.4 Intro — `/intro`

Verbatim 2003 artist statement, signed `g s c`. Long-form reading layout (~75ch line length, generous leading).

### 6.5 Biography — `/biography`

```
Narrative paragraph (synthesized — see below)
─────────────
Solo Exhibitions      [#solo]
Group Exhibitions     [#group]
Awards & Grants       [#awards]
Lectures              [#lectures]
Collections           [#collections]
```

Each section is a chronological list extracted from the corresponding `biog_*.html` file at build setup time and stored in `biography.json`.

**Narrative paragraph:** synthesized once during build setup from the extracted facts (exhibitions, collections, critical reception years, location). Birth year unknown from backup contents — left as `[year TBD]` placeholder for the user to fill in. The user reviews and approves the draft before publish.

### 6.6 Bibliography — `/bibliography`

Chronological list of critical writings about Greg's work, 1968–2002, with full citations (author, title, publication, date). Extracted from `biog_bibl.html`.

### 6.7 Writings — `/writings` and `/writings/<slug>`

Index page lists 5 essays with brief descriptions. Each essay renders in long-form layout with serif body text, ~75ch lines, footer with the previous/next essay links. Source: MDX files in `src/content/writings/`, extracted from the corresponding HTML files in the backup.

### 6.8 Links — `/links`

Single list of 9 peer-artist external URLs. During build setup, each URL is fetched once; obviously dead links get an `(archived — site no longer available)` annotation. Entries are not removed — they're historically meaningful.

### 6.9 Contact — `/contact`

Short paragraph: name, single email link, note that copyright requests are handled by Artists' Rights Society (ARS) NY. No phone, no address.

### 6.10 404 — `/404`

Friendly note, link back to `/` and `/folio`. If the URL path matches the pattern `/folio/...`, additional copy suggests visiting the folio index.

## 7. Visual system

**Type**
- Headings: Crimson Pro (serif), self-hosted under `public/fonts/`.
- Body: Inter (humanist sans), 17–18px, line-height 1.6.
- Labels (decade headers, metadata): Inter at smaller size, letter-spaced, lowercase.
- No Google Fonts request — privacy and performance.

**Color**
- Background: `#fbfaf7` (warm near-white).
- Text: `#1a1a1a`.
- Muted text: `#7a7368`.
- Rules / borders: `#e8e4dc`.
- Accent (hover, emphasis only): `#5d4f3f` (deep warm brown).
- No bright colors — the work supplies the color.

**Spacing & layout**
- Max content width: ~75ch on essay pages, ~1100px on folio.
- Generous vertical air; mobile margins respect safe areas.
- One-column everywhere on mobile; two-column thumb grid on small screens, three-to-five on larger viewports.

**Imagery & chrome**
- The work itself is the only imagery on the site.
- No icons, no decorative GIFs, no menu-button images.

**Accessibility**
- AA contrast on all text.
- Visible focus rings; keyboard navigable end-to-end.
- Semantic HTML; one H1 per page.
- Alt text = `<title> (<year>), <medium>` for every artwork image.

## 8. Build & deploy

**Local development**
- Node 20+, `npm install`, `npm run dev` → `localhost:4321`.

**Build pipeline**
- `npm run build` invokes Astro, which:
  1. Reads `folio.json`, `biography.json`, `bibliography.json`, MDX essays.
  2. Generates one HTML page per route (228 work pages + ~12 other pages).
  3. Optimizes images into `dist/_astro/` with responsive `srcset`.
  4. Runs `scripts/generate-redirects.mjs` to emit `dist/_redirects`.
  5. Runs `scripts/validate-build.mjs` (assertions described in §10).

**Netlify config (`netlify.toml`)**
- `[build] command = "npm run build"`, `publish = "dist"`.
- Static redirects from §5.
- Cache headers: `/images/*` and `/fonts/*` → `Cache-Control: public, max-age=31536000, immutable`. HTML → `Cache-Control: public, max-age=0, must-revalidate`.
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, basic CSP allowing only self for scripts/styles/images.

**Branches & deploys**
- `main` → production (gregcard.com once DNS cuts over).
- `staging` → staging subdomain (e.g., `staging.gregcard.com` or Netlify preview URL).
- Every PR → Netlify deploy preview.

**No analytics, no monitoring** in initial scope. Plausible or Netlify Analytics can be wired in later in a one-line edit if desired.

## 9. One-time data extraction scripts

All scripts live in `scripts/`, are committed to the repo, and idempotent (re-running produces the same output).

- `extract-folio.mjs` — parse SQL dump → `src/data/folio.json`. Generates stable slugs, normalizes dimensions, validates schema.
- `extract-biography.mjs` — parse `biog_solo.html` etc. → `src/data/biography.json` with arrays for each section. Synthesizes a draft narrative paragraph for human review.
- `extract-essays.mjs` — convert 5 essay HTML files to MDX in `src/content/writings/`, preserving paragraph breaks.
- `prep-images.mjs` — copy `_backup/.../images/{thumb,small,large}/` into `public/images/`. Validates every `image_root` in `folio.json` has all three renditions.
- `generate-redirects.mjs` — read `folio.json`, append per-work `/popup.php?image=<root> → /folio/<slug>` lines to `_redirects`.

## 10. Testing & verification

No unit tests, no E2E suite. The site is ~12 page templates with zero runtime logic. Test budget goes to build-time validators and a deploy smoke checklist.

**Build-time validators (`scripts/validate-build.mjs`, fails the build on any error):**
1. Every `image_root` and `image2_root` in `folio.json` has matching `thumb/`, `small/`, `large/` files in `public/images/`.
2. Every redirect target in `netlify.toml` and `_redirects` resolves to a file in `dist/`.
3. All work slugs are unique.
4. HTML on every generated page passes `html-validate` with default rules.
5. No broken internal links (linkinator over `dist/`).

**Post-deploy smoke checklist (manual, run on staging):**
- [ ] Browse `/folio`; spot-check 10 thumbs across decades and media render.
- [ ] All five medium pills filter correctly; "All" restores full set.
- [ ] All five decade anchors scroll into view.
- [ ] Pick 5 random work pages: image loads, metadata renders, OG tags present, JSON-LD validates.
- [ ] Curl-check 20 legacy URLs → expected 301 + final 200.
- [ ] Lighthouse mobile + desktop on `/`, `/folio`, one work page, one essay: Performance ≥ 95, Accessibility = 100, Best Practices ≥ 95, SEO = 100.
- [ ] Keyboard-only nav through home → folio → work → back.
- [ ] VoiceOver / NVDA read-through of one work page.

## 11. Phasing

1. **Scaffold + data extraction.** Astro project, base layout, global styles, nav, all extraction scripts producing committed JSON/MDX.
2. **Folio MVP.** `/folio` timeline + filter, `/folio/<slug>` template, OG/JSON-LD, all 228 work pages building.
3. **Static pages.** `/`, `/intro`, `/contact`, `/links`, `/404`.
4. **Biography & writings.** `/biography`, `/bibliography`, `/writings/*`. Draft synthesized bio for user review.
5. **Redirects, headers, build validators.** `netlify.toml`, generated `_redirects`, validators wired into `npm run build`.
6. **Polish & verification.** Type/spacing pass on real content; manual smoke tests on staging deploy.
7. **DNS cutover.** User-driven, when ready.

## 12. Open items deferred to implementation

- Birth year for biography narrative — extract attempt during phase 4; placeholder if unknown.
- Featured works on home — start with two from 2003; user can swap by toggling `featured` flag.
- Whether italics on work titles (typographic convention) — final call during phase 6 polish.
- One-time link-rot check on `/links` external URLs.
- Whether to swap to higher-res images later — not in scope; image pipeline is structured to allow drop-in replacement of files in `public/images/`.

## 13. Out of scope for this project

- A search index (228 works browse easily; can be added later if needed).
- Free-text tagging beyond the existing `medium`/`decade` axes.
- A CMS or admin UI (edits are JSON/MDX in git).
- E-commerce or inquiry forms (mailto link is sufficient).
- Per-work commenting or visitor interaction.
- Analytics in the initial deploy.

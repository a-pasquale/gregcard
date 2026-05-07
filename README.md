# gregcard.com archive

Static archival site for Greg Card's body of work (1963–2003). Built with Astro, deployed to Netlify.

228 works · 5 media (painting, paper, sculpture, boxes, installation) · 1963–2003

## Development

```bash
npm install
npm run dev          # http://localhost:4321
```

The data lives in `src/data/folio.json` (228 works, generated once from the cPanel SQL dump) and `src/data/biography.json` / `bibliography.json`. Essays live in `src/content/writings/*.mdx`. All are committed to git, so a fresh checkout doesn't need access to the backup.

## Re-extracting from backup

If the backup at `_backup/backup-5.6.2026_09-16-34_gregcard/` is updated:

```bash
npm run extract      # runs extract-folio + extract-biography + extract-essays + prep-images
```

This regenerates `folio.json`, `biography.json`, `bibliography.json`, the 5 essay MDX files, and all 234 image renditions in `public/images/{thumb,small,large}/`.

## Build

```bash
npm run build        # generate-redirects → astro build → validate-build
```

The build pipeline:
1. Generates `public/_redirects` from `folio.json` (16 static rules + 228 per-work `popup.php?image=…` rules)
2. Astro builds `dist/` (242 pages: home + folio index + 228 work pages + bio + bibliography + writings index + 5 essays + intro/links/contact + 404)
3. Runs `validate-build.mjs` to assert: all slugs unique, all work pages built, all images present, all core pages exist, all redirect targets resolve

## Tests

```bash
npm test             # runs node --test on tests/*.test.mjs (slugify, dimensions, extract-folio)
```

## Deploying to Netlify

1. Push to a GitHub repo.
2. In Netlify: New site → import from Git → select repo. `netlify.toml` declares the build command and headers, so no manual fields needed.
3. Configure branch deploys: production = `main`, branch deploys for `staging` (or any chosen staging branch).
4. After first deploy, run the smoke checklist in `docs/superpowers/specs/2026-05-06-gregcard-archive-design.md` §10.
5. When ready, point `gregcard.com` DNS to Netlify per their custom-domain instructions.

## Project docs

- `docs/superpowers/specs/2026-05-06-gregcard-archive-design.md` — design spec
- `docs/superpowers/plans/2026-05-06-gregcard-archive.md` — implementation plan

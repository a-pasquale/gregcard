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
  assert.equal(rows.length, 228);
  // Spot-check the first row
  assert.equal(rows[0].image_root, 'in68_0029');
  // Spot-check medium counts
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.medium]: (acc[r.medium] || 0) + 1 }), {});
  assert.equal(counts.painting, 106);
  assert.equal(counts.paper, 82);
  assert.equal(counts.sculpture, 18);
  assert.equal(counts.installation, 4);
});

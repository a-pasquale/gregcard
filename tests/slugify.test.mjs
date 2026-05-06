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

test('slugify removes smart apostrophes (U+2018, U+2019)', () => {
  // Use explicit escapes to prevent editor/tool normalization
  assert.equal(slugify('Greg’s Work'), 'gregs-work');
  assert.equal(slugify('‘Quoted’ Title'), 'quoted-title');
});

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

// tests/snapshot.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { readSnapshot, writeSnapshot, validateSnapshot, makeSnapshot } from '../src/snapshot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(__dirname, 'fixtures', 'baseline.json');

test('readSnapshot returns ViolationSet from file', async () => {
  const vs = await readSnapshot(BASELINE);
  assert.equal(typeof vs.url, 'string');
  assert.equal(typeof vs.timestamp, 'string');
  assert.ok(Array.isArray(vs.violations));
  assert.equal(vs.violations.length, 2);
});

test('readSnapshot ViolationSet has correct violation shape', async () => {
  const vs = await readSnapshot(BASELINE);
  const v = vs.violations[0];
  assert.equal(typeof v.id, 'string');
  assert.equal(typeof v.impact, 'string');
  assert.ok(Array.isArray(v.nodes));
  assert.ok(Array.isArray(v.nodes[0].target));
  assert.equal(typeof v.nodes[0].html, 'string');
});

test('readSnapshot throws on missing file', async () => {
  await assert.rejects(
    () => readSnapshot('/nonexistent/path.json'),
    { code: 'ENOENT' }
  );
});

test('readSnapshot throws on invalid JSON', async () => {
  const tmp = join(tmpdir(), 'bad-snapshot.json');
  await writeFile(tmp, 'not json');
  try {
    await assert.rejects(
      () => readSnapshot(tmp),
      /Invalid snapshot/
    );
  } finally {
    await unlink(tmp).catch(() => {});
  }
});

test('readSnapshot throws on wrong shape (missing violations)', async () => {
  const tmp = join(tmpdir(), 'wrong-shape.json');
  await writeFile(tmp, JSON.stringify({ url: 'x', timestamp: 'y' }));
  try {
    await assert.rejects(
      () => readSnapshot(tmp),
      /Invalid snapshot/
    );
  } finally {
    await unlink(tmp).catch(() => {});
  }
});

test('writeSnapshot + readSnapshot round-trip', async () => {
  const tmp = join(tmpdir(), 'round-trip.json');
  const vs = await readSnapshot(BASELINE);
  vs.url = 'https://test.example.com/round-trip';
  try {
    await writeSnapshot(vs, tmp);
    const restored = await readSnapshot(tmp);
    assert.equal(restored.url, 'https://test.example.com/round-trip');
    assert.equal(restored.violations.length, vs.violations.length);
  } finally {
    await unlink(tmp).catch(() => {});
  }
});

test('makeSnapshot sets url and timestamp', () => {
  const vs = makeSnapshot('https://example.com', []);
  assert.equal(vs.url, 'https://example.com');
  assert.equal(typeof vs.timestamp, 'string');
  assert.ok(Array.isArray(vs.violations));
  assert.equal(vs.violations.length, 0);
});

test('makeSnapshot resolves file path for non-http input', () => {
  const vs = makeSnapshot('/some/absolute/path.json', []);
  assert.ok(vs.url.includes('path.json'), 'url should contain the filename');
});

test('validateSnapshot accepts valid ViolationSet', () => {
  const vs = { url: 'https://x.com', timestamp: '2026-01-01', violations: [] };
  assert.doesNotThrow(() => validateSnapshot(vs));
});

test('validateSnapshot throws on missing violations array', () => {
  assert.throws(
    () => validateSnapshot({ url: 'x', timestamp: 'y' }),
    /Invalid snapshot/
  );
});

test('makeSnapshot throws TypeError when url is null', () => {
  assert.throws(
    () => makeSnapshot(null, []),
    { name: 'TypeError' }
  );
});

test('makeSnapshot throws TypeError when url is undefined', () => {
  assert.throws(
    () => makeSnapshot(undefined, []),
    { name: 'TypeError' }
  );
});

test('makeSnapshot preserves file:// URI without calling resolve', () => {
  const vs = makeSnapshot('file:///tmp/snapshot.json', []);
  assert.equal(vs.url, 'file:///tmp/snapshot.json');
});

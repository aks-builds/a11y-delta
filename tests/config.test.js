// tests/config.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, mergeConfig } from '../src/config.js';

const TMP = join(tmpdir(), 'a11y-delta-config-tests');
await mkdir(TMP, { recursive: true });

test('loadConfig returns {} when file does not exist', async () => {
  const result = await loadConfig(join(TMP, 'nonexistent.yml'));
  assert.deepEqual(result, {});
});

test('loadConfig parses valid YAML and returns object', async () => {
  const f = join(TMP, 'valid.yml');
  await writeFile(f, 'base: https://staging.example.com\nconcurrency: 4\n');
  try {
    const result = await loadConfig(f);
    assert.equal(result.base, 'https://staging.example.com');
    assert.equal(result.concurrency, 4);
  } finally {
    await unlink(f).catch(() => {});
  }
});

test('loadConfig parses pages array from YAML', async () => {
  const f = join(TMP, 'pages.yml');
  await writeFile(f, 'base: https://example.com\npages:\n  - /\n  - /products/\n');
  try {
    const result = await loadConfig(f);
    assert.deepEqual(result.pages, ['/', '/products/']);
  } finally {
    await unlink(f).catch(() => {});
  }
});

test('loadConfig throws with informative message on invalid YAML', async () => {
  const f = join(TMP, 'bad.yml');
  await writeFile(f, 'key: [unclosed bracket\n');
  try {
    await assert.rejects(() => loadConfig(f), /Invalid .a11y-delta.yml/);
  } finally {
    await unlink(f).catch(() => {});
  }
});

test('loadConfig with required:true throws when file is missing', async () => {
  await assert.rejects(
    () => loadConfig(join(TMP, 'missing.yml'), { required: true }),
    /Config file not found/
  );
});

test('mergeConfig CLI args override file config', () => {
  const file = { base: 'https://file-base.com', concurrency: 2, 'fail-on': 'moderate', pages: [] };
  const cli  = { base: 'https://cli-base.com', 'fail-on': 'critical', 'candidate-base': 'https://cand.com' };
  const merged = mergeConfig(file, cli);
  assert.equal(merged.base, 'https://cli-base.com');
  assert.equal(merged['fail-on'], 'critical');
  assert.equal(merged['candidate-base'], 'https://cand.com');
  assert.equal(merged.concurrency, 2); // from file, CLI didn't set it
});

test('mergeConfig defaults concurrency to 3 when neither CLI nor file set it', () => {
  const merged = mergeConfig({}, {});
  assert.equal(merged.concurrency, 3);
});

test('mergeConfig throws when concurrency is not a positive integer', () => {
  assert.throws(() => mergeConfig({}, { concurrency: '0' }), /positive integer/);
  assert.throws(() => mergeConfig({}, { concurrency: '-1' }), /positive integer/);
});

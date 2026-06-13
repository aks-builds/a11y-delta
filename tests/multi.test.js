// tests/multi.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSnapshot } from '../src/snapshot.js';
import { runMulti } from '../src/multi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES  = join(__dirname, 'fixtures');

// Stub auditFn that returns fixture snapshots based on URL path
async function fixtureAudit(url) {
  // Returns the baseline fixture for the home page, products for /products/
  const path = new URL(url).pathname;
  if (path === '/products/') {
    return readSnapshot(join(FIXTURES, 'snapshots-baseline', 'products.json'));
  }
  return readSnapshot(join(FIXTURES, 'snapshots-baseline', 'index.json'));
}

const BASE_CONFIG = {
  base:             'https://staging.example.com',
  'candidate-base': 'https://preview.example.com',
  pages:            ['/', '/products/'],
  concurrency:      2,
  'fail-on':        'critical,serious',
  'output-style':   'per-page',
  'save-dir':       null,
  baseline:         null,
  timeout:          30000,
  viewport:         '1280x800',
  'wait-for':       null,
  header:           [],
  format:           'table',
  save:             null,
};

test('runMulti returns MultiResult with correct page count', async () => {
  const result = await runMulti(BASE_CONFIG, { auditFn: fixtureAudit });
  assert.equal(result.pages.length, 2);
});

test('runMulti returns exitCode 0 when no new violations', async () => {
  // Both baseline and candidate return the same snapshots (no diff)
  const result = await runMulti(BASE_CONFIG, { auditFn: fixtureAudit });
  assert.equal(result.exitCode, 0);
  assert.equal(result.totalNew, 0);
  assert.equal(result.cleanPages, 2);
});

test('runMulti detects new violations when candidate has more than baseline', async () => {
  const { readSnapshot: rs } = await import('../src/snapshot.js');
  const candidateWithNew = await rs(join(FIXTURES, 'candidate-new.json'));

  async function auditWithNew(url) {
    // Candidate has a new violation; baseline is empty
    const path = new URL(url).pathname;
    if (path === '/') {
      // Simulate: preview has a new violation vs staging (which had none here)
      if (url.includes('preview')) return candidateWithNew;
      return { url, timestamp: 't', violations: [] };
    }
    return { url, timestamp: 't', violations: [] };
  }

  const result = await runMulti(BASE_CONFIG, { auditFn: auditWithNew });
  assert.ok(result.totalNew > 0);
  assert.equal(result.exitCode, 1);
  assert.ok(result.failPages >= 1);
});

test('runMulti returns exitCode 2 when all pages error', async () => {
  async function alwaysThrow() { throw new Error('network timeout'); }
  const result = await runMulti(BASE_CONFIG, { auditFn: alwaysThrow });
  assert.equal(result.exitCode, 2);
  assert.equal(result.errorPages, 2);
  assert.equal(result.cleanPages, 0);
});

test('runMulti captures per-page error without crashing', async () => {
  let call = 0;
  async function partialFail(url) {
    call++;
    if (call === 1) throw new Error('timeout on page 1');
    return { url, timestamp: 't', violations: [] };
  }
  const result = await runMulti(BASE_CONFIG, { auditFn: partialFail });
  assert.equal(result.errorPages, 1);
  assert.equal(result.cleanPages, 1);
  assert.equal(result.exitCode, 0);
});

test('runMulti MultiResult has all required fields', async () => {
  const result = await runMulti(BASE_CONFIG, { auditFn: fixtureAudit });
  for (const field of ['pages','totalNew','byCritical','bySerious','byModerate','byMinor','cleanPages','failPages','errorPages','exitCode']) {
    assert.ok(field in result, `missing field: ${field}`);
  }
});

test('runMulti PageResult has all required fields', async () => {
  const result = await runMulti(BASE_CONFIG, { auditFn: fixtureAudit });
  const page = result.pages[0];
  for (const field of ['url','baselineUrl','newViolations','baselineCount','candidateCount','error']) {
    assert.ok(field in page, `missing field in PageResult: ${field}`);
  }
});

test('runMulti throws when no pages resolve', async () => {
  const cfg = { ...BASE_CONFIG, pages: [], urls: null, sitemap: null };
  await assert.rejects(() => runMulti(cfg, { auditFn: fixtureAudit }), /No pages/);
});

test('runMulti respects fail-on threshold (critical only does not exit 1 for serious)', async () => {
  const vsWithSerious = {
    url: 'x', timestamp: 't',
    violations: [{
      id: 'color-contrast', impact: 'serious', description: 'd', helpUrl: 'h',
      nodes: [{ target: ['button'], html: '<button>', failureSummary: 'f' }]
    }]
  };
  async function auditSerious(url) {
    if (url.includes('preview')) return vsWithSerious;
    return { url, timestamp: 't', violations: [] };
  }
  const result = await runMulti({ ...BASE_CONFIG, 'fail-on': 'critical' }, { auditFn: auditSerious });
  assert.ok(result.totalNew >= 1);
  assert.equal(result.exitCode, 0); // serious new violation but fail-on is critical only
});

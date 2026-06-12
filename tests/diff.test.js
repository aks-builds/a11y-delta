// tests/diff.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSnapshot } from '../src/snapshot.js';
import { expand, violationKey, diff } from '../src/diff.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(__dirname, 'fixtures', 'baseline.json');
const SAME     = join(__dirname, 'fixtures', 'candidate-same.json');
const NEW_V    = join(__dirname, 'fixtures', 'candidate-new.json');

test('expand returns one entry per node across all violations', async () => {
  const vs = await readSnapshot(BASELINE);
  const entries = expand(vs);
  assert.equal(entries.length, 2); // 2 violations × 1 node each
});

test('expand entry has id, impact, target, html, helpUrl, description', async () => {
  const vs = await readSnapshot(BASELINE);
  const e = expand(vs)[0];
  assert.equal(typeof e.id, 'string');
  assert.equal(typeof e.impact, 'string');
  assert.ok(Array.isArray(e.target));
  assert.equal(typeof e.html, 'string');
  assert.equal(typeof e.helpUrl, 'string');
  assert.equal(typeof e.description, 'string');
});

test('expand handles violation with multiple nodes', () => {
  const vs = {
    url: 'x', timestamp: 'y',
    violations: [{
      id: 'color-contrast', impact: 'serious',
      description: 'desc', helpUrl: 'http://x',
      nodes: [
        { target: ['button.a'], html: '<button>', failureSummary: 'f' },
        { target: ['button.b'], html: '<button>', failureSummary: 'f' },
      ]
    }]
  };
  assert.equal(expand(vs).length, 2);
});

test('violationKey produces stable string with length prefix', () => {
  const key = violationKey({ id: 'color-contrast', target: ['button.cta-primary'] });
  assert.equal(key, 'color-contrast::1:button.cta-primary');
});

test('violationKey joins multi-selector target with pipe and length prefix', () => {
  const key = violationKey({ id: 'label', target: ['form', 'input[name="q"]'] });
  assert.equal(key, 'label::2:form|input[name="q"]');
});

test('diff returns empty array when candidate has same violations as baseline', async () => {
  const baseline  = await readSnapshot(BASELINE);
  const candidate = await readSnapshot(SAME);
  assert.deepEqual(diff(baseline, candidate), []);
});

test('diff returns the new entry when candidate adds one violation', async () => {
  const baseline  = await readSnapshot(BASELINE);
  const candidate = await readSnapshot(NEW_V);
  const result = diff(baseline, candidate);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'image-alt');
  assert.deepEqual(result[0].target, ['img.hero']);
});

test('diff does not return violations already in baseline', async () => {
  const baseline  = await readSnapshot(BASELINE);
  const candidate = await readSnapshot(NEW_V);
  const ids = diff(baseline, candidate).map(e => e.id);
  assert.ok(!ids.includes('color-contrast'));
  assert.ok(!ids.includes('aria-label'));
});

test('diff returns all entries when baseline is empty', async () => {
  const empty     = { url: 'x', timestamp: 'y', violations: [] };
  const candidate = await readSnapshot(NEW_V);
  assert.equal(diff(empty, candidate).length, 3);
});

test('violationKey with empty target does not collide with single-empty-string target', () => {
  const keyEmpty  = violationKey({ id: 'foo', target: [] });
  const keySingle = violationKey({ id: 'foo', target: [''] });
  assert.notEqual(keyEmpty, keySingle);
});

test('expand returns empty array for violation with zero nodes', () => {
  const vs = {
    url: 'x', timestamp: 'y',
    violations: [{ id: 'foo', impact: 'minor', description: 'd', helpUrl: 'h', nodes: [] }]
  };
  assert.equal(expand(vs).length, 0);
});

test('expand uses empty string for missing failureSummary', () => {
  const vs = {
    url: 'x', timestamp: 'y',
    violations: [{
      id: 'foo', impact: 'minor', description: 'd', helpUrl: 'h',
      nodes: [{ target: ['a'], html: '<a>' }]  // no failureSummary
    }]
  };
  assert.equal(expand(vs)[0].failureSummary, '');
});

test('diff deduplicates when candidate has same node twice', async () => {
  const baseline  = await readSnapshot(BASELINE);
  // Manually create a candidate with image-alt appearing twice on the same element
  const candidate = {
    url: 'x', timestamp: 'y',
    violations: [
      {
        id: 'image-alt', impact: 'critical', description: 'd', helpUrl: 'h',
        nodes: [
          { target: ['img.hero'], html: '<img>', failureSummary: 'f' },
          { target: ['img.hero'], html: '<img>', failureSummary: 'f' }, // duplicate
        ]
      }
    ]
  };
  const result = diff(baseline, candidate);
  assert.equal(result.length, 1, 'duplicate nodes should be deduplicated to one');
  assert.equal(result[0].id, 'image-alt');
});

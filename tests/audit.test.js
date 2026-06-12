// tests/audit.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditConfig } from '../src/audit.js';

test('buildAuditConfig returns chromium browser type', () => {
  const cfg = buildAuditConfig({});
  assert.equal(cfg.browserType, 'chromium');
});

test('buildAuditConfig sets headless: true', () => {
  const cfg = buildAuditConfig({});
  assert.equal(cfg.launchOptions.headless, true);
});

test('buildAuditConfig default viewport is 1280x800', () => {
  const cfg = buildAuditConfig({});
  assert.deepEqual(cfg.viewport, { width: 1280, height: 800 });
});

test('buildAuditConfig parses viewport string correctly', () => {
  const cfg = buildAuditConfig({ viewport: '1440x900' });
  assert.deepEqual(cfg.viewport, { width: 1440, height: 900 });
});

test('buildAuditConfig default timeout is 30000', () => {
  const cfg = buildAuditConfig({});
  assert.equal(cfg.timeout, 30000);
});

test('buildAuditConfig uses provided timeout', () => {
  const cfg = buildAuditConfig({ timeout: 15000 });
  assert.equal(cfg.timeout, 15000);
});

test('buildAuditConfig extraHTTPHeaders is empty object when no headers', () => {
  const cfg = buildAuditConfig({});
  assert.deepEqual(cfg.extraHTTPHeaders, {});
});

test('buildAuditConfig includes provided headers', () => {
  const cfg = buildAuditConfig({ headers: { Authorization: 'Bearer tok' } });
  assert.deepEqual(cfg.extraHTTPHeaders, { Authorization: 'Bearer tok' });
});

test('buildAuditConfig throws RangeError for invalid viewport string', () => {
  assert.throws(
    () => buildAuditConfig({ viewport: 'badxbad' }),
    { name: 'RangeError' }
  );
});

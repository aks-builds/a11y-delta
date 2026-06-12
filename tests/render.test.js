// tests/render.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTable, renderGithubComment, renderJson } from '../src/render.js';

const BASE_META  = { url: 'https://staging.example.com', violationCount: 2 };
const CAND_META  = { url: 'https://preview.example.com', violationCount: 3 };

const ONE_NEW = [
  {
    id: 'image-alt', impact: 'critical',
    description: 'Ensures <img> elements have alternate text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
    target: ['img.hero'], html: '<img class="hero" src="/hero.jpg">',
    failureSummary: 'Fix any: Element does not have an alt attribute',
  }
];
const EMPTY = [];

const SHADOW_TARGET = [
  {
    id: 'color-contrast', impact: 'serious',
    description: 'Elements must meet minimum color contrast ratio thresholds',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
    target: ['div.card', 'span.label'],
    html: '<span class="label">text</span>',
    failureSummary: 'Fix: insufficient color contrast',
  }
];

// ── renderTable ───────────────────────────────────────────────────────────

test('renderTable with violations includes violation id', () => {
  assert.ok(renderTable(ONE_NEW, BASE_META, CAND_META).includes('image-alt'));
});

test('renderTable with violations includes impact', () => {
  assert.ok(renderTable(ONE_NEW, BASE_META, CAND_META).includes('critical'));
});

test('renderTable with violations includes target element', () => {
  assert.ok(renderTable(ONE_NEW, BASE_META, CAND_META).includes('img.hero'));
});

test('renderTable with no violations shows no-new message', () => {
  const out = renderTable(EMPTY, BASE_META, CAND_META);
  assert.ok(out.toLowerCase().includes('no new') || out.includes('0 new'));
});

test('renderTable shows both URLs', () => {
  const out = renderTable(ONE_NEW, BASE_META, CAND_META);
  assert.ok(out.includes('staging.example.com'));
  assert.ok(out.includes('preview.example.com'));
});

// ── renderGithubComment ──────────────────────────────────────────────────

test('renderGithubComment with violations has markdown table header', () => {
  const out = renderGithubComment(ONE_NEW, BASE_META, CAND_META);
  assert.ok(out.includes('| Impact |'));
  assert.ok(out.includes('| Rule |'));
});

test('renderGithubComment with no violations shows pass message', () => {
  const out = renderGithubComment(EMPTY, BASE_META, CAND_META);
  assert.ok(out.includes('No new') || out.includes('✅'));
});

test('renderGithubComment with violations includes helpUrl as link', () => {
  const out = renderGithubComment(ONE_NEW, BASE_META, CAND_META);
  assert.ok(out.includes('dequeuniversity.com'));
});

test('renderGithubComment with violations includes heading with count', () => {
  const out = renderGithubComment(ONE_NEW, BASE_META, CAND_META);
  assert.ok(out.includes('## ♿') || out.includes('## 🔍'));
  assert.ok(out.includes('1'));
});

// ── renderJson ───────────────────────────────────────────────────────────

test('renderJson produces valid JSON', () => {
  assert.doesNotThrow(() => JSON.parse(renderJson(ONE_NEW, BASE_META, CAND_META, 1)));
});

test('renderJson has newViolations, baselineCount, candidateCount, newCount, exitCode', () => {
  const p = JSON.parse(renderJson(ONE_NEW, BASE_META, CAND_META, 1));
  assert.ok(Array.isArray(p.newViolations));
  assert.equal(p.newViolations.length, 1);
  assert.equal(p.baselineCount, 2);
  assert.equal(p.candidateCount, 3);
  assert.equal(p.newCount, 1);
  assert.equal(p.exitCode, 1);
});

test('renderJson with no violations has exitCode 0 and empty array', () => {
  const p = JSON.parse(renderJson(EMPTY, BASE_META, CAND_META, 0));
  assert.equal(p.exitCode, 0);
  assert.equal(p.newViolations.length, 0);
  assert.equal(p.newCount, 0);
});

test('renderTable joins multi-element target with comma', () => {
  const out = renderTable(SHADOW_TARGET, BASE_META, CAND_META);
  assert.ok(out.includes('div.card'));
  assert.ok(out.includes('span.label'));
});

test('renderGithubComment joins multi-element target in cell', () => {
  const out = renderGithubComment(SHADOW_TARGET, BASE_META, CAND_META);
  assert.ok(out.includes('div.card'));
  assert.ok(out.includes('span.label'));
});

test('renderGithubComment escapes pipe in target selector', () => {
  const withPipe = [{
    id: 'label', impact: 'critical',
    description: 'd', helpUrl: 'https://x.com',
    target: ['input[lang|=en]'],
    html: '<input>', failureSummary: 'f',
  }];
  const out = renderGithubComment(withPipe, BASE_META, CAND_META);
  // The pipe in the selector should be escaped so it doesn't break the markdown table
  assert.ok(out.includes('\\|'), 'pipe in selector must be escaped');
});

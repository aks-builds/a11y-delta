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

// ── Multi render tests ───────────────────────────────────────────────────────

import {
  renderTableMulti, renderGithubCommentMulti, renderJsonMulti
} from '../src/render.js';

const PAGE_CLEAN = {
  url: 'https://preview.example.com/', baselineUrl: 'https://staging.example.com/',
  newViolations: [], baselineCount: 1, candidateCount: 1, error: null,
};
const PAGE_FAIL = {
  url: 'https://preview.example.com/products/', baselineUrl: 'https://staging.example.com/products/',
  newViolations: [
    { id: 'color-contrast', impact: 'critical', description: 'd',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
      target: ['button.add-to-cart'], html: '<button>', failureSummary: 'f' },
  ],
  baselineCount: 0, candidateCount: 1, error: null,
};
const PAGE_ERROR = {
  url: 'https://preview.example.com/checkout/', baselineUrl: 'https://staging.example.com/checkout/',
  newViolations: [], baselineCount: 0, candidateCount: 0, error: 'navigation timeout',
};

const MULTI_ALL_CLEAN = {
  pages: [PAGE_CLEAN, { ...PAGE_CLEAN, url: 'https://preview.example.com/about/' }],
  totalNew: 0, byCritical: 0, bySerious: 0, byModerate: 0, byMinor: 0,
  cleanPages: 2, failPages: 0, errorPages: 0, exitCode: 0,
};
const MULTI_WITH_FAIL = {
  pages: [PAGE_CLEAN, PAGE_FAIL],
  totalNew: 1, byCritical: 1, bySerious: 0, byModerate: 0, byMinor: 0,
  cleanPages: 1, failPages: 1, errorPages: 0, exitCode: 1,
};
const MULTI_WITH_ERROR = {
  pages: [PAGE_CLEAN, PAGE_ERROR],
  totalNew: 0, byCritical: 0, bySerious: 0, byModerate: 0, byMinor: 0,
  cleanPages: 1, failPages: 0, errorPages: 1, exitCode: 0,
};

// renderTableMulti
test('renderTableMulti with all clean pages includes no-new message per page', () => {
  const out = renderTableMulti(MULTI_ALL_CLEAN);
  assert.ok(out.includes('No new violations'));
});

test('renderTableMulti with failing page includes violation rule id', () => {
  const out = renderTableMulti(MULTI_WITH_FAIL);
  assert.ok(out.includes('color-contrast'));
});

test('renderTableMulti with failing page includes page URL', () => {
  const out = renderTableMulti(MULTI_WITH_FAIL);
  assert.ok(out.includes('preview.example.com/products/'));
});

test('renderTableMulti includes total new count in footer', () => {
  const out = renderTableMulti(MULTI_WITH_FAIL);
  assert.ok(out.includes('new: 1'));
});

test('renderTableMulti failures-only hides clean pages', () => {
  const out = renderTableMulti(MULTI_WITH_FAIL, 'failures-only');
  assert.ok(!out.includes('No new violations'));
  assert.ok(out.includes('hidden'));
});

test('renderTableMulti includes page error text', () => {
  const out = renderTableMulti(MULTI_WITH_ERROR);
  assert.ok(out.includes('navigation timeout') || out.includes('Error'));
});

// renderGithubCommentMulti
test('renderGithubCommentMulti has h2 heading with violation count', () => {
  const out = renderGithubCommentMulti(MULTI_WITH_FAIL);
  assert.ok(out.includes('## ♿'));
  assert.ok(out.includes('1'));
});

test('renderGithubCommentMulti has summary table with Page/New/Worst columns', () => {
  const out = renderGithubCommentMulti(MULTI_WITH_FAIL);
  assert.ok(out.includes('| Page |'));
  assert.ok(out.includes('| New |'));
  assert.ok(out.includes('| Worst |'));
});

test('renderGithubCommentMulti has details block for failing page', () => {
  const out = renderGithubCommentMulti(MULTI_WITH_FAIL);
  assert.ok(out.includes('<details>'));
  assert.ok(out.includes('color-contrast'));
});

test('renderGithubCommentMulti all clean shows no-new heading', () => {
  const out = renderGithubCommentMulti(MULTI_ALL_CLEAN);
  assert.ok(out.includes('No new violations') || out.includes('✅'));
});

test('renderGithubCommentMulti with error pages does not show green checkmark in heading', () => {
  const out = renderGithubCommentMulti(MULTI_WITH_ERROR);
  const heading = out.split('\n')[0];
  assert.ok(!heading.includes('✅'), `heading must not contain ✅: ${heading}`);
  assert.ok(out.includes('⚠️') || out.includes('error') || out.includes('could not'));
});

// renderJsonMulti
test('renderJsonMulti produces valid JSON', () => {
  assert.doesNotThrow(() => JSON.parse(renderJsonMulti(MULTI_WITH_FAIL)));
});

test('renderJsonMulti has pages array and summary object', () => {
  const p = JSON.parse(renderJsonMulti(MULTI_WITH_FAIL));
  assert.ok(Array.isArray(p.pages));
  assert.ok(p.summary);
  assert.equal(p.summary.totalNew, 1);
  assert.equal(p.summary.failPages, 1);
  assert.equal(p.summary.cleanPages, 1);
  assert.equal(p.exitCode, 1);
});

test('renderJsonMulti page entry has url, baselineUrl, newViolations, error', () => {
  const p = JSON.parse(renderJsonMulti(MULTI_WITH_FAIL));
  const page = p.pages[1]; // PAGE_FAIL
  assert.equal(page.url, 'https://preview.example.com/products/');
  assert.equal(page.error, null);
  assert.ok(Array.isArray(page.newViolations));
  assert.equal(page.newViolations.length, 1);
});

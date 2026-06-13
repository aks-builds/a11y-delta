// src/render.js

const IMPACT_EMOJI = { critical: '🔴', serious: '🟠', moderate: '🟡', minor: '⚪' };

/**
 * Terminal-friendly table output.
 * @param {Array}  newViolations - expanded violation entries from diff()
 * @param {{ url: string, violationCount: number }} baselineMeta
 * @param {{ url: string, violationCount: number }} candidateMeta
 * @returns {string}
 */
export function renderTable(newViolations, baselineMeta, candidateMeta) {
  const count = newViolations.length;
  const lines = [''];

  lines.push(count === 0
    ? 'a11y-delta — No new violations ✅'
    : `a11y-delta — ${count} new violation${count === 1 ? '' : 's'} found`);
  lines.push('');

  if (count > 0) {
    const trunc = (s, w) => s.length > w ? s.slice(0, w - 1) + '…' : s;
    const col   = (s, w) => trunc(String(s ?? ''), w).padEnd(w);
    const W = { impact: 10, rule: 30, element: 40 };
    lines.push(`${col('Impact', W.impact)}  ${col('Rule', W.rule)}  ${col('Element', W.element)}`);
    lines.push(`${'─'.repeat(W.impact)}  ${'─'.repeat(W.rule)}  ${'─'.repeat(W.element)}`);
    for (const v of newViolations) {
      lines.push(`${col(v.impact, W.impact)}  ${col(v.id, W.rule)}  ${col(v.target.join(', '), W.element)}`);
    }
    lines.push('');
  }

  lines.push(`baseline:  ${baselineMeta.url}  (${baselineMeta.violationCount} total violations)`);
  lines.push(`candidate: ${candidateMeta.url}  (${candidateMeta.violationCount} total violations)`);

  if (count > 0) {
    const byCritical = newViolations.filter(v => v.impact === 'critical').length;
    const bySerious  = newViolations.filter(v => v.impact === 'serious').length;
    lines.push(`new:       ${count}  (critical: ${byCritical}, serious: ${bySerious})`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * GitHub PR comment markdown.
 * @param {Array}  newViolations
 * @param {{ url: string, violationCount: number }} baselineMeta
 * @param {{ url: string, violationCount: number }} candidateMeta
 * @returns {string}
 */
export function renderGithubComment(newViolations, baselineMeta, candidateMeta) {
  const count = newViolations.length;
  const lines = [];

  if (count === 0) {
    lines.push('## ♿ Accessibility Delta — No new violations ✅');
    lines.push('');
    lines.push(`**Baseline:** ${baselineMeta.violationCount} violations · **Candidate:** ${candidateMeta.violationCount} violations · **New:** 0`);
    return lines.join('\n');
  }

  lines.push(`## ♿ Accessibility Delta — ${count} new violation${count === 1 ? '' : 's'}`);
  lines.push('');
  lines.push('| Impact | Rule | Element | Help |');
  lines.push('|---|---|---|---|');

  const mdEscape = s => s.replace(/`/g, '\\`').replace(/\|/g, '\\|');
  for (const v of newViolations) {
    const emoji   = IMPACT_EMOJI[v.impact] ?? '⚪';
    const element = mdEscape(v.target.join(', '));
    lines.push(`| ${emoji} ${v.impact} | \`${v.id}\` | \`${element}\` | [docs](${v.helpUrl}) |`);
  }

  lines.push('');
  lines.push(`**Baseline:** ${baselineMeta.violationCount} violations · **Candidate:** ${candidateMeta.violationCount} violations · **New:** ${count}`);
  return lines.join('\n');
}

/**
 * Structured JSON output for pipeline/CI consumption.
 * @param {Array}  newViolations
 * @param {{ url: string, violationCount: number }} baselineMeta
 * @param {{ url: string, violationCount: number }} candidateMeta
 * @param {number} exitCode
 * @returns {string} pretty-printed JSON
 */
export function renderJson(newViolations, baselineMeta, candidateMeta, exitCode) {
  return JSON.stringify({
    newViolations,
    baselineCount:  baselineMeta.violationCount,
    candidateCount: candidateMeta.violationCount,
    newCount:       newViolations.length,
    exitCode,
  }, null, 2);
}

// ── Color helpers (Warm Studio palette) ─────────────────────────────────────

function useColor() {
  if (process.env.NO_COLOR) return false;              // any non-empty value
  if (process.env.FORCE_COLOR === '1') return true;    // must come BEFORE isTTY check
  if (!process.stdout.isTTY) return false;
  if (process.env.CI) return false;
  return true;
}

function paint(code, text) {
  return useColor() ? `\x1b[${code}m${text}\x1b[0m` : text;
}

const C = {
  brand:    t => paint('1;38;5;208', t),
  url:      t => paint('38;5;201',   t),
  critical: t => paint('38;5;210',   t),
  serious:  t => paint('38;5;215',   t),
  moderate: t => paint('38;5;221',   t),
  minor:    t => paint('38;5;246',   t),
  rule:     t => paint('38;5;177',   t),
  element:  t => paint('38;5;159',   t),
  clean:    t => paint('38;5;120',   t),
  dim:      t => paint('38;5;241',   t),
};

function impactC(impact) {
  return C[impact] ?? (t => t);
}

// ── renderTableMulti ─────────────────────────────────────────────────────────

export function renderTableMulti(multiResult, outputStyle = 'per-page') {
  const { pages, totalNew, byCritical, bySerious, cleanPages, failPages } = multiResult;
  const trunc = (s, w) => s.length > w ? s.slice(0, w - 1) + '…' : s;
  const col   = (s, w) => trunc(String(s ?? ''), w).padEnd(w);
  const W     = { impact: 10, rule: 30, element: 40 };
  const lines = [''];

  lines.push(`${C.brand('a11y-delta')}  --  ${pages.length} page${pages.length === 1 ? '' : 's'}  --  ${failPages} with new violations`);
  lines.push('');

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (outputStyle === 'failures-only' && !p.error && p.newViolations.length === 0) continue;
    lines.push(`${C.dim('+--')} page ${i + 1} / ${pages.length}  ${C.url(p.url)}`);
    if (p.error) {
      lines.push(`${C.dim('|')}   ${C.critical('Error:')} ${p.error}`);
    } else if (p.newViolations.length === 0) {
      lines.push(`${C.dim('|')}   ${C.clean('✓ No new violations')}`);
    } else {
      lines.push(`${C.dim('|')}   ${p.newViolations.length} new violation${p.newViolations.length === 1 ? '' : 's'}`);
      lines.push(C.dim('|'));
      lines.push(`${C.dim('|')}   ${col('impact', W.impact)}  ${col('rule', W.rule)}  ${col('element', W.element)}`);
      lines.push(`${C.dim('|')}   ${'─'.repeat(W.impact)}  ${'─'.repeat(W.rule)}  ${'─'.repeat(W.element)}`);
      for (const v of p.newViolations) {
        lines.push(`${C.dim('|')}   ${impactC(v.impact)(col(v.impact, W.impact))}  ${C.rule(col(v.id, W.rule))}  ${C.element(col(v.target.join(', '), W.element))}`);
      }
    }
    lines.push('');
  }

  if (outputStyle === 'failures-only' && cleanPages > 0) {
    lines.push(`(${cleanPages} clean page${cleanPages === 1 ? '' : 's'} hidden — use --output-style per-page to show all)`);
    lines.push('');
  }

  const parts = [`new: ${totalNew}  (critical: ${byCritical}, serious: ${bySerious})`];
  if (cleanPages > 0) parts.push(`${cleanPages} page${cleanPages === 1 ? '' : 's'} clean`);
  lines.push(parts.join('  |  '));
  lines.push('');
  return lines.join('\n');
}

// ── renderGithubCommentMulti ─────────────────────────────────────────────────

export function renderGithubCommentMulti(multiResult) {
  const { pages, totalNew, failPages, cleanPages, errorPages } = multiResult;
  const lines = [];

  if (totalNew === 0 && errorPages === 0) {
    lines.push('## ♿ Accessibility Delta — No new violations ✅');
  } else if (totalNew === 0 && errorPages > 0) {
    lines.push(`## ♿ Accessibility Delta — ⚠️ ${errorPages} page${errorPages === 1 ? '' : 's'} could not be audited`);
  } else {
    lines.push(`## ♿ Accessibility Delta — ${totalNew} new violation${totalNew === 1 ? '' : 's'} across ${failPages} page${failPages === 1 ? '' : 's'}`);
  }
  lines.push('');

  const IMPACT_ORDER_R = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  lines.push('| Page | New | Worst |');
  lines.push('|---|---|---|');
  for (const p of pages) {
    let pathname;
    try { pathname = new URL(p.url).pathname; } catch { pathname = p.url; }
    const worst = p.error ? 'error'
      : p.newViolations.length === 0 ? '—'
      : p.newViolations.reduce(
          (best, v) => (IMPACT_ORDER_R[v.impact] ?? 99) < (IMPACT_ORDER_R[best] ?? 99) ? v.impact : best,
          p.newViolations[0].impact
        );
    lines.push(`| ${pathname} | ${p.error ? '—' : p.newViolations.length} | ${worst} |`);
  }
  lines.push('');

  const mdEscape = s => s.replace(/`/g, '\\`').replace(/\|/g, '\\|');
  for (const p of pages) {
    let pathname;
    try { pathname = new URL(p.url).pathname; } catch { pathname = p.url; }
    if (p.error) {
      lines.push(`<details>\n<summary>⚠️ ${pathname} — error</summary>\n\n${p.error}\n\n</details>\n`);
    } else if (p.newViolations.length > 0) {
      lines.push(`<details>`);
      lines.push(`<summary>📄 ${pathname} — ${p.newViolations.length} new violation${p.newViolations.length === 1 ? '' : 's'}</summary>`);
      lines.push('');
      lines.push('| Impact | Rule | Element | Help |');
      lines.push('|---|---|---|---|');
      for (const v of p.newViolations) {
        lines.push(`| ${IMPACT_EMOJI[v.impact] ?? '⚪'} ${v.impact} | \`${v.id}\` | \`${mdEscape(v.target.join(', '))}\` | [docs](${v.helpUrl}) |`);
      }
      lines.push('');
      lines.push('</details>');
      lines.push('');
    } else {
      lines.push(`<details>\n<summary>✅ ${pathname} — clean</summary>\nNo new violations on this page.\n</details>\n`);
    }
  }

  lines.push(`**${pages.length} page${pages.length === 1 ? '' : 's'} audited · ${failPages} with new violations · ${cleanPages} clean**`);
  return lines.join('\n');
}

// ── renderJsonMulti ──────────────────────────────────────────────────────────

export function renderJsonMulti(multiResult) {
  const { pages, totalNew, byCritical, bySerious, byModerate, byMinor,
          cleanPages, failPages, errorPages, exitCode } = multiResult;
  return JSON.stringify({
    pages: pages.map(p => ({
      url:            p.url,
      baselineUrl:    p.baselineUrl,
      newViolations:  p.newViolations,
      baselineCount:  p.baselineCount,
      candidateCount: p.candidateCount,
      error:          p.error,
    })),
    summary: {
      totalPages: pages.length,
      failPages, cleanPages, errorPages,
      totalNew, byCritical, bySerious, byModerate, byMinor,
    },
    exitCode,
  }, null, 2);
}

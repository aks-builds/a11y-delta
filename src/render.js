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
    const col = (s, w) => String(s ?? '').padEnd(w);
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

  for (const v of newViolations) {
    const emoji   = IMPACT_EMOJI[v.impact] ?? '⚪';
    const element = v.target.join(', ');
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

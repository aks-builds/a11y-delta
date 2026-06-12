// src/diff.js

/**
 * Expand a ViolationSet into one entry per affected node.
 * axe groups multiple affected elements under one violation; treating each
 * node separately means partial fixes (removing some elements but not others)
 * are reflected correctly in the diff.
 * @param {{ violations: Array }} violationSet
 * @returns {Array<{ id, impact, description, helpUrl, target, html, failureSummary }>}
 */
export function expand(violationSet) {
  return violationSet.violations.flatMap(v =>
    v.nodes.map(n => ({
      id:             v.id,
      impact:         v.impact,
      description:    v.description,
      helpUrl:        v.helpUrl,
      target:         n.target,
      html:           n.html,
      failureSummary: n.failureSummary ?? '',
    }))
  );
}

/**
 * Stable identity key for a violation entry.
 * Format: "ruleId::selector1|selector2"
 * target is an array of CSS selector strings (may be a frame path in nested iframes).
 * The '|' separator is stable and human-readable.
 * @param {{ id: string, target: string[] }} entry
 * @returns {string}
 */
export function violationKey(entry) {
  return `${entry.id}::${entry.target.join('|')}`;
}

/**
 * Return entries present in candidate but NOT in baseline.
 * @param {{ violations: Array }} baseline
 * @param {{ violations: Array }} candidate
 * @returns {Array} new violation entries
 */
export function diff(baseline, candidate) {
  const baselineKeys = new Set(expand(baseline).map(violationKey));
  return expand(candidate).filter(e => !baselineKeys.has(violationKey(e)));
}

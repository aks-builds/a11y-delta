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
 * Format: "ruleId::N:selector1|selector2"
 * where N is the number of selectors in target — prevents collisions between
 * an empty target ([]) and a single-empty-string target (['']) which both
 * join to the same string without the length prefix.
 * @param {{ id: string, target: string[] }} entry
 * @returns {string}
 */
export function violationKey(entry) {
  return `${entry.id}::${entry.target.length}:${entry.target.join('|')}`;
}

/**
 * Return entries present in candidate but NOT in baseline.
 * Deduplicates candidate entries so that the same node appearing more than
 * once in the candidate snapshot is counted only once in the output.
 * @param {{ violations: Array }} baseline
 * @param {{ violations: Array }} candidate
 * @returns {Array} new violation entries
 */
export function diff(baseline, candidate) {
  const baselineKeys = new Set(expand(baseline).map(violationKey));
  const seen = new Set();
  return expand(candidate).filter(e => {
    const k = violationKey(e);
    if (baselineKeys.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

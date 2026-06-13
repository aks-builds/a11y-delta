// src/multi.js
import { join } from 'node:path';
import { auditUrl } from './audit.js';
import { diff } from './diff.js';
import { readSnapshot, writeSnapshotDir, pageFileName } from './snapshot.js';
import { pool } from './pool.js';
import { resolvePages } from './pages.js';

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

function failOnMinIndex(failOn) {
  const thresholds = (failOn ?? 'critical,serious')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return Math.max(...thresholds.map(t => {
    const i = IMPACT_ORDER.indexOf(t);
    return i === -1 ? -Infinity : i;
  }));
}

function aggregate(pageResults, minIdx) {
  const totalNew   = pageResults.reduce((s, p) => s + p.newViolations.length, 0);
  const byCritical = pageResults.reduce((s, p) => s + p.newViolations.filter(v => v.impact === 'critical').length, 0);
  const bySerious  = pageResults.reduce((s, p) => s + p.newViolations.filter(v => v.impact === 'serious').length, 0);
  const byModerate = pageResults.reduce((s, p) => s + p.newViolations.filter(v => v.impact === 'moderate').length, 0);
  const byMinor    = pageResults.reduce((s, p) => s + p.newViolations.filter(v => v.impact === 'minor').length, 0);
  const cleanPages = pageResults.filter(p => !p.error && p.newViolations.length === 0).length;
  const failPages  = pageResults.filter(p => !p.error && p.newViolations.length > 0).length;
  const errorPages = pageResults.filter(p =>  p.error).length;

  let exitCode;
  if (pageResults.every(p => p.error)) {
    exitCode = 2;
  } else {
    const hasFailing = pageResults.some(p =>
      p.newViolations.some(v => {
        const idx = IMPACT_ORDER.indexOf(v.impact);
        return idx !== -1 && idx <= minIdx;
      })
    );
    exitCode = hasFailing ? 1 : 0;
  }

  return { pages: pageResults, totalNew, byCritical, bySerious, byModerate, byMinor,
           cleanPages, failPages, errorPages, exitCode };
}

export async function runMulti(mergedConfig, { auditFn = auditUrl } = {}) {
  const pages = await resolvePages(mergedConfig);
  if (pages.length === 0) throw new Error('No pages resolved from the provided sources');

  const concurrency  = mergedConfig.concurrency ?? 3;
  const minIdx       = failOnMinIndex(mergedConfig['fail-on']);
  const baselineDir  = mergedConfig.baseline && !mergedConfig.baseline.startsWith('http')
    ? mergedConfig.baseline
    : null;
  const auditOpts = {
    timeout:  mergedConfig.timeout  ?? 30000,
    viewport: mergedConfig.viewport ?? '1280x800',
    waitFor:  mergedConfig['wait-for'],
    headers:  Object.fromEntries(
      (mergedConfig.header ?? []).map(h => {
        const i = h.indexOf(':');
        return i > 0 ? [h.slice(0, i).trim(), h.slice(i + 1).trim()] : null;
      }).filter(Boolean)
    ),
  };

  const pageResults = await pool(concurrency, pages.map(page => async () => {
    let baselineVS, candidateVS;
    try {
      if (baselineDir) {
        const file = join(baselineDir, pageFileName(page.candidateUrl));
        baselineVS = await readSnapshot(file)
          .catch(() => ({ url: page.baselineUrl, timestamp: '', violations: [] }));
      } else {
        baselineVS = await auditFn(page.baselineUrl, auditOpts);
      }
      candidateVS = await auditFn(page.candidateUrl, auditOpts);
    } catch (err) {
      process.stderr.write(`Warning: failed to audit ${page.candidateUrl}: ${err.message}\n`);
      return {
        url: page.candidateUrl, baselineUrl: page.baselineUrl,
        newViolations: [], baselineCount: 0, candidateCount: 0,
        error: err.message, _vs: null,
      };
    }

    return {
      url:            page.candidateUrl,
      baselineUrl:    page.baselineUrl,
      newViolations:  diff(baselineVS, candidateVS),
      baselineCount:  baselineVS.violations.flatMap(v => v.nodes).length,
      candidateCount: candidateVS.violations.flatMap(v => v.nodes).length,
      error:          null,
      _vs:            candidateVS,
    };
  }));

  if (mergedConfig['save-dir']) {
    const entries = pageResults
      .filter(p => !p.error && p._vs)
      .map(p => ({ url: p.url, violationSet: p._vs }));
    if (entries.length > 0) await writeSnapshotDir(mergedConfig['save-dir'], entries);
  }

  const cleanResults = pageResults.map(({ _vs: _, ...rest }) => rest);
  return aggregate(cleanResults, minIdx);
}

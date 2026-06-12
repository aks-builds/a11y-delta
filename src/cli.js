#!/usr/bin/env node
// src/cli.js
import { parseArgs }  from 'node:util';
import { resolve }    from 'node:path';
import { readSnapshot, writeSnapshot } from './snapshot.js';
import { diff }       from './diff.js';
import { renderTable, renderGithubComment, renderJson } from './render.js';

let argv;
try {
  ({ values: argv } = parseArgs({
    options: {
      baseline:   { type: 'string',  short: 'b' },
      candidate:  { type: 'string',  short: 'c' },
      'fail-on':  { type: 'string',  default: 'critical,serious' },
      format:     { type: 'string',  short: 'f', default: 'table' },
      save:       { type: 'string' },
      timeout:    { type: 'string',  default: '30000' },
      viewport:   { type: 'string',  default: '1280x800' },
      'wait-for': { type: 'string' },
      header:     { type: 'string' },
      help:       { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
    strict: false,
  }));
} catch (err) {
  process.stderr.write(`Error: ${err.message}\nRun with --help for usage.\n`);
  process.exit(2);
}

if (argv.help) {
  process.stdout.write(`
a11y-delta — catch only new accessibility violations in CI

Usage:
  a11y-delta --baseline <url|file> --candidate <url|file> [options]

Required:
  --baseline,  -b  URL or saved snapshot JSON for the base state
  --candidate, -c  URL or saved snapshot JSON for the new state

Options:
  --fail-on <impacts>   Comma-separated impact levels that exit 1 (default: critical,serious)
  --save    <file>      Save candidate audit as JSON for future baseline use
  --format, -f          Output: table (default) | github-comment | json
  --timeout <ms>        Playwright navigation timeout (default: 30000)
  --viewport <WxH>      Browser viewport (default: 1280x800)
  --wait-for <selector> CSS selector to wait for before auditing
  --header  <name:val>  HTTP header for Playwright (repeatable)
  --help,   -h          Show help

Prerequisites (URL mode only):
  npx playwright install chromium
`);
  process.exit(0);
}

if (!argv.baseline) {
  process.stderr.write('Error: --baseline <url|file> is required\n');
  process.exit(2);
}
if (!argv.candidate) {
  process.stderr.write('Error: --candidate <url|file> is required\n');
  process.exit(2);
}

// Severity order: index 0 = most severe. A violation triggers failure when its
// impact level is >= (i.e. index <=) the least-severe threshold in --fail-on.
const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

const failOnThresholds = (argv['fail-on'] ?? 'critical,serious')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// Lowest severity index among the listed thresholds = broadest trigger.
const failOnMinIndex = Math.min(
  ...failOnThresholds.map(t => {
    const i = IMPACT_ORDER.indexOf(t);
    return i === -1 ? Infinity : i;
  })
);

function shouldViolationFail(impact) {
  const idx = IMPACT_ORDER.indexOf(impact);
  return idx !== -1 && idx <= failOnMinIndex;
}

function isUrl(s) {
  return s.startsWith('http://') || s.startsWith('https://');
}

async function resolveInput(input) {
  if (isUrl(input)) {
    const { auditUrl } = await import('./audit.js');
    const headers = {};
    if (argv.header) {
      for (const h of [argv.header].flat()) {
        const i = h.indexOf(':');
        if (i > 0) headers[h.slice(0, i).trim()] = h.slice(i + 1).trim();
      }
    }
    return auditUrl(input, {
      timeout:  parseInt(argv.timeout, 10),
      viewport: argv.viewport,
      waitFor:  argv['wait-for'],
      headers,
    });
  }
  // File mode — --header silently ignored (no browser launched)
  return readSnapshot(resolve(input));
}

try {
  const [baselineVS, candidateVS] = await Promise.all([
    resolveInput(argv.baseline),
    resolveInput(argv.candidate),
  ]);

  if (argv.save) {
    await writeSnapshot(candidateVS, resolve(argv.save));
    process.stderr.write(`Candidate snapshot saved to ${argv.save}\n`);
  }

  const newViolations = diff(baselineVS, candidateVS);

  const baselineMeta  = {
    url:            baselineVS.url,
    violationCount: baselineVS.violations.flatMap(v => v.nodes).length,
  };
  const candidateMeta = {
    url:            candidateVS.url,
    violationCount: candidateVS.violations.flatMap(v => v.nodes).length,
  };

  const shouldFail = newViolations.some(v => shouldViolationFail(v.impact));
  const exitCode   = shouldFail ? 1 : 0;

  let output;
  if (argv.format === 'json') {
    output = renderJson(newViolations, baselineMeta, candidateMeta, exitCode);
  } else if (argv.format === 'github-comment') {
    output = renderGithubComment(newViolations, baselineMeta, candidateMeta);
  } else {
    output = renderTable(newViolations, baselineMeta, candidateMeta);
  }

  process.stdout.write(output + '\n');
  process.exit(exitCode);
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(2);
}

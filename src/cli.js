#!/usr/bin/env node
// src/cli.js
import { parseArgs }  from 'node:util';
import { resolve, join } from 'node:path';
import { readSnapshot, writeSnapshot } from './snapshot.js';
import { diff }       from './diff.js';
import { renderTable, renderGithubComment, renderJson,
         renderTableMulti, renderGithubCommentMulti, renderJsonMulti } from './render.js';
import { loadConfig, mergeConfig } from './config.js';

let argv;
try {
  ({ values: argv } = parseArgs({
    options: {
      baseline:         { type: 'string',  short: 'b' },
      candidate:        { type: 'string',  short: 'c' },
      'fail-on':        { type: 'string' },
      format:           { type: 'string',  short: 'f' },
      save:             { type: 'string' },
      timeout:          { type: 'string' },
      viewport:         { type: 'string' },
      'wait-for':       { type: 'string' },
      header:           { type: 'string',  multiple: true },
      help:             { type: 'boolean', short: 'h', default: false },
      sitemap:          { type: 'string' },
      urls:             { type: 'string' },
      base:             { type: 'string' },
      'candidate-base': { type: 'string' },
      concurrency:      { type: 'string' },
      config:           { type: 'string' },
      'save-dir':       { type: 'string' },
      'output-style':   { type: 'string' },
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

Usage (single URL):
  a11y-delta --baseline <url|file> --candidate <url|file> [options]

Usage (multi-page):
  a11y-delta --sitemap <url> --candidate-base <url> [options]
  a11y-delta --urls <file|list> --base <url> --candidate-base <url> [options]
  a11y-delta --candidate-base <url> [--config <file>] [options]

Single-URL options:
  --baseline,  -b     URL or saved snapshot JSON for the base state
  --candidate, -c     URL or saved snapshot JSON for the new state

Multi-page options:
  --sitemap     <url>        Fetch sitemap.xml and audit all discovered pages
  --urls        <file|list>  File (one URL per line) or comma-separated list
  --base        <url>        Base URL for resolving relative page paths
  --candidate-base <url>     Candidate base URL (required for multi-page)
  --concurrency <n>          Max parallel browsers (default: 3)
  --config      <file>       Config file path (default: .a11y-delta.yml in CWD)
  --save-dir    <dir>        Save per-page candidate snapshots to directory
  --output-style <style>     per-page (default) | failures-only

Shared options:
  --fail-on <impacts>   Comma-separated impact levels that exit 1 (default: critical,serious)
  --save    <file>      Save candidate audit as JSON for future baseline use
  --format, -f          Output: table (default) | github-comment | json
  --timeout <ms>        Playwright navigation timeout (default: 30000)
  --viewport <WxH>      Browser viewport (default: 1280x800)
  --wait-for <selector> CSS selector to wait for before auditing
  --header  <name:val>  HTTP header for Playwright (repeatable)
  --help,   -h          Show help
`);
  process.exit(0);
}

// Load config file and merge with CLI args
const configPath = argv.config ? resolve(argv.config) : join(process.cwd(), '.a11y-delta.yml');
let merged;
try {
  const fileConfig = await loadConfig(configPath, { required: !!argv.config });
  merged = mergeConfig(fileConfig, argv);
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(2);
}

// ── Multi-page mode ──────────────────────────────────────────────────────────

const hasPageSource = !!(merged.sitemap || merged.urls || merged.pages.length > 0);
const isMulti = hasPageSource && !!merged['candidate-base'];

// If candidate-base is set but no page source, give a useful error
if (merged['candidate-base'] && !hasPageSource) {
  process.stderr.write('Error: --candidate-base requires a page source (--sitemap, --urls, or pages in config)\n');
  process.exit(2);
}

if (isMulti) {
  try {
    const { runMulti } = await import('./multi.js');
    const multiResult = await runMulti(merged);
    let output;
    if (merged.format === 'json') {
      output = renderJsonMulti(multiResult);
    } else if (merged.format === 'github-comment') {
      output = renderGithubCommentMulti(multiResult);
    } else {
      output = renderTableMulti(multiResult, merged['output-style']);
    }
    process.stdout.write(output + '\n');
    process.exit(multiResult.exitCode);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(2);
  }
}

// ── Single-URL mode (v0.1.0 behaviour — unchanged) ───────────────────────────

if (!merged.baseline) {
  process.stderr.write('Error: --baseline <url|file> is required\n');
  process.exit(2);
}
if (!merged.candidate) {
  process.stderr.write('Error: --candidate <url|file> is required\n');
  process.exit(2);
}

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

const failOnThresholds = (merged['fail-on'] ?? 'critical,serious')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const VALID_IMPACTS = ['critical', 'serious', 'moderate', 'minor'];
const unknownImpacts = failOnThresholds.filter(t => !VALID_IMPACTS.includes(t));
if (unknownImpacts.length > 0) {
  process.stderr.write(`Error: Unknown fail-on value(s): ${unknownImpacts.join(', ')}. Valid values: ${VALID_IMPACTS.join(', ')}\n`);
  process.exit(2);
}

const failOnMinIndex = Math.max(
  ...failOnThresholds.map(t => {
    const i = IMPACT_ORDER.indexOf(t);
    return i === -1 ? -Infinity : i;
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
    for (const h of merged.header) {
      const i = h.indexOf(':');
      if (i > 0) headers[h.slice(0, i).trim()] = h.slice(i + 1).trim();
    }
    return auditUrl(input, {
      timeout:  merged.timeout,
      viewport: merged.viewport,
      waitFor:  merged['wait-for'],
      headers,
    });
  }
  return readSnapshot(resolve(input));
}

try {
  const [baselineVS, candidateVS] = await Promise.all([
    resolveInput(merged.baseline),
    resolveInput(merged.candidate),
  ]);

  if (merged.save) {
    await writeSnapshot(candidateVS, resolve(merged.save));
    process.stderr.write(`Candidate snapshot saved to ${merged.save}\n`);
  }

  const newViolations = diff(baselineVS, candidateVS);

  const baselineMeta  = { url: baselineVS.url,  violationCount: baselineVS.violations.flatMap(v => v.nodes).length };
  const candidateMeta = { url: candidateVS.url, violationCount: candidateVS.violations.flatMap(v => v.nodes).length };

  const shouldFail = newViolations.some(v => shouldViolationFail(v.impact));
  const exitCode   = shouldFail ? 1 : 0;

  let output;
  if (merged.format === 'json') {
    output = renderJson(newViolations, baselineMeta, candidateMeta, exitCode);
  } else if (merged.format === 'github-comment') {
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

// tests/integration.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI      = join(__dirname, '..', 'src', 'cli.js');
const BASELINE = join(__dirname, 'fixtures', 'baseline.json');
const SAME     = join(__dirname, 'fixtures', 'candidate-same.json');
const NEW_V    = join(__dirname, 'fixtures', 'candidate-new.json');

function run(args, expectFail = false) {
  try {
    const stdout = execSync(`node "${CLI}" ${args}`, { stdio: 'pipe' }).toString();
    return { stdout, exitCode: 0 };
  } catch (e) {
    if (!expectFail) throw e;
    return {
      stdout:   (e.stdout  ?? Buffer.alloc(0)).toString(),
      stderr:   (e.stderr  ?? Buffer.alloc(0)).toString(),
      exitCode: e.status ?? 1,
    };
  }
}

// ── Happy paths ──────────────────────────────────────────────────────────

test('CLI exits 0 when candidate has same violations as baseline', () => {
  const { exitCode } = run(`--baseline "${BASELINE}" --candidate "${SAME}"`);
  assert.equal(exitCode, 0);
});

test('CLI shows no-new message on exit 0', () => {
  const { stdout } = run(`--baseline "${BASELINE}" --candidate "${SAME}"`);
  assert.ok(stdout.toLowerCase().includes('no new') || stdout.includes('0 new'));
});

test('CLI exits 1 when candidate introduces a new violation', () => {
  const { exitCode } = run(`--baseline "${BASELINE}" --candidate "${NEW_V}"`, true);
  assert.equal(exitCode, 1);
});

test('CLI stdout names the new violation rule', () => {
  const { stdout } = run(`--baseline "${BASELINE}" --candidate "${NEW_V}"`, true);
  assert.ok(stdout.includes('image-alt'));
});

// ── --format json ────────────────────────────────────────────────────────

test('CLI --format json produces valid JSON on exit 0', () => {
  const { stdout } = run(`--baseline "${BASELINE}" --candidate "${SAME}" --format json`);
  const p = JSON.parse(stdout);
  assert.ok(Array.isArray(p.newViolations));
  assert.equal(p.exitCode, 0);
});

test('CLI --format json has exitCode 1 and 1 new violation when new violations exist', () => {
  const { stdout } = run(`--baseline "${BASELINE}" --candidate "${NEW_V}" --format json`, true);
  const p = JSON.parse(stdout);
  assert.equal(p.exitCode, 1);
  assert.equal(p.newViolations.length, 1);
  assert.equal(p.newViolations[0].id, 'image-alt');
});

// ── --format github-comment ──────────────────────────────────────────────

test('CLI --format github-comment produces markdown heading', () => {
  const { stdout } = run(`--baseline "${BASELINE}" --candidate "${NEW_V}" --format github-comment`, true);
  assert.ok(stdout.includes('## ♿'));
  assert.ok(stdout.includes('| Impact |'));
});

// ── Error paths ──────────────────────────────────────────────────────────

test('CLI exits 2 when --baseline is missing', () => {
  const { exitCode, stderr } = run(`--candidate "${SAME}"`, true);
  assert.equal(exitCode, 2);
  assert.ok(stderr.includes('--baseline'));
});

test('CLI exits 2 when --candidate is missing', () => {
  const { exitCode, stderr } = run(`--baseline "${BASELINE}"`, true);
  assert.equal(exitCode, 2);
  assert.ok(stderr.includes('--candidate'));
});

test('CLI exits 2 for nonexistent snapshot file', () => {
  const { exitCode } = run(`--baseline "/nonexistent/file.json" --candidate "${SAME}"`, true);
  assert.equal(exitCode, 2);
});

test('CLI --fail-on minor exits 1 for any new violation', () => {
  // candidate-new.json has a new critical violation — critical >= minor
  const { exitCode } = run(`--baseline "${BASELINE}" --candidate "${NEW_V}" --fail-on minor`, true);
  assert.equal(exitCode, 1);
});

test('CLI --fail-on critical exits 1 for new critical violation', () => {
  // image-alt is critical so still fails
  const { exitCode } = run(`--baseline "${BASELINE}" --candidate "${NEW_V}" --fail-on critical`, true);
  assert.equal(exitCode, 1);
});

test('CLI default --fail-on exits 1 for new serious violation (not just critical)', async () => {
  // Build a candidate snapshot in-memory by writing a temp file with a serious violation
  const { writeFile, unlink } = await import('node:fs/promises');
  const { join: j } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const emptyBaseline = j(tmpdir(), 'a11y-empty-baseline.json');
  const seriousCandidate = j(tmpdir(), 'a11y-serious-candidate.json');
  await writeFile(emptyBaseline, JSON.stringify({ url: 'x', timestamp: 'y', violations: [] }));
  await writeFile(seriousCandidate, JSON.stringify({
    url: 'x', timestamp: 'y',
    violations: [{
      id: 'color-contrast', impact: 'serious',
      description: 'd', helpUrl: 'h',
      nodes: [{ target: ['button'], html: '<button>', failureSummary: 'f' }]
    }]
  }));
  try {
    // Default --fail-on is critical,serious — a new serious violation must exit 1
    const { exitCode } = run(`--baseline "${emptyBaseline}" --candidate "${seriousCandidate}"`, true);
    assert.equal(exitCode, 1, 'default --fail-on critical,serious must exit 1 for a new serious violation');
  } finally {
    await unlink(emptyBaseline).catch(() => {});
    await unlink(seriousCandidate).catch(() => {});
  }
});

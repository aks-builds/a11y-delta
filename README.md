<div align="center">

# ♿ a11y-delta

**Gate PRs on new accessibility violations — not on ones you already know about.**

`a11y-delta` runs axe-core audits via Playwright on a baseline and a candidate, diffs the results,
and reports **only the violations your PR introduced**. Pre-existing debt never blocks the gate.

[![CI](https://github.com/aks-builds/a11y-delta/actions/workflows/ci.yml/badge.svg)](https://github.com/aks-builds/a11y-delta/actions/workflows/ci.yml)
[![CodeQL](https://github.com/aks-builds/a11y-delta/actions/workflows/codeql.yml/badge.svg)](https://github.com/aks-builds/a11y-delta/actions/workflows/codeql.yml)
[![npm version](https://img.shields.io/npm/v/a11y-delta.svg)](https://www.npmjs.com/package/a11y-delta)
[![License MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

---

## The problem it solves

```javascript
// Every team that tries to gate accessibility in CI hits the same wall:
// @axe-core/cli exits 1 if ANY violation exists.
// If you already have 47 old issues your gate is always red.
// Teams disable it. Nothing improves.

// a11y-delta only flags violations your PR introduced:
//   baseline: 47 violations  →  candidate: 48 violations  →  exit 1 (1 new)
//   baseline: 47 violations  →  candidate: 47 violations  →  exit 0 (none new)
```

---

## Prerequisites

Playwright requires a Chromium binary. Install once per machine or CI environment:

```bash
npx playwright install chromium
# On Linux CI runners also install system deps:
npx playwright install --with-deps chromium
```

---

## Install

```bash
# Run directly with npx (no global install needed):
npx a11y-delta --baseline https://staging.example.com --candidate https://preview.example.com

# Or install globally:
npm install -g a11y-delta
```

---

## Usage

### Compare two live URLs

```bash
a11y-delta \
  --baseline  https://staging.example.com \
  --candidate https://preview.example.com
```

### Save a snapshot, then compare against it later

```bash
# Save the current production state as a baseline snapshot
a11y-delta \
  --baseline  https://example.com \
  --candidate https://example.com \
  --save baseline.json

# On each PR, compare the preview against the saved baseline
a11y-delta \
  --baseline  baseline.json \
  --candidate https://preview-${{ github.event.pull_request.number }}.example.com
```

### GitHub Actions integration

```yaml
- name: Install Playwright browser
  run: npx playwright install --with-deps chromium

- name: Accessibility delta check
  id: a11y
  run: |
    npx a11y-delta \
      --baseline  https://staging.example.com \
      --candidate https://preview-${{ github.event.pull_request.number }}.example.com \
      --format github-comment > a11y-comment.md || true
    cat a11y-comment.md >> $GITHUB_STEP_SUMMARY

- name: Post result as PR comment
  if: github.event_name == 'pull_request'
  run: gh pr comment ${{ github.event.pull_request.number }} --body-file a11y-comment.md
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Fail if new violations found
  run: |
    npx a11y-delta \
      --baseline  https://staging.example.com \
      --candidate https://preview-${{ github.event.pull_request.number }}.example.com
```

---

## Options

| Flag | Default | Description |
|---|---|---|
| `--baseline, -b` | required | URL or saved snapshot JSON |
| `--candidate, -c` | required | URL or saved snapshot JSON |
| `--fail-on` | `critical,serious` | Comma-separated impact levels that exit 1 |
| `--save` | — | Write candidate audit as JSON for future use as baseline |
| `--format, -f` | `table` | `table` \| `github-comment` \| `json` |
| `--timeout` | `30000` | Playwright navigation timeout (ms) |
| `--viewport` | `1280x800` | Browser viewport |
| `--wait-for` | — | CSS selector to wait for before running the audit |
| `--header` | — | HTTP header for Playwright requests (repeatable) |

### Impact levels (most → least severe)

`critical` → `serious` → `moderate` → `minor`

`--fail-on critical,serious` exits 1 for critical and serious new violations.  
`--fail-on minor` exits 1 for any new violation at any impact level.

---

## How violation identity works

Two audits can have the same axe rule firing on different elements, or the same element appearing in both. `a11y-delta` identifies each occurrence as `ruleId::N:selector` (where N is the number of selectors in the target chain). A violation is "new" only if that exact rule+element combination wasn't present in the baseline.

Partial fixes are reflected correctly: if you fix 3 of 5 failing elements for a rule, only the 2 remaining unfixed elements continue to appear as existing violations.

---

## License

MIT © [aks-builds](https://github.com/aks-builds)

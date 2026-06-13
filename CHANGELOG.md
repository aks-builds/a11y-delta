# Changelog

## [Unreleased]

### Added
- Multi-page coverage: audit N pages in one command via `--sitemap`, `--urls`, or `.a11y-delta.yml`
- `--base` and `--candidate-base` flags for multi-page base URLs
- `--concurrency <n>` to control parallel browser slots (default: 3)
- `--config <file>` to load `.a11y-delta.yml` options file
- `--save-dir <dir>` to persist per-page candidate snapshots for future baseline use
- `--output-style per-page|failures-only` to filter terminal output
- Warm Studio ANSI colour palette in multi-page terminal output
- Multi-page GitHub comment format: summary table + collapsible `<details>` per page
- Snapshot directory format (`_manifest.json` + one file per page)
- `js-yaml` dependency for `.a11y-delta.yml` config parsing

## [0.1.0] - 2026-06-12

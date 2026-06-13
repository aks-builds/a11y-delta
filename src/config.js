// src/config.js
import { readFile } from 'node:fs/promises';
import { load as parseYaml } from 'js-yaml';

export async function loadConfig(configPath, { required = false } = {}) {
  let raw;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      if (required) throw new Error(`Config file not found: ${configPath}`);
      return {};
    }
    throw err;
  }
  let parsed;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new Error(`Invalid .a11y-delta.yml: ${err.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed;
}

export function mergeConfig(fileConfig, cliArgs) {
  const rawConcurrency = cliArgs.concurrency ?? fileConfig.concurrency;
  const concurrency = rawConcurrency != null ? parseInt(String(rawConcurrency), 10) : 3;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('concurrency must be a positive integer');
  }
  return {
    base:             cliArgs.base              ?? fileConfig.base              ?? null,
    'candidate-base': cliArgs['candidate-base'] ?? fileConfig['candidate-base'] ?? null,
    pages:            fileConfig.pages          ?? [],
    concurrency,
    'fail-on':        cliArgs['fail-on']        ?? fileConfig['fail-on']        ?? 'critical,serious',
    'save-dir':       cliArgs['save-dir']       ?? fileConfig['save-dir']       ?? null,
    'output-style':   cliArgs['output-style']   ?? fileConfig['output-style']   ?? 'per-page',
    sitemap:          cliArgs.sitemap           ?? null,
    urls:             cliArgs.urls              ?? null,
    baseline:         cliArgs.baseline          ?? null,
    candidate:        cliArgs.candidate         ?? null,
    timeout:          parseInt(String(cliArgs.timeout ?? '30000'), 10),
    viewport:         cliArgs.viewport          ?? '1280x800',
    'wait-for':       cliArgs['wait-for']       ?? null,
    header:           [cliArgs.header ?? []].flat().filter(Boolean),
    format:           cliArgs.format            ?? 'table',
    save:             cliArgs.save              ?? null,
  };
}

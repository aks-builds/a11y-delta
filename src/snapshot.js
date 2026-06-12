// src/snapshot.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

export function validateSnapshot(vs) {
  if (!vs || typeof vs !== 'object' || !Array.isArray(vs.violations)) {
    throw new Error('Invalid snapshot: expected { url, timestamp, violations: [] } shape');
  }
}

export async function readSnapshot(filePath) {
  const raw = await readFile(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid snapshot: "${filePath}" is not valid JSON`);
  }
  validateSnapshot(parsed);
  return parsed;
}

export async function writeSnapshot(violationSet, filePath) {
  await mkdir(dirname(resolve(filePath)), { recursive: true });
  await writeFile(filePath, JSON.stringify(violationSet, null, 2), 'utf8');
}

export function makeSnapshot(url, violations) {
  if (typeof url !== 'string') {
    throw new TypeError(`makeSnapshot: url must be a string, got ${url === null ? 'null' : typeof url}`);
  }
  const isAbsolute = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://');
  const resolvedUrl = isAbsolute ? url : resolve(url);
  return {
    url: resolvedUrl,
    timestamp: new Date().toISOString(),
    violations,
  };
}

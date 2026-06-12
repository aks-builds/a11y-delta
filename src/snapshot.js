// src/snapshot.js
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export function validateSnapshot(vs) {
  if (!vs || typeof vs !== 'object' || !Array.isArray(vs.violations)) {
    throw new Error('Invalid snapshot: expected { url, timestamp, violations: [] } shape');
  }
}

export async function readSnapshot(filePath) {
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    throw err; // preserve ENOENT code
  }
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
  await writeFile(filePath, JSON.stringify(violationSet, null, 2), 'utf8');
}

export function makeSnapshot(url, violations) {
  const resolvedUrl = (url.startsWith('http://') || url.startsWith('https://'))
    ? url
    : resolve(url);
  return {
    url: resolvedUrl,
    timestamp: new Date().toISOString(),
    violations,
  };
}

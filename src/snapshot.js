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

export function pageFileName(url) {
  const { pathname } = new URL(url);
  const name = pathname.split('/').filter(Boolean).join('-') || 'index';
  return `${name}.json`;
}

export async function writeSnapshotDir(dirPath, entries) {
  // Check for filename collisions upfront
  const seen = new Map();
  for (const { url } of entries) {
    const file = pageFileName(url);
    if (seen.has(file)) {
      throw new Error(`Snapshot filename collision: both "${seen.get(file)}" and "${url}" map to "${file}". Normalize URLs before saving.`);
    }
    seen.set(file, url);
  }
  await mkdir(dirPath, { recursive: true });
  const pages = [];
  for (const { url, violationSet } of entries) {
    const file = pageFileName(url);
    await writeSnapshot(violationSet, resolve(dirPath, file));
    pages.push({ url, file });
  }
  const manifest = {
    base:      entries.length > 0 ? new URL(entries[0].url).origin : '',
    createdAt: new Date().toISOString(),
    pages,
  };
  await writeFile(resolve(dirPath, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

export async function readSnapshotDir(dirPath) {
  let raw;
  try {
    raw = await readFile(resolve(dirPath, '_manifest.json'), 'utf8');
  } catch (err) {
    throw new Error(`Cannot read snapshot directory "${dirPath}": ${err.message}`);
  }
  const manifest = JSON.parse(raw);
  const pages    = {};
  for (const { url, file } of manifest.pages) {
    pages[url] = await readSnapshot(resolve(dirPath, file));
  }
  return { base: manifest.base, createdAt: manifest.createdAt, pages };
}

export async function readMultiSnapshot(filePath) {
  const raw = await readFile(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid multi snapshot: "${filePath}" is not valid JSON`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.pages !== 'object') {
    throw new Error(`Invalid multi snapshot: "${filePath}" is missing required "pages" object`);
  }
  return parsed;
}

export async function writeMultiSnapshot(filePath, base, violationSetsByUrl) {
  const data = { base, timestamp: new Date().toISOString(), pages: violationSetsByUrl };
  await mkdir(dirname(resolve(filePath)), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

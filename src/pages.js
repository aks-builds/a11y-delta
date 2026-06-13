// src/pages.js
import { readFile } from 'node:fs/promises';
import { fetchSitemap } from './sitemap.js';

function isUrl(s) {
  return s.startsWith('http://') || s.startsWith('https://');
}

function resolveUrl(path, base) {
  if (isUrl(path)) return path;
  if (!base) throw new Error(`Cannot resolve relative path "${path}" without a base URL`);
  const b = base.endsWith('/') ? base : base + '/';
  return new URL(path.startsWith('/') ? path.slice(1) : path, b).href;
}

function toCandidateUrl(baselineUrl, candidateBase) {
  const parsed = new URL(baselineUrl);
  const base   = new URL(candidateBase.endsWith('/') ? candidateBase : candidateBase + '/');
  return base.origin + parsed.pathname + parsed.search + parsed.hash;
}

function looksLikeFilePath(raw) {
  // Absolute OS path (Windows drive letter or Unix root with extension)
  if (/^[A-Za-z]:[/\\]/.test(raw)) return true;
  // Has a file extension in the last segment (e.g. pages.txt, sitemap.csv)
  const last = raw.split(/[/\\]/).pop() ?? '';
  return last.includes('.');
}

async function resolveUrlList(raw) {
  if (raw.includes(',')) {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (!looksLikeFilePath(raw)) {
    // Treat as single inline URL path
    return [raw];
  }
  let content;
  try {
    content = await readFile(raw, 'utf8');
  } catch {
    throw new Error(`URLs file not found: ${raw}`);
  }
  return content.split('\n').map(s => s.trim()).filter(Boolean);
}

export async function resolvePages(config) {
  const base     = config.base ?? null;
  const candBase = config['candidate-base'] ?? null;
  const { sitemap, urls, pages = [] } = config;

  if (sitemap) {
    if (!candBase) throw new Error('--candidate-base is required with --sitemap');
    const sitemapUrls = await fetchSitemap(sitemap);
    return sitemapUrls.map(u => ({ baselineUrl: u, candidateUrl: toCandidateUrl(u, candBase) }));
  }

  if (urls) {
    if (!candBase) throw new Error('--candidate-base is required with --urls');
    const list = await resolveUrlList(urls);
    return list.map(u => ({
      baselineUrl:  resolveUrl(u, base),
      candidateUrl: resolveUrl(u, candBase),
    }));
  }

  if (pages.length > 0) {
    if (!candBase) throw new Error('--candidate-base is required with pages in config');
    return pages.map(u => ({
      baselineUrl:  resolveUrl(u, base),
      candidateUrl: resolveUrl(u, candBase),
    }));
  }

  return [];
}

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
  const pathAndQuery = parsed.pathname + parsed.search + parsed.hash;
  return new URL(pathAndQuery, candidateBase).href;
}

function looksLikeFilePath(raw) {
  if (isUrl(raw)) return false;
  // Windows drive letter: C:\... or C:/...
  if (/^[A-Za-z]:[/\\]/.test(raw)) return true;
  // Known file extensions only (not arbitrary dots in URL path segments)
  const last = raw.split(/[/\\]/).pop() ?? '';
  return /\.(txt|csv|json|xml|text)$/i.test(last);
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
    const hasRelative = list.some(u => !isUrl(u));
    if (hasRelative && !base) throw new Error('--base is required with --urls when paths are relative');
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

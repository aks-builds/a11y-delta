// tests/sitemap.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { parseUrls, fetchSitemap } from '../src/sitemap.js';

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/products/</loc></url>
  <url><loc>https://example.com/checkout/</loc></url>
</urlset>`;

test('parseUrls extracts loc URLs from sitemap XML', () => {
  assert.deepEqual(parseUrls(SITEMAP_XML), [
    'https://example.com/',
    'https://example.com/products/',
    'https://example.com/checkout/',
  ]);
});

test('parseUrls returns empty array for XML with no loc elements', () => {
  assert.deepEqual(parseUrls('<urlset></urlset>'), []);
});

test('fetchSitemap returns URLs from a live HTTP endpoint', async () => {
  const server = createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(SITEMAP_XML);
  });
  await new Promise(r => server.listen(0, r));
  const { port } = server.address();
  try {
    const urls = await fetchSitemap(`http://localhost:${port}/sitemap.xml`);
    assert.deepEqual(urls, [
      'https://example.com/',
      'https://example.com/products/',
      'https://example.com/checkout/',
    ]);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('fetchSitemap throws with informative message on non-200 response', async () => {
  const server = createServer((_, res) => { res.writeHead(404); res.end(); });
  await new Promise(r => server.listen(0, r));
  const { port } = server.address();
  try {
    await assert.rejects(
      () => fetchSitemap(`http://localhost:${port}/sitemap.xml`),
      /Could not fetch sitemap/
    );
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('fetchSitemap throws on connection refused', async () => {
  await assert.rejects(
    () => fetchSitemap('http://localhost:19999/sitemap.xml'),
    /Could not fetch sitemap/
  );
});

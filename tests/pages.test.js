// tests/pages.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { resolvePages } from '../src/pages.js';

test('resolvePages returns [] when no source is given', async () => {
  assert.deepEqual(await resolvePages({ pages: [] }), []);
});

test('resolvePages resolves relative pages from config with base + candidate-base', async () => {
  const pages = await resolvePages({
    pages: ['/', '/products/'],
    base: 'https://staging.example.com',
    'candidate-base': 'https://preview.example.com',
  });
  assert.equal(pages.length, 2);
  assert.equal(pages[0].baselineUrl,  'https://staging.example.com/');
  assert.equal(pages[0].candidateUrl, 'https://preview.example.com/');
  assert.equal(pages[1].baselineUrl,  'https://staging.example.com/products/');
  assert.equal(pages[1].candidateUrl, 'https://preview.example.com/products/');
});

test('resolvePages passes through absolute URLs in config pages', async () => {
  const pages = await resolvePages({
    pages: ['https://other.example.com/special/'],
    base: 'https://staging.example.com',
    'candidate-base': 'https://preview.example.com',
  });
  assert.equal(pages[0].baselineUrl,  'https://other.example.com/special/');
  assert.equal(pages[0].candidateUrl, 'https://other.example.com/special/');
});

test('resolvePages throws when config pages present but no candidate-base', async () => {
  await assert.rejects(
    () => resolvePages({ pages: ['/'], base: 'https://staging.example.com' }),
    /candidate-base/
  );
});

test('resolvePages resolves --urls inline comma list', async () => {
  const pages = await resolvePages({
    urls: '/,/products/',
    base: 'https://staging.example.com',
    'candidate-base': 'https://preview.example.com',
    pages: [],
  });
  assert.equal(pages.length, 2);
  assert.equal(pages[0].candidateUrl, 'https://preview.example.com/');
  assert.equal(pages[1].candidateUrl, 'https://preview.example.com/products/');
});

test('resolvePages resolves --urls file path', async () => {
  const f = join(tmpdir(), 'a11y-pages.txt');
  await writeFile(f, '/\n/checkout/\n');
  try {
    const pages = await resolvePages({
      urls: f,
      base: 'https://staging.example.com',
      'candidate-base': 'https://preview.example.com',
      pages: [],
    });
    assert.equal(pages.length, 2);
    assert.equal(pages[1].baselineUrl, 'https://staging.example.com/checkout/');
  } finally {
    await unlink(f).catch(() => {});
  }
});

test('resolvePages throws on missing --urls file', async () => {
  await assert.rejects(
    () => resolvePages({ urls: '/nonexistent/pages.txt', 'candidate-base': 'https://p.com', pages: [] }),
    /URLs file not found/
  );
});

test('resolvePages resolves --sitemap by swapping origin for candidateBase', async () => {
  const XML = `<urlset><url><loc>https://staging.example.com/</loc></url><url><loc>https://staging.example.com/products/</loc></url></urlset>`;
  const server = createServer((_, res) => { res.writeHead(200); res.end(XML); });
  await new Promise(r => server.listen(0, r));
  const { port } = server.address();
  try {
    const pages = await resolvePages({
      sitemap: `http://localhost:${port}/sitemap.xml`,
      'candidate-base': 'https://preview.example.com',
      pages: [],
    });
    assert.equal(pages.length, 2);
    assert.equal(pages[0].baselineUrl,  'https://staging.example.com/');
    assert.equal(pages[0].candidateUrl, 'https://preview.example.com/');
    assert.equal(pages[1].candidateUrl, 'https://preview.example.com/products/');
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('resolvePages --sitemap throws when --candidate-base is missing', async () => {
  await assert.rejects(
    () => resolvePages({ sitemap: 'http://localhost:19999/s.xml', pages: [] }),
    /candidate-base/
  );
});

test('resolvePages sitemap takes precedence over urls', async () => {
  const XML = `<urlset><url><loc>https://staging.example.com/</loc></url></urlset>`;
  const server = createServer((_, res) => { res.writeHead(200); res.end(XML); });
  await new Promise(r => server.listen(0, r));
  const { port } = server.address();
  try {
    const pages = await resolvePages({
      sitemap: `http://localhost:${port}/s.xml`,
      urls: '/other/',
      'candidate-base': 'https://preview.example.com',
      pages: [],
    });
    // sitemap wins — only 1 page from sitemap, not the extra from urls
    assert.equal(pages.length, 1);
    assert.equal(pages[0].baselineUrl, 'https://staging.example.com/');
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('resolvePages urls takes precedence over config pages', async () => {
  const pages = await resolvePages({
    urls: '/special/',
    base: 'https://staging.example.com',
    'candidate-base': 'https://preview.example.com',
    pages: ['/should-be-ignored/'],
  });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].candidateUrl, 'https://preview.example.com/special/');
});

test('resolvePages resolves --urls single relative URL (no comma)', async () => {
  const pages = await resolvePages({
    urls: '/about/',
    base: 'https://staging.example.com',
    'candidate-base': 'https://preview.example.com',
    pages: [],
  });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].baselineUrl,  'https://staging.example.com/about/');
  assert.equal(pages[0].candidateUrl, 'https://preview.example.com/about/');
});

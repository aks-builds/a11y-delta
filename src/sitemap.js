// src/sitemap.js
import { get as httpGet }  from 'node:http';
import { get as httpsGet } from 'node:https';

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https://') ? httpsGet : httpGet;
    const req = get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

export function parseUrls(xml) {
  const urls = [];
  const re = /<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) urls.push(m[1]);
  return urls;
}

export async function fetchSitemap(url) {
  let xml;
  try {
    xml = await fetchRaw(url);
  } catch (err) {
    throw new Error(`Could not fetch sitemap at ${url}: ${err.message}`);
  }
  return parseUrls(xml);
}

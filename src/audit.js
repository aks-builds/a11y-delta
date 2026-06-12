// src/audit.js
import { createRequire } from 'node:module';
import { readFileSync }  from 'node:fs';

/**
 * Build the audit configuration object (pure function — fully testable without a browser).
 * @param {{ timeout?: number, viewport?: string, headers?: object }} opts
 * @returns {{ browserType, launchOptions, viewport, timeout, extraHTTPHeaders }}
 */
export function buildAuditConfig(opts = {}) {
  const [w, h] = (opts.viewport ?? '1280x800').split('x').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    throw new RangeError(`Invalid viewport "${opts.viewport}": expected WxH format, e.g. "1280x800"`);
  }
  return {
    browserType:      'chromium',
    launchOptions:    { headless: true },
    viewport:         { width: w, height: h },
    timeout:          opts.timeout ?? 30000,
    extraHTTPHeaders: opts.headers ?? {},
  };
}

/**
 * Resolve the path to the axe-core bundle installed as a dependency.
 * Using createRequire allows resolution from ESM context.
 */
function axeCorePath() {
  const require = createRequire(import.meta.url);
  try {
    return require.resolve('axe-core');
  } catch {
    throw new Error('axe-core is not installed. Run: npm install axe-core');
  }
}

/**
 * Audit a URL with Playwright + axe-core and return a ViolationSet.
 * Dynamic import keeps playwright out of the module graph during tests
 * (tests only call buildAuditConfig, never auditUrl).
 *
 * Prerequisites for callers: `npx playwright install chromium`
 *
 * @param {string} url
 * @param {{ timeout?: number, viewport?: string, headers?: object, waitFor?: string }} opts
 * @returns {Promise<{ url: string, timestamp: string, violations: Array }>}
 */
export async function auditUrl(url, opts = {}) {
  const { chromium } = await import('playwright');
  const cfg = buildAuditConfig(opts);

  const browser = await chromium.launch(cfg.launchOptions);
  try {
    const context = await browser.newContext({
      viewport:         cfg.viewport,
      extraHTTPHeaders: cfg.extraHTTPHeaders,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(cfg.timeout);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.timeout });

    if (opts.waitFor) {
      await page.waitForSelector(opts.waitFor, { timeout: cfg.timeout });
    }

    // Inject axe-core from the installed npm package (no CDN dependency)
    const axeSource = readFileSync(axeCorePath(), 'utf8');
    await page.addScriptTag({ content: axeSource });

    const violations = await page.evaluate(() =>
      window.axe.run().then(r => r.violations)
    );

    return {
      url,
      timestamp: new Date().toISOString(),
      violations,
    };
  } finally {
    await browser.close();
  }
}

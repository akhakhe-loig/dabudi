// Renders public/icon.svg into PNG app icons at the sizes iOS/PWA need.
// Uses the pre-installed Chromium via Playwright (no extra download).
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
// Resolve playwright from the global install when it isn't a local dependency.
const { chromium } = require(process.env.PW_PKG || 'playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(__dirname, '..', 'public');
const svg = readFileSync(path.join(pub, 'icon.svg'), 'utf8');

const sizes = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

const browser = await chromium.launch();
try {
  for (const { file, size } of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0}
      #i{width:${size}px;height:${size}px;display:block}
      #i svg{width:100%;height:100%;display:block}
    </style></head><body><div id="i">${svg}</div></body></html>`;
    await page.setContent(html, { waitUntil: 'networkidle' });
    const el = await page.$('#i');
    await el.screenshot({ path: path.join(pub, file), omitBackground: false });
    await page.close();
    console.log('wrote', file, size + 'x' + size);
  }
} finally {
  await browser.close();
}

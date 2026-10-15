import fs from 'node:fs';
import path from 'node:path';

const indexPath = path.resolve('dist', 'index.html');
if (!fs.existsSync(indexPath)) {
  throw new Error(`Missing ${indexPath}. Run vite build before assert-peaks-base.`);
}

const html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('/peaks/assets/')) {
  throw new Error('Invalid frontend base: /peaks/assets/ was not found in dist/index.html');
}

const badRefs = [
  'src="/assets/',
  "src='/assets/",
  'href="/assets/',
  "href='/assets/",
];

for (const ref of badRefs) {
  if (html.includes(ref)) {
    throw new Error(`Invalid frontend base: root asset reference found: ${ref}`);
  }
}

const assetsDir = path.resolve('dist', 'assets');
if (!fs.existsSync(assetsDir)) {
  throw new Error(`Missing assets directory: ${assetsDir}`);
}

console.log('OK: dist/index.html uses /peaks/assets/ and contains no root /assets/ references.');

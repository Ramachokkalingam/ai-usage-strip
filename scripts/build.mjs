#!/usr/bin/env node
// Builds browser-specific copies of the extension:
//   dist/chromium/  Chrome, Edge, Brave, Opera, Arc (service worker background)
//   dist/firefox/   Firefox 121+ (event-page background, gecko id)
// and zips each one when a zip tool is available.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const base = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'));

const targets = {
  chromium(m) {
    delete m.browser_specific_settings;
    m.background = { service_worker: 'background.js' };
    return m;
  },
  firefox(m) {
    m.background = { scripts: ['shared/core.js', 'background.js'] };
    return m;
  }
};

const only = process.argv.slice(2);
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const [name, transform] of Object.entries(targets)) {
  if (only.length && !only.includes(name)) continue;
  const out = join(dist, name);
  cpSync(src, out, { recursive: true });
  const manifest = transform(structuredClone(base));
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const zipName = `ai-usage-strip-${name}-v${manifest.version}.zip`;
  const zipPath = join(dist, zipName);
  let zipped = false;
  if (process.platform === 'win32') {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${out}\\*' -DestinationPath '${zipPath}' -Force`], { stdio: 'inherit' });
    zipped = r.status === 0;
  } else {
    const r = spawnSync('zip', ['-qr', zipPath, '.'], { cwd: out, stdio: 'inherit' });
    zipped = r.status === 0;
  }
  console.log(`✓ ${name.padEnd(9)} dist/${name}/${zipped && existsSync(zipPath) ? `  +  dist/${zipName}` : '  (no zip tool found, folder only)'}`);
}

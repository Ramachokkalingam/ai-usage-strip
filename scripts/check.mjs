#!/usr/bin/env node
// Fast checks with no dependencies: JS syntax, manifest validity, and that every
// file the manifest and HTML pages point to actually exists.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const problems = [];

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = walk(src);

for (const f of files.filter((f) => f.endsWith('.js'))) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) problems.push(`${relative(root, f)}: ${r.stderr.trim()}`);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'));
} catch (e) {
  problems.push(`manifest.json: ${e.message}`);
}

if (manifest) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (pkg.version !== manifest.version) problems.push(`version mismatch: package.json ${pkg.version}, manifest ${manifest.version}`);
  const refs = [
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
    manifest.action?.default_popup,
    manifest.options_ui?.page,
    manifest.background?.service_worker,
    ...(manifest.background?.scripts || []),
    ...(manifest.content_scripts || []).flatMap((c) => [...(c.js || []), ...(c.css || [])])
  ].filter(Boolean);
  for (const ref of refs) if (!existsSync(join(src, ref))) problems.push(`manifest points to missing file: ${ref}`);
  const hosts = [...(manifest.host_permissions || [])].sort().join();
  const matches = [...(manifest.content_scripts?.[0]?.matches || [])].sort().join();
  if (hosts !== matches) problems.push('host_permissions and content_scripts matches differ');
  const core = readFileSync(join(src, 'shared/core.js'), 'utf8');
  for (const h of manifest.host_permissions || []) if (!core.includes(`'${h}'`)) problems.push(`AUS.HOST_PATTERNS is missing ${h}`);
}

for (const f of files.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
    if (!existsSync(join(dirname(f), m[1]))) problems.push(`${relative(root, f)} points to missing file: ${m[1]}`);
  }
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${files.filter((f) => f.endsWith('.js')).length} scripts, manifest and page links look good`);

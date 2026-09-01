#!/usr/bin/env node
// Substitutes the #{TOKEN}# placeholders baked into the production environment
// files (apps/frontend/src/environments/environment.ts,
// apps/dashboard/src/environments/environment.ts) with real values, after the
// app has already been built. Run once per deploy, against the built dist dir.
//
// Entra IDs and the API scope come from config/local.json - the same app
// registrations used for local development (see README), just serving a
// different redirect URI/origin. Values that only exist once infra has been
// deployed (backend/frontend hostnames) are passed in as KEY=value overrides.
//
// Usage: node tools/replace-tokens.mjs <dir> [KEY=value ...]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stripJsonComments } from './strip-json-comments.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const [, , targetDir, ...overrides] = process.argv;
if (!targetDir) {
  console.error('Usage: replace-tokens.mjs <dir> [KEY=value ...]');
  process.exit(1);
}

const config = JSON.parse(
  stripJsonComments(readFileSync(path.join(repoRoot, 'config', 'local.json'), 'utf8'))
);

const tokens = {
  ENTRA_CLIENT_ID: config.frontend.clientId,
  ENTRA_TENANT_ID: config.frontend.tenantId,
  API_SCOPE: `api://${config.backend.clientId}/access_as_user`,
};

for (const pair of overrides) {
  const idx = pair.indexOf('=');
  if (idx === -1) {
    console.error(`Ignoring malformed override (expected KEY=value): ${pair}`);
    continue;
  }
  tokens[pair.slice(0, idx)] = pair.slice(idx + 1);
}

let filesChanged = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(js|html)$/.test(entry)) continue;

    let contents = readFileSync(full, 'utf8');
    let changed = false;
    for (const [key, value] of Object.entries(tokens)) {
      const token = `#{${key}}#`;
      if (contents.includes(token)) {
        contents = contents.split(token).join(value);
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(full, contents);
      filesChanged++;
    }
  }
}

walk(targetDir);
console.log(`[replace-tokens] substituted ${Object.keys(tokens).length} token(s) across ${filesChanged} file(s) in ${targetDir}`);

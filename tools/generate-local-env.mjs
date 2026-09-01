#!/usr/bin/env node
// Regenerates the frontend's local dev environment file from config/local.json,
// the single source of truth shared with the backend (see apps/backend/Program.cs).
// Run automatically before `nx build frontend` - see apps/frontend/project.json's
// "generate-local-env" target. Pass --watch to keep running and regenerate
// whenever config/local.json changes (used by the "watch-local-env" target that
// "serve" depends on, so `nx serve frontend` picks up edits without a restart).
import { readFileSync, watch, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stripJsonComments } from './strip-json-comments.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(repoRoot, 'config', 'local.json');
const frontendOutPath = path.join(repoRoot, 'apps/frontend/src/environments/environment.development.ts');
const dashboardOutPath = path.join(repoRoot, 'apps/dashboard/src/environments/environment.development.ts');

function generate() {
  const config = JSON.parse(stripJsonComments(readFileSync(configPath, 'utf8')));

  const frontendContents = `// GENERATED FILE - do not edit directly.
// Source of truth: config/local.json (shared with the backend, see Program.cs).
// Regenerate with: node tools/generate-local-env.mjs
export const environment = {
  production: false,
  entra: {
    clientId: '${config.frontend.clientId}',
    tenantId: '${config.frontend.tenantId}',
    redirectUri: '${config.frontend.origin}',
  },
  api: {
    baseUrl: '${config.backend.baseUrl}',
    scope: 'api://${config.backend.clientId}/access_as_user',
  },
};
`;

  writeFileSync(frontendOutPath, frontendContents);
  console.log(`[generate-local-env] wrote ${path.relative(repoRoot, frontendOutPath)} from config/local.json`);

  const dashboardContents = `// GENERATED FILE - do not edit directly.
// Source of truth: config/local.json (shared with the backend, see Program.cs).
// Regenerate with: node tools/generate-local-env.mjs
export const environment = {
  production: false,
  api: {
    baseUrl: '${config.backend.baseUrl}',
  },
};
`;

  writeFileSync(dashboardOutPath, dashboardContents);
  console.log(`[generate-local-env] wrote ${path.relative(repoRoot, dashboardOutPath)} from config/local.json`);
}

generate();

if (process.argv.includes('--watch')) {
  // Editors often save via a temp-file-then-rename, which fs.watch reports as
  // 'rename' rather than 'change' - debounce and regenerate on either event.
  let pending = null;
  watch(configPath, () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      try {
        generate();
      } catch (err) {
        console.error(`[generate-local-env] failed to regenerate: ${err.message}`);
      }
    }, 100);
  });
  console.log(`[generate-local-env] watching ${path.relative(repoRoot, configPath)} for changes...`);
}

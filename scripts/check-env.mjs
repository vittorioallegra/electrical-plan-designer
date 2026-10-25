// Fails fast with a one-line fix when the local Supabase environment is not ready.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function fail(message) {
  console.error(`check-env: ${message}`);
  process.exit(1);
}

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch {
    return null;
  }
}

if (run('docker', ['info']) === null) {
  fail('Docker is not running. Start Docker Desktop, or use "pnpm dev:mem" for Docker-less dev.');
}

if (!existsSync('supabase/config.toml')) {
  fail('No supabase/config.toml yet. Use "pnpm dev:mem" until the Supabase schema exists.');
}

if (run('pnpm', ['exec', 'supabase', 'status', '-o', 'env']) === null) {
  fail('Local Supabase stack is down. Run "pnpm db:start".');
}

const envFile = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
  if (!new RegExp(`^${key}=.+`, 'm').test(envFile)) {
    fail(`${key} missing in .env.local. Run "pnpm env:local".`);
  }
}

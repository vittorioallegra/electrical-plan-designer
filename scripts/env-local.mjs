// Writes .env.local from the running local Supabase stack.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

let output;
try {
  output = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  }).toString();
} catch {
  console.error('env-local: local Supabase stack is down. Run "pnpm db:start".');
  process.exit(1);
}

const vars = Object.fromEntries(
  output
    .split('\n')
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const url = vars.API_URL;
const anonKey = vars.ANON_KEY ?? vars.PUBLISHABLE_KEY;
const serviceKey = vars.SERVICE_ROLE_KEY ?? vars.SECRET_KEY;
if (!url || !anonKey) {
  console.error('env-local: API_URL or ANON_KEY not found in "supabase status" output.');
  process.exit(1);
}

const lines = [
  `VITE_SUPABASE_URL=${url}`,
  `VITE_SUPABASE_ANON_KEY=${anonKey}`,
  'VITE_DATA_MODE=supabase',
  // Used only by integration tests (test:db); never read by the app.
  `SUPABASE_SERVICE_ROLE_KEY=${serviceKey ?? ''}`,
];
writeFileSync('.env.local', `${lines.join('\n')}\n`);
console.log('env-local: wrote .env.local');

// Builds the app, serves it with the COOP/COEP headers used in production,
// and runs the end-to-end browser tests against it.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port = 4187;
const base = `http://localhost:${port}/`;
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--host', '127.0.0.1'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', d => { serverLog += d; });
server.stderr.on('data', d => { serverLog += d; });

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    if (server.exitCode !== null) break;
    await delay(100);
  }
  return false;
}

let code = 1;
try {
  const tu = spawn(process.execPath, ['tests/multi-tu.mjs'], { stdio: 'inherit' });
  const tuCode = await new Promise(resolve => tu.on('exit', resolve));
  if (tuCode !== 0) throw new Error('Separate-translation-unit test failed.');
  if (!await waitForServer()) throw new Error('Preview server did not start:\n' + serverLog);
  const test = spawn(process.execPath, ['tests/browser-test.mjs'], {
    env: { ...process.env, BASE_URL: base },
    stdio: 'inherit',
  });
  code = await new Promise(resolve => test.on('exit', resolve));
} catch (err) {
  console.error(err.message);
} finally {
  server.kill('SIGTERM');
}
process.exit(code);

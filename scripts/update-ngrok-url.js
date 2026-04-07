#!/usr/bin/env node
/**
 * update-ngrok-url.js
 *
 * Reads the active ngrok tunnel URL from the ngrok local API (http://localhost:4040)
 * and patches MPESA_CALLBACK_URL in .env, then optionally restarts the NestJS backend.
 *
 * Usage:
 *   node scripts/update-ngrok-url.js           # update .env only
 *   node scripts/update-ngrok-url.js --restart  # update .env then restart the backend
 *
 * Prerequisites:
 *   - ngrok must already be running and forwarding to port 3000
 *     e.g.  ngrok http 3000
 *
 * The script will keep polling until ngrok comes up (up to 30 s) so you can run
 * it in parallel with `ngrok http 3000` in a second terminal.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync, spawn } = require('child_process');

const ENV_FILE = path.resolve(__dirname, '..', '.env');
const CALLBACK_PATH = '/api/v1/payments/mpesa/callback';
const NGROK_API = 'http://localhost:4040/api/tunnels';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

const RESTART = process.argv.includes('--restart');

// ---------------------------------------------------------------------------
// Helper – HTTP GET → JSON (no external deps)
// ---------------------------------------------------------------------------
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Non-JSON response from ${url}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy(new Error('Request timed out'));
    });
  });
}

// ---------------------------------------------------------------------------
// Poll ngrok local API until a public_url appears
// ---------------------------------------------------------------------------
async function getNgrokPublicUrl() {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      const body = await httpGet(NGROK_API);
      const tunnels = body.tunnels || [];
      // Prefer the HTTPS tunnel
      const https = tunnels.find(
        (t) => t.public_url && t.public_url.startsWith('https://'),
      );
      if (https) return https.public_url;
      // Fall back to any tunnel
      const any = tunnels.find((t) => t.public_url);
      if (any) return any.public_url;
    } catch {
      // ngrok not ready yet – keep polling
    }

    if (attempt === 1) {
      process.stdout.write('Waiting for ngrok...');
    } else {
      process.stdout.write('.');
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  process.stdout.write('\n');
  throw new Error(
    `ngrok did not expose a tunnel within ${POLL_TIMEOUT_MS / 1000} s.\n` +
      `Make sure ngrok is running: ngrok http 3000`,
  );
}

// ---------------------------------------------------------------------------
// Patch MPESA_CALLBACK_URL in .env
// ---------------------------------------------------------------------------
function patchEnvFile(publicUrl) {
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error(`.env file not found at ${ENV_FILE}`);
  }

  const callbackUrl = `${publicUrl}${CALLBACK_PATH}`;
  const raw = fs.readFileSync(ENV_FILE, 'utf8');

  // Replace the existing MPESA_CALLBACK_URL line (with or without comments)
  const updated = raw.replace(
    /^MPESA_CALLBACK_URL=.*$/m,
    `MPESA_CALLBACK_URL=${callbackUrl}`,
  );

  if (updated === raw && !raw.includes('MPESA_CALLBACK_URL=')) {
    throw new Error('MPESA_CALLBACK_URL key not found in .env – cannot patch.');
  }

  fs.writeFileSync(ENV_FILE, updated, 'utf8');
  return callbackUrl;
}

// ---------------------------------------------------------------------------
// Optionally restart the NestJS backend gracefully
// ---------------------------------------------------------------------------
function restartBackend() {
  console.log('\nRestarting NestJS backend...');

  // Kill whatever is holding port 3000 (Windows / *nix)
  try {
    if (process.platform === 'win32') {
      const result = execSync(
        'Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess',
        { shell: 'powershell.exe', encoding: 'utf8' },
      ).trim();

      if (result) {
        result.split(/\s+/).filter(Boolean).forEach((pid) => {
          try {
            execSync(`Stop-Process -Id ${pid} -Force`, { shell: 'powershell.exe' });
            console.log(`  Killed process ${pid} on port 3000`);
          } catch {
            // already gone
          }
        });
      }
    } else {
      execSync("fuser -k 3000/tcp 2>/dev/null || true");
    }
  } catch {
    // non-fatal – maybe nothing was on port 3000
  }

  // Spawn `npm run start:dev` detached so this script can exit
  const child = spawn('npm', ['run', 'start:dev'], {
    cwd: path.resolve(__dirname, '..'),
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  child.unref();
  console.log(`  Backend started (detached). Logs will appear in its own terminal.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('=== M-Pesa ngrok URL updater ===');
  console.log(`ENV file : ${ENV_FILE}`);
  console.log(`Polling  : ${NGROK_API}\n`);

  try {
    const publicUrl = await getNgrokPublicUrl();
    process.stdout.write('\n');
    console.log(`ngrok URL  : ${publicUrl}`);

    const callbackUrl = patchEnvFile(publicUrl);
    console.log(`Callback   : ${callbackUrl}`);
    console.log('.env updated successfully.\n');

    if (RESTART) {
      restartBackend();
    } else {
      console.log('Tip: pass --restart to also restart the NestJS backend automatically.');
    }

    console.log('\nDone.');
  } catch (err) {
    console.error('\nError:', err.message);
    process.exit(1);
  }
})();

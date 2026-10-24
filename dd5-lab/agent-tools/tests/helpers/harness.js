// Test harness: starts the REAL service as a child process on a free port and gives you a small client for it, plus the
// helpers for making tokens. Tests built on this check behaviour over HTTP, so they work whatever you named your files.
// Use it in your own tests (tests/learner/).
//
//   import { test, beforeEach } from 'node:test';
//   import assert from 'node:assert/strict';
//   import { useServer, mintScoped, forge, bearer } from '../helpers/harness.js';
//   const api = useServer();                       // starts the service before the tests, stops it after them
//   beforeEach(() => api.reset());
//   test('allow: ...', async () => {
//     const token = mintScoped({ sub: 'user_ana', actions: ['freeze_card'] });
//     const res = await api.post('/tools/freeze_card', { accountId: 'acc_ana_1' }, bearer(token));
//     assert.equal(res.status, 200);
//   });
//
// Always use useServer() rather than your own before/after hooks: `npm test -- --grep x` skips the tests that do not
// match but can still run an `after` hook, and a hook that touches a server that never started fails the whole run.
import { spawn } from 'node:child_process';
import { after, before } from 'node:test';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export { forge, mintScoped, scopedClaims, signToken, PUBLIC_KEY, ISSUER, AUDIENCE } from '../../src/lib/dev-tokens.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Headers for a request that carries a bearer token. */
export const bearer = token => ({ Authorization: `Bearer ${token}` });

export async function startServer({ env = {}, cwd = ROOT } = {}) {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd,
    env: { ...process.env, PORT: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs = [];
  const errors = [];
  let url = null;
  const ready = new Promise((resolve, reject) => {
    const out = createInterface({ input: child.stdout });
    out.on('line', line => {
      logs.push(line);
      const m = /^listening on (http:\/\/\S+)/.exec(line);
      if (m) {
        url = m[1];
        resolve();
      }
    });
    createInterface({ input: child.stderr }).on('line', line => errors.push(line));
    child.once('exit', code => reject(new Error(`The server exited before it was ready (code ${code}).\n${errors.join('\n')}`)));
    setTimeout(() => reject(new Error(`The server did not start within 20 s.\n${errors.join('\n')}`)), 20000).unref();
  });
  await ready;

  // The server must never keep the test process alive. Node's runner can skip every test in a file (for example
  // `npm test -- --grep allow`) after this `before` hook has already started a server, and then `after` never runs.
  // So: let the process exit without waiting for the child, and kill the child when it does.
  child.unref();
  child.stdout.unref();
  child.stderr.unref();
  process.once('exit', () => {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  });

  async function request(method, pathname, { body, headers, form } = {}) {
    const res = await fetch(url + pathname, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(form !== undefined ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : form !== undefined ? new URLSearchParams(Object.entries(form).filter(([, v]) => v !== undefined)).toString() : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, headers: res.headers, body: json ?? text, text };
  }

  const api = {
    url,
    logs,
    request,
    get: (p, headers) => request('GET', p, { headers }),
    post: (p, body, headers) => request('POST', p, { body, headers }),
    postForm: (p, form, headers) => request('POST', p, { form, headers }),
    state: async () => (await request('GET', '/_lab/state')).body,
    reset: () => request('POST', '/_lab/reset', { body: {} }),
    async stop() {
      if (child.exitCode !== null) return;
      const exited = new Promise(r => child.once('exit', r));
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 3000).unref();
      await exited;
    },
  };
  return api;
}

/**
 * Starts the service before the tests in this file and stops it after them. Returns the client right away: its methods
 * fill in once the server is up, so you can write `const api = useServer();` at the top of the file.
 */
export function useServer(options) {
  const api = {};
  before(async () => {
    Object.assign(api, await startServer(options));
  });
  after(() => api.stop?.());
  return api;
}

/** A check-style "advisory": prints a warning, never fails. */
export function advise(ok, message) {
  if (!ok) console.warn(`ADVISORY (not graded): ${message}`);
}

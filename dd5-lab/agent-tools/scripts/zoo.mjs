// `npm run zoo`: sends a whole zoo of tokens, good and bad, to POST /tools/freeze_card and shows what the service did.
// The last column is what a correctly hardened endpoint answers (after milestones 4 and 5). Needs `npm run dev` running.
// It resets the service first, so every run starts from the same data.
//
//   npm run zoo                                              the running service (API=http://127.0.0.1:4011 to point it elsewhere)
//   npm run zoo -- --middleware src/middleware/require-scope.js
//                                                            no server needed: mounts that file's requireScope('freeze_card') in a
//                                                            tiny app of its own and throws the same tokens at it (works after milestone 4)
//   npm run zoo -- --middleware ../checks/deck-require-scope.js
//                                                            the deck's helper as printed, if the checks/ folder is there
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from '../src/config.js';
import { PUBLIC_KEY, forge, mintScoped } from '../src/lib/dev-tokens.js';

const args = process.argv.slice(2);
const middlewareArg = args.includes('--middleware') ? args[args.indexOf('--middleware') + 1] : null;

const cases = [
  ['a good scoped token (freeze_card, for Ana)', mintScoped({ sub: 'user_ana', actions: ['freeze_card'] }), 200],
  ['the OLD shared credential (ACCOUNT_AGENT_TOKEN)', config.accountAgentToken, 403],
  ['scoped, but only for get_balance', forge('other-action'), 403],
  ['scoped, but allowed_actions is empty', forge('empty-actions'), 403],
  ['valid signature, no allowed_actions claim', forge('no-actions-claim'), 403],
  ['allowed_actions is a STRING containing "freeze_card"', forge('string-claim'), 403],
  ['no token at all', '', 401],
  ['garbage instead of a token', forge('garbage'), 401],
  ['signed with somebody else\'s key', forge('wrong-key'), 401],
  ['expired a minute ago', forge('expired'), 401],
  ['has NO exp claim (never expires)', forge('no-exp'), 401],
  ['not valid yet (nbf in the future)', forge('not-yet-valid'), 401],
  ['meant for another audience', forge('wrong-aud'), 401],
  ['issued by another issuer', forge('wrong-iss'), 401],
  ['unsigned, alg "none"', forge('alg-none'), 401],
  ['HS256 signed with the PUBLIC key as the secret', forge('hs256-public-key'), 401],
  ['an ID token, not an access token', forge('id-token'), 401],
];

async function startLocalApp(file) {
  let resolved = path.resolve(file);
  if (!existsSync(resolved)) throw new Error(`${file} not found`);
  process.env.JWT_PUBLIC_KEY ??= PUBLIC_KEY;
  // A file outside this project (the deck's helper lives in ../checks) cannot find jsonwebtoken, so use a copy placed inside it.
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let temp = null;
  if (!resolved.startsWith(appRoot + path.sep)) {
    mkdirSync(path.join(appRoot, '.data'), { recursive: true });
    temp = path.join(appRoot, '.data', `zoo-${process.pid}.mjs`);
    copyFileSync(resolved, temp);
    resolved = temp;
  }
  const { requireScope } = await import(pathToFileURL(resolved).href);
  if (typeof requireScope !== 'function') throw new Error(`${file} must export a function called requireScope`);
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  app.post('/tools/freeze_card', requireScope('freeze_card'), (req, res) => res.json({ ok: true }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  return { base: `http://127.0.0.1:${server.address().port}`, stop: () => { server.close(); if (temp) rmSync(temp, { force: true }); } };
}

async function main() {
  let base = process.env.API ?? 'http://127.0.0.1:4000';
  let stop = () => {};
  const post = (path, body, token) => fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

  if (middlewareArg) {
    try {
      ({ base, stop } = await startLocalApp(middlewareArg));
    } catch (err) {
      console.error(`Cannot use ${middlewareArg}: ${err.message}`);
      process.exitCode = 2;
      return;
    }
    console.log(`Testing ${middlewareArg} on its own (no server needed).\n`);
  } else {
    try {
      await post('/_lab/reset', {});
    } catch {
      console.error(`Cannot reach ${base}. Start the server first: npm run dev (in another terminal).`);
      process.exitCode = 2;
      return;
    }
  }

  console.log(`${'token'.padEnd(54)} ${'got'.padEnd(5)} ${'hardened'.padEnd(9)}`);
  let mismatches = 0;
  for (const [label, token, wanted] of cases) {
    const res = await post('/tools/freeze_card', { accountId: 'acc_ana_1' }, token);
    const flag = res.status === wanted ? '' : '  <-- not yet';
    if (res.status !== wanted) mismatches += 1;
    console.log(`${label.padEnd(54)} ${String(res.status).padEnd(5)} ${String(wanted).padEnd(9)}${flag}`);
  }
  stop();
  console.log(mismatches ? `\n${mismatches} of ${cases.length} answers are not what a hardened endpoint gives yet.` : '\nEvery answer is what a hardened endpoint gives.');
  process.exitCode = mismatches ? 1 : 0;
}
await main();

// Step 4: the middleware. Mounts YOUR requireScope(action) in a tiny Express app and throws every kind of token at it.
// It lives in src/middleware/require-scope.js (the milestone card says so).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import express from 'express';
import { PUBLIC_KEY, forge, mintScoped } from '../helpers/harness.js';
import { config } from '../../src/config.js';

process.env.JWT_PUBLIC_KEY ??= PUBLIC_KEY; // the deck's middleware reads the key from here
const file = new URL('../../src/middleware/require-scope.js', import.meta.url);

let server;
let base;
before(async () => {
  assert.ok(existsSync(file), 'src/middleware/require-scope.js is missing. The milestone card says where the middleware goes.');
  const { requireScope } = await import(`${file.href}?t=${Date.now()}`);
  assert.equal(typeof requireScope, 'function', 'require-scope.js must export a function called requireScope');
  const app = express();
  app.use(express.json());
  app.post('/freeze', requireScope('freeze_card'), (req, res) => res.json({ ok: true, claims: req.tokenClaims }));
  app.post('/balance', requireScope('get_balance'), (req, res) => res.json({ ok: true }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

const call = (path, authorization) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization === undefined ? {} : { authorization }) }, body: '{}' })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const bearer = t => `Bearer ${t}`;

test('a valid token for the action gets through, and the verified claims are on req.tokenClaims', async () => {
  const res = await call('/freeze', bearer(mintScoped({ sub: 'user_ana', actions: ['freeze_card'] })));
  assert.equal(res.status, 200);
  assert.equal(res.body.claims.sub, 'user_ana');
  assert.deepEqual(res.body.claims.allowed_actions, ['freeze_card']);
});

test('a token with several actions works for each one it lists', async () => {
  const token = mintScoped({ sub: 'user_ana', actions: ['freeze_card', 'get_balance'] });
  assert.equal((await call('/freeze', bearer(token))).status, 200);
  assert.equal((await call('/balance', bearer(token))).status, 200);
});

const rejected401 = [
  ['no Authorization header', undefined],
  ['an empty Authorization header', ''],
  ['"Bearer" with no token', 'Bearer'],
  ['a different scheme (Basic)', 'Basic dXNlcjpwYXNz'],
  ['a token that is not a JWT', bearer(forge('garbage'))],
  ['a token signed by somebody else\'s key', bearer(forge('wrong-key'))],
  ['an expired token', bearer(forge('expired'))],
  ['a token with NO exp claim (it would never expire)', bearer(forge('no-exp'))],
  ['a token meant for another audience', bearer(forge('wrong-aud'))],
  ['a token from another issuer', bearer(forge('wrong-iss'))],
  ['an unsigned token with alg none', bearer(forge('alg-none'))],
  ['an HS256 token signed with the public key as the secret', bearer(forge('hs256-public-key'))],
  ['a token that is not valid yet (nbf)', bearer(forge('not-yet-valid'))],
  ['an ID token, not an access token', bearer(forge('id-token'))],
];
for (const [label, header] of rejected401) {
  test(`401 invalid_token: ${label}`, async () => {
    const res = await call('/freeze', header);
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'invalid_token');
  });
}

const rejected403 = [
  ['a valid token for a different action', forge('other-action')],
  ['allowed_actions is an empty array', forge('empty-actions')],
  ['valid signature but no allowed_actions claim', forge('no-actions-claim')],
  ['allowed_actions is a STRING that merely contains the name', forge('string-claim')],
  ['the old broad shared credential', config.accountAgentToken],
];
for (const [label, token] of rejected403) {
  test(`403 insufficient_scope: ${label}`, async () => {
    const res = await call('/freeze', bearer(token));
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'insufficient_scope');
  });
}

test('the action must match exactly: a freeze_card token is refused by a get_balance gate', async () => {
  const res = await call('/balance', bearer(mintScoped({ sub: 'user_ana', actions: ['freeze_card'] })));
  assert.equal(res.status, 403);
});

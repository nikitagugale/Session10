// What the service does that does NOT change during the lab: the plumbing (health, request ids, bodies, errors), the tool
// logic itself, and the identity provider. The tools are tested without their auth gate on purpose: the gate is exactly
// what you change, so a test that went through it would break the moment you hardened it.
// Do not edit: your own tests go in tests/learner/.
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { audit } from '../../src/lib/audit.js';
import { createStore } from '../../src/store.js';
import { flagTransaction } from '../../src/tools/flag-transaction.js';
import { freezeCard } from '../../src/tools/freeze-card.js';
import { getBalance } from '../../src/tools/get-balance.js';
import { useServer } from '../helpers/harness.js';

const api = useServer();
beforeEach(() => api.reset());

// The three tool handlers on their own, with a stand-in for whatever sits in front of them.
// `req.tokenClaims` is what a verified token looks like to the handler: Chitra's agent, acting for Chitra.
const store = createStore();
let tools;
let toolsUrl;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.tokenClaims = { sub: 'user_chitra', act: { sub: 'client:account-agent' }, allowed_actions: ['get_balance', 'flag_transaction', 'freeze_card'] };
    next();
  });
  app.post('/get_balance', getBalance({ store }));
  app.post('/flag_transaction', flagTransaction({ store }));
  app.post('/freeze_card', freezeCard({ store }));
  await new Promise(resolve => { tools = app.listen(0, '127.0.0.1', resolve); });
  toolsUrl = `http://127.0.0.1:${tools.address().port}`;
});
after(() => tools?.close());
beforeEach(() => { store.reset(); audit.reset(); });

const tool = (name, body, type = 'application/json') => fetch(`${toolsUrl}/${name}`, {
  method: 'POST',
  headers: { 'content-type': type },
  body: type === 'application/json' ? JSON.stringify(body) : new URLSearchParams(body).toString(),
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('health answers', async () => {
  const res = await api.get('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('every response carries an X-Request-Id, and an incoming one is kept', async () => {
  const res = await api.get('/health');
  assert.ok(res.headers.get('x-request-id'));
  const echoed = await api.get('/health', { 'X-Request-Id': 'trace-me' });
  assert.equal(echoed.headers.get('x-request-id'), 'trace-me');
});

test('a tool call with no token is a 401 invalid_token, whatever the tool', async () => {
  for (const name of ['get_balance', 'flag_transaction', 'freeze_card']) {
    const res = await api.post(`/tools/${name}`, { accountId: 'acc_ana_1' });
    assert.equal(res.status, 401, name);
    assert.deepEqual(res.body, { error: 'invalid_token' });
  }
});

test('malformed JSON is a 400, not a crash', async () => {
  const res = await fetch(api.url + '/tools/freeze_card', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
  assert.equal(res.status, 400);
});

test('unknown routes are a 404', async () => {
  assert.equal((await api.get('/nope')).status, 404);
});

test('lab: reset restores the data and empties the audit trail', async () => {
  await api.reset();
  const state = await api.state();
  assert.equal(state.accounts.length, 3);
  assert.equal(state.audit.length, 0);
});

test('tool: get_balance returns the balance', async () => {
  const res = await tool('get_balance', { accountId: 'acc_chitra_1' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { accountId: 'acc_chitra_1', balance: 56250, currency: 'INR' });
});

test('tool: flag_transaction flags a transaction', async () => {
  const res = await tool('flag_transaction', { transactionId: 'txn_9004', reason: 'unusual' });
  assert.equal(res.status, 200);
  assert.equal(store.transactions.get('txn_9004').flagged, true);
});

test('tool: freeze_card freezes the card', async () => {
  const res = await tool('freeze_card', { accountId: 'acc_chitra_1' });
  assert.equal(res.status, 200);
  assert.equal(store.accounts.get('acc_chitra_1').cardStatus, 'frozen');
});

test('tool: a missing id is a 400, and a form body is not read as JSON', async () => {
  assert.equal((await tool('freeze_card', {})).status, 400);
  assert.equal((await tool('get_balance', {})).status, 400);
  assert.equal((await tool('flag_transaction', {})).status, 400);
  const form = await tool('freeze_card', { accountId: 'acc_chitra_1' }, 'application/x-www-form-urlencoded');
  assert.equal(form.status, 400, 'without Content-Type: application/json the body is not read');
  assert.equal(store.accounts.get('acc_chitra_1').cardStatus, 'active');
});

test('the identity provider publishes a discovery document and a key set', async () => {
  const disco = await api.get('/idp/.well-known/openid-configuration');
  assert.equal(disco.status, 200);
  assert.equal(disco.body.issuer, 'https://auth.internal.bank/');
  assert.ok(disco.body.token_endpoint.endsWith('/idp/token'));
  const jwks = await api.get('/idp/jwks.json');
  assert.equal(jwks.body.keys[0].kty, 'RSA');
});

test('the identity provider issues a scoped token (client credentials, on behalf of a user)', async () => {
  const res = await api.postForm('/idp/token', {
    grant_type: 'client_credentials', client_id: 'account-agent', client_secret: 'dev-only-secret', scope: 'freeze_card', on_behalf_of: 'user_ana',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.token_type, 'Bearer');
  assert.equal(res.body.expires_in, 900);
  const claims = JSON.parse(Buffer.from(res.body.access_token.split('.')[1], 'base64url'));
  assert.equal(claims.sub, 'user_ana');
  assert.deepEqual(claims.allowed_actions, ['freeze_card']);
});

test('the identity provider refuses a wrong secret and a scope the client may not have', async () => {
  const wrong = await api.postForm('/idp/token', { grant_type: 'client_credentials', client_id: 'account-agent', client_secret: 'nope', scope: 'freeze_card' });
  assert.equal(wrong.status, 401);
  const greedy = await api.postForm('/idp/token', { grant_type: 'client_credentials', client_id: 'account-agent', client_secret: 'dev-only-secret', scope: 'transfer_money' });
  assert.equal(greedy.status, 400);
  assert.equal(greedy.body.error, 'invalid_scope');
});

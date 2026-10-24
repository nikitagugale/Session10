// Self-checks for the kit's own fixtures. They pass at the start and must stay green all session.
// Do not edit: your own tests go in tests/learner/.
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';
import { audit } from '../../src/lib/audit.js';
import { AUDIENCE, FORGERY_KINDS, ISSUER, PUBLIC_KEY, forge, mintScoped } from '../../src/lib/dev-tokens.js';
import { createStore } from '../../src/store.js';
import { IdpError, authenticateClient, issueAccessToken } from '../../src/idp/issue.js';

const verify = (token, extra = {}) => jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'], audience: AUDIENCE, issuer: ISSUER, ...extra });

test('a scoped token verifies and carries the claims the lab relies on', () => {
  const p = verify(mintScoped({ sub: 'user_ana', actions: ['freeze_card'] }));
  assert.equal(p.sub, 'user_ana');
  assert.equal(p.act.sub, 'client:account-agent');
  assert.deepEqual(p.allowed_actions, ['freeze_card']);
  assert.equal(p.exp - p.iat, 900);
  assert.equal(p.token_use, 'access');
  assert.ok(p.jti);
});

test('without a user, sub is the agent itself and there is no act claim', () => {
  const p = verify(mintScoped({ actions: ['get_balance'] }));
  assert.equal(p.sub, 'client:account-agent');
  assert.equal(p.act, undefined);
});

test('every forged token is broken in the way it says', () => {
  assert.throws(() => verify(forge('wrong-key')), /invalid signature/);
  assert.throws(() => verify(forge('expired')), /expired/);
  assert.throws(() => verify(forge('wrong-aud')), /audience/);
  assert.throws(() => verify(forge('wrong-iss')), /issuer/);
  assert.throws(() => verify(forge('alg-none')), /signature is required|invalid/);
  assert.throws(() => verify(forge('hs256-public-key')), /invalid algorithm/);
  assert.throws(() => verify(forge('not-yet-valid')), /not active/);
  assert.equal(verify(forge('no-exp')).exp, undefined, 'this one verifies, which is the point: it never expires');
  assert.equal(verify(forge('string-claim')).allowed_actions.includes('freeze_card'), true, 'a string, and includes() is a substring search on a string');
  assert.deepEqual(verify(forge('empty-actions')).allowed_actions, []);
  assert.equal(verify(forge('no-actions-claim')).allowed_actions, undefined);
  assert.ok(FORGERY_KINDS.every(k => typeof forge(k) === 'string'));
});

test('the old shared credential is signed and valid, and far broader than any tool needs', () => {
  const p = verify(config.accountAgentToken);
  assert.equal(p.sub, 'svc-account-agent');
  assert.equal(p.allowed_actions, undefined);
  assert.ok(p.permissions.length >= 10);
  assert.ok(p.exp - Math.floor(Date.now() / 1000) > 5 * 365 * 24 * 3600, 'long-lived');
});

test('the audit trail keeps entries in order and can be reset', () => {
  audit.reset();
  audit({ event: 'x' });
  const second = audit({ event: 'y' });
  assert.equal(audit.entries.length, 2);
  assert.equal(second.seq, 2);
  assert.ok(second.ts);
  audit.reset();
  assert.equal(audit.entries.length, 0);
});

test('the store has accounts with owners, and reset restores them', () => {
  const store = createStore();
  assert.equal(store.accounts.get('acc_ben_1').ownerId, 'user_ben');
  store.accounts.get('acc_ben_1').cardStatus = 'frozen';
  store.reset();
  assert.equal(store.accounts.get('acc_ben_1').cardStatus, 'active');
});

test('the identity provider only issues what a client is registered for', () => {
  const client = authenticateClient('account-agent', 'dev-only-secret');
  assert.throws(() => authenticateClient('account-agent', 'wrong'), err => err instanceof IdpError && err.status === 401);
  assert.throws(() => issueAccessToken({ client, actions: ['transfer_money'] }), err => err.error === 'invalid_scope');
  assert.throws(() => issueAccessToken({ client, actions: [] }), err => err.error === 'invalid_scope');
  assert.throws(() => issueAccessToken({ client, actions: ['freeze_card'], onBehalfOf: 'user_nobody' }), err => err.error === 'invalid_request');
  const { ttl } = issueAccessToken({ client, actions: ['freeze_card'], ttl: 99999 });
  assert.equal(ttl, 900, 'the identity provider caps the lifetime');
});

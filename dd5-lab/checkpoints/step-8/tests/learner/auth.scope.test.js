// Reference tests for milestone 6: allow and deny cases for the scoped endpoint, and for the role/scope table.
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../src/config.js';
import { AGENT_SCOPES, ROLE_ACTIONS, roleCan, scopeCan } from '../../src/auth/policy.js';
import { bearer, forge, mintScoped, useServer } from '../helpers/harness.js';

const api = useServer();
beforeEach(() => api.reset());

const freeze = (headers, accountId = 'acc_ana_1') => api.post('/tools/freeze_card', { accountId }, headers);

test('allow: a token scoped to freeze_card, acting for the account owner, freezes the card', async () => {
  const res = await freeze(bearer(mintScoped({ sub: 'user_ana', actions: ['freeze_card'] })));
  assert.equal(res.status, 200);
  assert.equal((await api.state()).accounts.find(a => a.id === 'acc_ana_1').cardStatus, 'frozen');
});

test('allow: a token with several actions still works for the one it lists', async () => {
  const res = await freeze(bearer(mintScoped({ sub: 'user_ana', actions: ['get_balance', 'freeze_card'] })));
  assert.equal(res.status, 200);
});

const denied401 = ['wrong-key', 'expired', 'no-exp', 'wrong-aud', 'wrong-iss', 'alg-none', 'hs256-public-key', 'not-yet-valid', 'garbage', 'id-token'];
for (const kind of denied401) {
  test(`deny: a ${kind} token is a 401`, async () => {
    const res = await freeze(bearer(forge(kind)));
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'invalid_token');
  });
}

const denied403 = ['other-action', 'empty-actions', 'no-actions-claim', 'string-claim'];
for (const kind of denied403) {
  test(`deny: a valid token with ${kind} is a 403`, async () => {
    const res = await freeze(bearer(forge(kind)));
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'insufficient_scope');
  });
}

test('deny: no token at all is a 401', async () => {
  assert.equal((await freeze({})).status, 401);
});

test('deny: the old broad token is a 403 and the card stays active', async () => {
  const res = await freeze(bearer(config.accountAgentToken));
  assert.equal(res.status, 403);
  assert.equal((await api.state()).accounts.find(a => a.id === 'acc_ana_1').cardStatus, 'active');
});

test('deny: a denial leaks nothing about the account', async () => {
  const res = await freeze(bearer(forge('other-action')));
  assert.deepEqual(Object.keys(res.body), ['error']);
});

test('allow: each human role can do exactly what the table says', () => {
  assert.equal(roleCan('card_ops', 'freeze_card'), true);
  assert.equal(roleCan('fraud_analyst', 'flag_transaction'), true);
  assert.equal(roleCan('admin', 'freeze_card'), true);
});

test('deny: a role cannot do what the table does not give it', () => {
  assert.equal(roleCan('support_agent', 'freeze_card'), false);
  assert.equal(roleCan('fraud_analyst', 'freeze_card'), false);
  assert.equal(roleCan('nobody', 'get_balance'), false);
});

test('deny: no agent scope is as wide as any human role that shares one of its actions', () => {
  for (const [scope, actions] of Object.entries(AGENT_SCOPES)) {
    for (const [role, roleActions] of Object.entries(ROLE_ACTIONS)) {
      if (!actions.some(a => roleActions.includes(a))) continue;
      assert.ok(actions.every(a => roleActions.includes(a)) && actions.length < roleActions.length, `${scope} must be strictly narrower than ${role}`);
    }
  }
  assert.equal(scopeCan('card-agent', 'flag_transaction'), false);
});

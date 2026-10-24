import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useServer, mintScoped, forge, bearer } from '../helpers/harness.js';
import { config } from '../../src/config.js';
import { ROLE_ACTIONS, AGENT_SCOPES } from '../../src/auth/policy.js';

const api = useServer();
beforeEach(() => api.reset());

const freeze = (headers, accountId = 'acc_ana_1') => api.post('/tools/freeze_card', { accountId }, headers);
const cardStatus = async id => (await api.state()).accounts.find(a => a.id === id).cardStatus;

async function assertRefused(headers, status, error) {
  const res = await freeze(headers);
  assert.equal(res.status, status);
  assert.deepEqual(res.body, { error });
  assert.equal(await cardStatus('acc_ana_1'), 'active', 'the card must stay active after a refusal');
}

// ---- allow ----
test('allow: a token scoped to freeze_card freezes the card', async () => {
  const res = await freeze(bearer(mintScoped({ sub: 'user_ana', actions: ['freeze_card'] })));
  assert.equal(res.status, 200);
  assert.equal(res.body.cardStatus, 'frozen');
  assert.equal(await cardStatus('acc_ana_1'), 'frozen');
});

test('allow: a token with freeze_card among other actions still works', async () => {
  const res = await freeze(bearer(mintScoped({ sub: 'user_ana', actions: ['get_balance', 'freeze_card'] })));
  assert.equal(res.status, 200);
});

test('allow: card-agent scope from the policy table freezes a card', async () => {
  const res = await freeze(bearer(mintScoped({ sub: 'user_ana', actions: AGENT_SCOPES['card-agent'] })));
  assert.equal(res.status, 200);
});

test('allow: the policy gives card_ops and admin freeze_card, and card-agent is scoped to it', () => {
  assert.ok(ROLE_ACTIONS.card_ops.includes('freeze_card'));
  assert.ok(ROLE_ACTIONS.admin.includes('freeze_card'));
  assert.deepEqual(AGENT_SCOPES['card-agent'], ['freeze_card']);
});

// ---- deny: 401, the token cannot be trusted ----
test('deny: no token is a 401', () => assertRefused({}, 401, 'invalid_token'));
test('deny: garbage instead of a token is a 401', () => assertRefused(bearer(forge('garbage')), 401, 'invalid_token'));
test('deny: a token signed with the wrong key is a 401', () => assertRefused(bearer(forge('wrong-key')), 401, 'invalid_token'));
test('deny: an expired token is a 401', () => assertRefused(bearer(forge('expired')), 401, 'invalid_token'));
test('deny: a token with no exp (never expires) is a 401', () => assertRefused(bearer(forge('no-exp')), 401, 'invalid_token'));
test('deny: a token for another audience is a 401', () => assertRefused(bearer(forge('wrong-aud')), 401, 'invalid_token'));
test('deny: a token from another issuer is a 401', () => assertRefused(bearer(forge('wrong-iss')), 401, 'invalid_token'));
test('deny: an unsigned alg none token is a 401', () => assertRefused(bearer(forge('alg-none')), 401, 'invalid_token'));
test('deny: an HS256 token signed with the public key is a 401', () => assertRefused(bearer(forge('hs256-public-key')), 401, 'invalid_token'));

// ---- deny: 403, the token is genuine but not allowed ----
test('deny: the old broad credential is a 403', () => assertRefused(bearer(config.accountAgentToken), 403, 'insufficient_scope'));
test('deny: a token scoped to another action is a 403', () => assertRefused(bearer(forge('other-action')), 403, 'insufficient_scope'));
test('deny: a token with empty allowed_actions is a 403', () => assertRefused(bearer(forge('empty-actions')), 403, 'insufficient_scope'));
test('deny: allowed_actions as a string containing freeze_card is a 403', () => assertRefused(bearer(forge('string-claim')), 403, 'insufficient_scope'));
test('deny: a fraud-agent token cannot freeze a card', () =>
  assertRefused(bearer(mintScoped({ sub: 'user_ana', actions: AGENT_SCOPES['fraud-agent'] })), 403, 'insufficient_scope'));

// ---- the table itself: stretch, fails if an agent scope is widened later ----
test('deny: no agent scope is as wide as, or wider than, a human role sharing one of its actions', () => {
  for (const [scope, actions] of Object.entries(AGENT_SCOPES)) {
    assert.equal(actions.length, 1, `${scope} must stay a single action`);
    for (const [role, roleActions] of Object.entries(ROLE_ACTIONS)) {
      if (!actions.some(a => roleActions.includes(a))) continue;
      assert.ok(actions.every(a => roleActions.includes(a)), `${scope} must be a subset of ${role}`);
      assert.ok(actions.length < roleActions.length, `${scope} must be strictly narrower than ${role}`);
    }
  }
});

// Step 8: the confused deputy. A token with the RIGHT scope is not enough: the account has to belong to the person the agent
// is acting for (the token's sub). Ana's agent must not be able to freeze Ben's card, however good its token is.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { advise, bearer, mintScoped, useServer } from '../helpers/harness.js';

const api = useServer();
beforeEach(() => api.reset());

const anaToken = () => mintScoped({ sub: 'user_ana', actions: ['freeze_card'] });
const freeze = (token, accountId) => api.post('/tools/freeze_card', { accountId }, bearer(token));
const cardOf = async id => (await api.state()).accounts.find(a => a.id === id).cardStatus;

test('the agent can freeze the card of the person it is acting for', async () => {
  const res = await freeze(anaToken(), 'acc_ana_1');
  assert.equal(res.status, 200);
  assert.equal(await cardOf('acc_ana_1'), 'frozen');
});

test('the same token cannot freeze someone else\'s card: 403 forbidden, and the card stays active', async () => {
  const res = await freeze(anaToken(), 'acc_ben_1');
  assert.equal(res.status, 403, `got ${res.status} ${res.text}`);
  assert.equal(res.body.error, 'forbidden');
  assert.equal(await cardOf('acc_ben_1'), 'active');
});

test('an account that does not exist gets exactly the same answer as one that is not yours', async () => {
  const foreign = await freeze(anaToken(), 'acc_ben_1');
  const missing = await freeze(anaToken(), 'acc_nobody_9');
  assert.equal(missing.status, foreign.status, 'a different status would tell an attacker which account numbers exist');
  assert.deepEqual(missing.body, foreign.body);
});

test('the refusal leaks nothing about the other account', async () => {
  const res = await freeze(anaToken(), 'acc_ben_1');
  assert.deepEqual(Object.keys(res.body), ['error']);
  assert.ok(!/Ben|Thomas|8400|user_ben/.test(res.text), 'the body must not mention the other customer');
});

test('a token that names no end user (sub is the agent itself) cannot freeze any account', async () => {
  const res = await freeze(mintScoped({ actions: ['freeze_card'] }), 'acc_ana_1');
  assert.equal(res.status, 403);
  assert.equal(await cardOf('acc_ana_1'), 'active');
});

test('each user\'s agent works on their own account only', async () => {
  const ben = mintScoped({ sub: 'user_ben', actions: ['freeze_card'] });
  assert.equal((await freeze(ben, 'acc_ben_1')).status, 200);
  assert.equal((await freeze(ben, 'acc_ana_1')).status, 403);
  assert.equal(await cardOf('acc_ana_1'), 'active');
});

test('a missing accountId is still a 400', async () => {
  assert.equal((await api.post('/tools/freeze_card', {}, bearer(anaToken()))).status, 400);
});

test('a refused call leaves exactly ONE audit entry, and it says denied (not an "allowed" one followed by a "denied" one)', async () => {
  const res = await freeze(anaToken(), 'acc_ben_1');
  assert.equal(res.status, 403);
  const entries = (await api.state()).audit;
  assert.equal(entries.length, 1, `${entries.length} audit entries for one refused call: ${entries.map(e => e.outcome).join(', ')}. Write the entry once, after the decision is made.`);
  assert.equal(entries[0].outcome, 'denied');
  assert.match(entries[0].reason ?? '', /owner|unknown/, 'the reason should say why: not_account_owner or unknown_account');
  assert.equal(entries[0].accountId, 'acc_ben_1');
});

test('advisory: the allowed call is still recorded exactly once', async () => {
  await freeze(anaToken(), 'acc_ana_1');
  const entries = (await api.state()).audit;
  advise(entries.length === 1 && entries[0].outcome === 'allowed', `expected one allowed entry, got ${entries.length}`);
});

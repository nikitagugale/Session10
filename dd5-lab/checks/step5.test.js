// Step 5: freeze_card is protected. Over HTTP, against the real service. Only POST /tools/freeze_card is judged here.
// (get_balance and flag_transaction may still use the old shared credential: hardening them is the homework.)
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../src/config.js';
import { advise, bearer, forge, mintScoped, useServer } from '../helpers/harness.js';

const api = useServer();
beforeEach(() => api.reset());

const freeze = (headers, accountId = 'acc_ana_1') => api.post('/tools/freeze_card', { accountId }, headers);
const cardOf = async id => (await api.state()).accounts.find(a => a.id === id).cardStatus;

test('a token scoped to freeze_card freezes the card', async () => {
  const res = await freeze(bearer(mintScoped({ sub: 'user_ana', actions: ['freeze_card'] })));
  assert.equal(res.status, 200, 'a freeze_card-scoped token is not accepted. Is your scope gate in front of the freeze_card route in src/app.js, and does that route still run the handler after it?');
  assert.deepEqual(res.body, { accountId: 'acc_ana_1', cardStatus: 'frozen' });
  assert.equal(await cardOf('acc_ana_1'), 'frozen');
});

test('the OLD broad token is now a 403, and the card is untouched', async () => {
  const res = await freeze(bearer(config.accountAgentToken));
  assert.equal(res.status, 403, 'the old shared credential must now be refused on freeze_card (403: a real token, but not allowed this action). Is that route still behind the old credential check?');
  assert.equal(res.body.error, 'insufficient_scope');
  assert.equal(await cardOf('acc_ana_1'), 'active');
});

test('a token scoped to a different tool is a 403', async () => {
  const res = await freeze(bearer(mintScoped({ sub: 'user_ana', actions: ['get_balance'] })));
  assert.equal(res.status, 403);
  assert.equal(await cardOf('acc_ana_1'), 'active');
});

test('no token is a 401', async () => {
  const res = await freeze({});
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'invalid_token');
});

for (const kind of ['garbage', 'wrong-key', 'expired', 'no-exp', 'wrong-aud', 'wrong-iss', 'alg-none', 'hs256-public-key', 'not-yet-valid']) {
  test(`a ${kind} token is a 401 and changes nothing`, async () => {
    const res = await freeze(bearer(forge(kind)));
    assert.equal(res.status, 401);
    assert.equal(await cardOf('acc_ana_1'), 'active');
  });
}

for (const kind of ['empty-actions', 'no-actions-claim', 'string-claim']) {
  test(`a valid token with ${kind} is a 403 and changes nothing`, async () => {
    const res = await freeze(bearer(forge(kind)));
    assert.equal(res.status, 403);
    assert.equal(await cardOf('acc_ana_1'), 'active');
  });
}

test('a refusal says nothing about the account', async () => {
  const res = await freeze(bearer(config.accountAgentToken));
  assert.deepEqual(Object.keys(res.body), ['error']);
  assert.ok(!/Ana|125000|acc_ana/.test(res.text), 'the body must not mention the account');
});

test('advisory: the other two tools', async () => {
  const res = await api.post('/tools/get_balance', { accountId: 'acc_ana_1' }, bearer(config.accountAgentToken));
  advise(res.status === 200, 'get_balance no longer accepts the old credential. Fine if you hardened it too, but that was the homework.');
});

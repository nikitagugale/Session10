// PRESENTER ONLY (the verify matrix runs it). The facts the milestone-1 findings are checked against, proved on the UNTOUCHED service.
// GREEN on the baseline, RED once the old credential has been hardened. Learners never see this file.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';
import { bearer, useServer } from '../helpers/harness.js';

const api = useServer();
beforeEach(() => api.reset());
const old = () => bearer(config.accountAgentToken);
const claims = jwt.decode(config.accountAgentToken);

test('problem 1: one broad token opens every tool', async () => {
  assert.equal((await api.post('/tools/get_balance', { accountId: 'acc_ana_1' }, old())).status, 200);
  assert.equal((await api.post('/tools/flag_transaction', { transactionId: 'txn_9001', reason: 'x' }, old())).status, 200);
  assert.equal((await api.post('/tools/freeze_card', { accountId: 'acc_ana_1' }, old())).status, 200);
});

test('problem 2: it works on EVERY account, whoever the customer is', async () => {
  for (const accountId of ['acc_ana_1', 'acc_ben_1', 'acc_chitra_1']) {
    assert.equal((await api.post('/tools/freeze_card', { accountId }, old())).status, 200, `froze ${accountId}`);
  }
  const state = await api.state();
  assert.ok(state.accounts.every(a => a.cardStatus === 'frozen'));
});

test('problem 3: it is valid for years', () => {
  const daysLeft = (claims.exp - Math.floor(Date.now() / 1000)) / 86400;
  assert.ok(daysLeft > 365, `expires in ${Math.round(daysLeft)} days`);
});

test('problem 4: it holds far more permissions than the three tools use, and no allowed_actions at all', () => {
  assert.ok(Array.isArray(claims.permissions) && claims.permissions.length >= 10, `${claims.permissions?.length} permissions`);
  assert.equal(claims.allowed_actions, undefined);
});

test('problem 5: nothing is recorded, and nothing can be revoked', async () => {
  await api.post('/tools/freeze_card', { accountId: 'acc_ben_1' }, old());
  assert.equal((await api.state()).audit.length, 0, 'there is no audit trail');
  assert.equal((await api.post('/idp/revoke', { refresh_token: 'x' })).status, 404, 'there is no way to revoke');
});

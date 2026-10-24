// Step 7: the audit log. Every call to freeze_card, allowed or denied, leaves ONE entry in the audit trail (audit() from
// src/lib/audit.js, shown by /_lab/state) saying who, what and with which scope. The fields are named on the milestone card.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../src/config.js';
import { bearer, forge, mintScoped, useServer } from '../helpers/harness.js';

const api = useServer();
beforeEach(() => api.reset());

const freeze = (headers, accountId = 'acc_ana_1') => api.post('/tools/freeze_card', { accountId }, headers);
const trail = async () => (await api.state()).audit;

test('an allowed call leaves one entry: who, what, which scope, which account', async () => {
  const res = await freeze(bearer(mintScoped({ sub: 'user_ana', actions: ['freeze_card'] })));
  assert.equal(res.status, 200);
  const entries = await trail();
  assert.equal(entries.length, 1, 'exactly one entry per call');
  const e = entries[0];
  assert.equal(e.event, 'tool_call');
  assert.equal(e.action, 'freeze_card');
  assert.equal(e.outcome, 'allowed');
  assert.equal(e.sub, 'user_ana', 'sub is the person the agent acted for');
  assert.equal(e.actor, 'client:account-agent', 'actor is the agent (the act.sub claim)');
  assert.equal(e.accountId, 'acc_ana_1');
  assert.ok(Array.isArray(e.allowedActions) && e.allowedActions.includes('freeze_card'), 'allowedActions records the scope the token carried');
  assert.equal(e.requestId, res.headers.get('x-request-id'), 'requestId ties the entry to the request');
});

test('a call refused for scope is recorded as denied, with the reason and who tried', async () => {
  const res = await freeze(bearer(mintScoped({ sub: 'user_ana', actions: ['get_balance'] })));
  assert.equal(res.status, 403);
  const entries = await trail();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].outcome, 'denied');
  assert.equal(entries[0].reason, 'insufficient_scope');
  assert.equal(entries[0].sub, 'user_ana');
  assert.equal(entries[0].action, 'freeze_card');
  assert.equal(entries[0].requestId, res.headers.get('x-request-id'));
});

test('the old broad token is also recorded as denied', async () => {
  await freeze(bearer(config.accountAgentToken));
  const [e, ...rest] = await trail();
  assert.equal(rest.length, 0);
  assert.equal(e.outcome, 'denied');
  assert.equal(e.reason, 'insufficient_scope');
});

test('a call with a bad token is recorded as denied, and the identity is unknown', async () => {
  const res = await freeze(bearer(forge('wrong-key')));
  assert.equal(res.status, 401);
  const entries = await trail();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].outcome, 'denied');
  assert.equal(entries[0].reason, 'invalid_token');
  assert.ok(!entries[0].sub, 'nobody was identified, so there is no sub to record');
});

test('a call with no token at all is recorded too', async () => {
  await freeze({});
  const entries = await trail();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].reason, 'invalid_token');
  assert.equal(entries[0].outcome, 'denied');
});

test('the trail never holds a token, and never customer data', async () => {
  const good = mintScoped({ sub: 'user_ana', actions: ['freeze_card'] });
  const bad = forge('wrong-key');
  await freeze(bearer(good));
  await freeze(bearer(bad));
  await freeze(bearer(config.accountAgentToken));
  const text = JSON.stringify(await trail());
  assert.ok(!text.includes(good) && !text.includes(bad) && !text.includes(config.accountAgentToken), 'a raw token is in the audit trail');
  assert.ok(!text.includes('eyJ'), 'something that looks like a JWT is in the audit trail');
  assert.ok(!/Ana Rao|125000/.test(text), 'customer data (a name or a balance) is in the audit trail');
});

test('one entry per call, in order', async () => {
  await freeze(bearer(forge('expired')));
  await freeze(bearer(mintScoped({ sub: 'user_ana', actions: ['freeze_card'] })));
  const entries = await trail();
  assert.deepEqual(entries.map(e => e.outcome), ['denied', 'allowed']);
  assert.ok(entries[1].seq > entries[0].seq);
});

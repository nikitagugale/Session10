// Presenter check for the demo: refresh-token rotation and revocation in the identity provider (POST /idp/token, POST /idp/revoke).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { PUBLIC_KEY, useServer } from '../helpers/harness.js';

const api = useServer();
beforeEach(() => api.reset());

const client = { client_id: 'account-agent', client_secret: 'dev-only-secret' };
const issue = () => api.postForm('/idp/token', { grant_type: 'client_credentials', ...client, scope: 'freeze_card', on_behalf_of: 'user_ana' });
const refresh = refresh_token => api.postForm('/idp/token', { grant_type: 'refresh_token', ...client, refresh_token });

test('client credentials returns a 15-minute access token and a refresh token', async () => {
  const res = await issue();
  assert.equal(res.status, 200);
  assert.ok(res.body.refresh_token, 'no refresh_token in the response');
  assert.equal(res.body.expires_in, 900);
  const claims = jwt.verify(res.body.access_token, PUBLIC_KEY, { algorithms: ['RS256'], audience: 'agent-tools', issuer: 'https://auth.internal.bank/' });
  assert.equal(claims.exp - claims.iat, 900);
  assert.equal(claims.sub, 'user_ana');
});

test('refreshing rotates: a NEW refresh token and a new access token, carrying the same scope', async () => {
  const first = (await issue()).body;
  const res = await refresh(first.refresh_token);
  assert.equal(res.status, 200, res.text);
  assert.ok(res.body.refresh_token && res.body.refresh_token !== first.refresh_token, 'the refresh token must change on every use');
  const a = jwt.decode(first.access_token);
  const b = jwt.decode(res.body.access_token);
  assert.deepEqual(b.allowed_actions, a.allowed_actions);
  assert.equal(b.sub, a.sub);
  assert.notEqual(b.jti, a.jti, 'a fresh access token has its own jti');
});

test('the OLD refresh token stops working after it is used: 400 invalid_grant', async () => {
  const first = (await issue()).body;
  await refresh(first.refresh_token);
  const again = await refresh(first.refresh_token);
  assert.equal(again.status, 400);
  assert.equal(again.body.error, 'invalid_grant');
});

test('revoking a refresh token cuts it off at once', async () => {
  const first = (await issue()).body;
  const revoked = await api.post('/idp/revoke', { ...client, refresh_token: first.refresh_token });
  assert.equal(revoked.status, 200, revoked.text);
  const res = await refresh(first.refresh_token);
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'invalid_grant');
});

test('refresh tokens are never stored in plain text', async () => {
  const first = (await issue()).body;
  const second = (await refresh(first.refresh_token)).body;
  const stored = JSON.stringify((await api.state()).redis);
  assert.ok(stored.length > 10, 'nothing is stored in Redis at all');
  assert.ok(!stored.includes(first.refresh_token) && !stored.includes(second.refresh_token), 'a raw refresh token is in Redis');
});

test('a garbage refresh token is a 400 invalid_grant, not a crash', async () => {
  const res = await refresh('not-a-real-token');
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'invalid_grant');
});

test('docs/runbook-revoke-token.md exists and tells you how to revoke', () => {
  const file = new URL('../../docs/runbook-revoke-token.md', import.meta.url);
  assert.ok(existsSync(file), 'write the incident runbook to docs/runbook-revoke-token.md');
  const text = readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length >= 6 && /revoke/i.test(text));
});

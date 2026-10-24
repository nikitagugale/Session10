// `npm run refresh-demo`: walks through the life of a refresh token against the identity provider and says what happened.
// Needs `npm run dev`. It shows nothing useful until the identity provider supports refresh tokens (the demo builds that).
import jwt from 'jsonwebtoken';

const base = process.env.API ?? 'http://127.0.0.1:4000';
const client = { client_id: 'account-agent', client_secret: 'dev-only-secret' };
const short = t => (t ? `${String(t).slice(0, 10)}...` : '(none)');

async function token(form) {
  const res = await fetch(`${base}/idp/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...client, ...form }).toString() });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  try {
    await fetch(`${base}/_lab/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  } catch {
    console.error(`Cannot reach ${base}. Start the server first: npm run dev (in another terminal).`);
    process.exitCode = 2;
    return;
  }

  const line = (n, what, got) => console.log(`${String(n).padStart(2)}. ${what.padEnd(40)} ${got}`);
  const first = await token({ grant_type: 'client_credentials', scope: 'freeze_card', on_behalf_of: 'user_ana' });
  const claims = jwt.decode(first.body.access_token) ?? {};
  line(1, 'sign in (client credentials)', `${first.status}  access token lives ${claims.exp - claims.iat} s,  refresh token ${short(first.body.refresh_token)}`);
  if (!first.body.refresh_token) {
    console.log('\nNo refresh_token in the answer. The identity provider does not do refresh tokens yet.');
    process.exitCode = 1;
    return;
  }

  const r1 = first.body.refresh_token;
  const second = await token({ grant_type: 'refresh_token', refresh_token: r1 });
  line(2, 'refresh with the first refresh token', `${second.status}  new refresh token ${short(second.body.refresh_token)}`);
  const third = await token({ grant_type: 'refresh_token', refresh_token: second.body.refresh_token });
  line(3, 'refresh with the second one', `${third.status}  new refresh token ${short(third.body.refresh_token)}`);

  const revoke = await fetch(`${base}/idp/revoke`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...client, refresh_token: third.body.refresh_token ?? '' }).toString() });
  line(4, 'revoke the third (suspected leak)', `${revoke.status}`);
  const afterRevoke = await token({ grant_type: 'refresh_token', refresh_token: third.body.refresh_token });
  line(5, 'refresh with the revoked one', `${afterRevoke.status}  ${afterRevoke.body.error ?? ''}`);
  const replay = await token({ grant_type: 'refresh_token', refresh_token: r1 });
  line(6, 'replay the very first one (a copy)', `${replay.status}  ${replay.body.error ?? ''}`);

  const state = await (await fetch(`${base}/_lab/state`)).json();
  const stored = JSON.stringify(state.redis);
  const raw = [r1, second.body.refresh_token, third.body.refresh_token].some(t => t && stored.includes(t));
  line(7, 'what Redis holds', `${state.redis.length} keys, ${raw ? 'A RAW REFRESH TOKEN IS STORED' : 'no raw refresh token among them'}`);

  const ok = second.status === 200 && third.status === 200 && revoke.status === 200 && afterRevoke.status === 400 && replay.status === 400 && !raw;
  console.log(ok ? '\nAll as a rotation-and-revocation scheme should behave.' : '\nSomething is not right yet: compare each line with what it should say.');
  process.exitCode = ok ? 0 : 1;
}
await main();

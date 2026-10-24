// `npm run attack`: the confused-deputy test from Milestone 8. Ana's agent holds a perfectly good token for freeze_card, acting
// for Ana. It is now tricked (think: a prompt injection in a chat message) into freezing BEN's card. Needs `npm run dev`.
// Exit code 0 only if the service refuses with a 403 and Ben's card is still active.
import { mintScoped } from '../src/lib/dev-tokens.js';

const base = process.env.API ?? 'http://127.0.0.1:4000';
const call = (path, body, token) => fetch(base + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

async function main() {
try {
  await call('/_lab/reset', {});
} catch {
  console.error(`Cannot reach ${base}. Start the server first: npm run dev (in another terminal).`);
  process.exitCode = 2;
  return;
}

const token = mintScoped({ sub: 'user_ana', actions: ['freeze_card'] });
console.log("Ana's agent holds a token that is allowed to freeze_card, acting for user_ana.");
console.log("It is tricked into asking for Ben's account, acc_ben_1.\n");
const res = await call('/tools/freeze_card', { accountId: 'acc_ben_1' }, token);
const text = await res.text();
const state = await (await fetch(`${base}/_lab/state`)).json();
const ben = state.accounts.find(a => a.id === 'acc_ben_1');
console.log(`  response : ${res.status} ${text}`);
console.log(`  Ben's card is now: ${ben.cardStatus}\n`);

if (res.status === 401) {
  console.log('The service did not even accept the token (it still uses the old shared credential).\nThere is nothing to attack yet: finish milestones 4 and 5 first.');
  process.exitCode = 2;
  return;
}
if (res.status === 403 && ben.cardStatus === 'active') {
  console.log('OK: the service refused. A valid scope was not enough: it also checked that the account belongs to the caller.');
  process.exitCode = 0;
  return;
}
console.log("PROBLEM: the service accepted a valid scope and acted on somebody else's account.");
process.exitCode = 1;
}
await main();

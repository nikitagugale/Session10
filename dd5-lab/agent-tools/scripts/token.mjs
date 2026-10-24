// `npm run -s token -- ...` prints ONE token on stdout, so you can use it straight in curl:
//   TOKEN=$(npm run -s token -- freeze_card --user user_ana)
//   curl -s -X POST http://127.0.0.1:4000/tools/freeze_card -H "Authorization: Bearer $TOKEN" \
//        -H 'Content-Type: application/json' -d '{"accountId":"acc_ana_1"}'
//
//   npm run -s token -- <action>                  a scoped token for ONE tool: get_balance | flag_transaction | freeze_card
//   npm run -s token -- --actions a,b             a token for several tools (the identity provider would allow it; you should not)
//   npm run -s token -- <action> --user user_ben  acting on behalf of that user (their id becomes the token's sub)
//   npm run -s token -- <action> --ttl 60         lives 60 seconds (the identity provider caps it at 900)
//   npm run -s token -- broad                     the old shared credential, ACCOUNT_AGENT_TOKEN
//   npm run -s token -- --forge expired           a broken or forged token: expired | no-exp | wrong-key | wrong-aud | wrong-iss |
//                                                 alg-none | hs256-public-key | not-yet-valid | empty-actions | other-action |
//                                                 no-actions-claim | string-claim | id-token | garbage   (add --action to change the tool)
// Hints go to stderr, so `$(...)` captures only the token.
import { config } from '../src/config.js';
import { FORGERY_KINDS, forge, mintScoped } from '../src/lib/dev-tokens.js';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(`--${name}`); return i > -1 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const actionOpt = opt('action');

function usage(msg) {
  if (msg) console.error(msg + '\n');
  console.error('Usage: npm run -s token -- <get_balance|flag_transaction|freeze_card|broad> [--user user_ana] [--ttl 900]\n       npm run -s token -- --forge <kind> [--action freeze_card]\nKinds: ' + FORGERY_KINDS.join(', '));
  process.exit(2);
}

if (opt('forge')) {
  process.stdout.write(forge(opt('forge'), actionOpt ?? positional[0] ?? 'freeze_card', opt('user') ?? 'user_ana') + '\n');
} else if (positional[0] === 'broad') {
  if (!config.accountAgentToken) usage('ACCOUNT_AGENT_TOKEN is empty. Is config/agent.env there?');
  process.stdout.write(config.accountAgentToken + '\n');
} else {
  const actions = opt('actions') ? opt('actions').split(',').map(s => s.trim()).filter(Boolean) : positional.slice(0, 1);
  if (!actions.length) usage('Say which action the token is for.');
  const token = mintScoped({ sub: opt('user'), actions, ttl: opt('ttl') ? Number(opt('ttl')) : 900 });
  if (!opt('user')) console.error('(no --user: the token has no end user, so its sub is the agent itself)');
  process.stdout.write(token + '\n');
}

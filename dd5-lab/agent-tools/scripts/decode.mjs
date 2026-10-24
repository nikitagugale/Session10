// `npm run -s decode -- <token>` or `npm run -s decode -- --env`: shows what is INSIDE a token.
// Reading a token is not the same as trusting it: anyone can write any claims into a JWT. The last line says whether the
// signature actually checks out against the dev public key.
import { config } from '../src/config.js';
import jwt from 'jsonwebtoken';
import { PUBLIC_KEY } from '../src/lib/dev-tokens.js';

const arg = process.argv[2];
const token = arg === '--env' ? config.accountAgentToken : arg;
if (!token) {
  console.error('Usage: npm run -s decode -- <token>\n       npm run -s decode -- --env     (decodes ACCOUNT_AGENT_TOKEN, the shared credential)');
  process.exit(2);
}

const decoded = jwt.decode(token, { complete: true });
if (!decoded) {
  console.error('That is not a JWT (it should be three parts separated by dots).');
  process.exit(1);
}
console.log('header ', JSON.stringify(decoded.header));
console.log('payload', JSON.stringify(decoded.payload, null, 2));

const p = decoded.payload;
const now = Math.floor(Date.now() / 1000);
console.log('');
if (typeof p.exp !== 'number') console.log('expires : NEVER (there is no exp claim at all)');
else if (p.exp < now) console.log(`expires : ALREADY EXPIRED (${new Date(p.exp * 1000).toISOString()})`);
else {
  const secs = p.exp - now;
  console.log(`expires : ${new Date(p.exp * 1000).toISOString()}  (in ${secs >= 86400 ? `${Math.round(secs / 86400)} days` : secs >= 3600 ? `${Math.round(secs / 3600)} hours` : `${Math.round(secs / 60)} minutes`})`);
}
console.log(`actions : ${Array.isArray(p.allowed_actions) ? p.allowed_actions.join(', ') || '(none)' : p.allowed_actions === undefined ? '(no allowed_actions claim)' : `NOT AN ARRAY: ${JSON.stringify(p.allowed_actions)}`}`);
if (Array.isArray(p.permissions)) console.log(`permissions : ${p.permissions.length} listed`);
try {
  jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'], ignoreExpiration: true });
  console.log('signature: VALID for the dev public key (this says nothing about expiry, audience or scope)');
} catch (e) {
  console.log(`signature: NOT valid (${e.message})`);
}
console.log('\nDecoding is not validating. Never make a decision from claims you have not verified.');

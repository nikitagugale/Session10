// Makes tokens for the lab: real, scoped ones (what the identity provider would issue) and forged or broken ones (what an
// attacker would try). The identity provider, `npm run token`, `npm run zoo` and every test use this one file.
// It holds the throwaway DEV private key. In production the private key lives in a vault (Azure Key Vault) and only the
// identity provider can sign with it. Do not edit: the lab's fixtures.
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const keyFile = name => new URL(`../../keys/${name}`, import.meta.url);

export const PRIVATE_KEY = readFileSync(keyFile('jwt-private.pem'), 'utf8');
export const PUBLIC_KEY = readFileSync(keyFile('jwt-public.pem'), 'utf8');
export const ISSUER = 'https://auth.internal.bank/';
export const AUDIENCE = 'agent-tools';

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Signs exactly the claims you give it. No iat, no exp unless you put them in. */
export function signToken(claims, { key = PRIVATE_KEY, algorithm = 'RS256', keyid = 'dev-1' } = {}) {
  return jwt.sign(claims, key, { algorithm, keyid });
}

/** The claims of a scoped agent token. `sub` is the end user the agent is acting for; `act.sub` is the agent itself. */
export function scopedClaims({ sub, client = 'account-agent', actions, ttl = 900, maxAmount = 5000, extra = {} }) {
  const iat = nowSeconds();
  return {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: sub ?? `client:${client}`,
    ...(sub ? { act: { sub: `client:${client}` } } : {}),
    client_id: client,
    allowed_actions: actions,
    max_amount: maxAmount,
    token_use: 'access',
    jti: randomUUID(),
    iat,
    exp: iat + ttl,
    ...extra,
  };
}

export const mintScoped = options => signToken(scopedClaims(options));

let strangerKey;
const stranger = () => (strangerKey ??= generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
}));

export const FORGERY_KINDS = [
  'wrong-key', 'expired', 'no-exp', 'wrong-aud', 'wrong-iss', 'alg-none', 'hs256-public-key',
  'not-yet-valid', 'empty-actions', 'other-action', 'no-actions-claim', 'string-claim', 'id-token', 'garbage',
];

/**
 * A broken or forged token for `action`, otherwise a perfectly good scoped token for user_ana.
 * wrong-key         signed by a different RSA key (an attacker's own)
 * expired           exp one minute ago
 * no-exp            no exp claim at all: valid for ever if nobody checks
 * wrong-aud/iss     meant for another service, or issued by another issuer
 * alg-none          unsigned, with "alg": "none"
 * hs256-public-key  signed with HMAC, using the PUBLIC key text as the secret (the classic algorithm-confusion trick)
 * not-yet-valid     nbf in the future
 * empty-actions     allowed_actions is []
 * other-action      allowed_actions holds a different tool
 * no-actions-claim  no allowed_actions claim (like the old broad token)
 * string-claim      allowed_actions is a STRING that merely contains the action's name
 * id-token          an ID token (who the user is), not an access token
 * garbage           not a JWT at all
 */
export function forge(kind, action = 'freeze_card', sub = 'user_ana') {
  const good = scopedClaims({ sub, actions: [action] });
  switch (kind) {
    case 'wrong-key': return signToken(good, { key: stranger().privateKey });
    case 'expired': return signToken({ ...good, iat: good.iat - 3600, exp: nowSeconds() - 60 });
    case 'no-exp': { const { exp, ...rest } = good; return signToken(rest); }
    case 'wrong-aud': return signToken({ ...good, aud: 'some-other-service' });
    case 'wrong-iss': return signToken({ ...good, iss: 'https://evil.example/' });
    case 'alg-none': return jwt.sign(good, '', { algorithm: 'none' });
    case 'hs256-public-key': return jwt.sign(good, PUBLIC_KEY, { algorithm: 'HS256' });
    case 'not-yet-valid': return signToken({ ...good, nbf: nowSeconds() + 3600 });
    case 'empty-actions': return signToken({ ...good, allowed_actions: [] });
    case 'other-action': return signToken({ ...good, allowed_actions: [action === 'get_balance' ? 'flag_transaction' : 'get_balance'] });
    case 'no-actions-claim': { const { allowed_actions, ...rest } = good; return signToken(rest); }
    case 'string-claim': return signToken({ ...good, allowed_actions: `${action}_and_everything_else` });
    case 'id-token': return signToken({ ...good, aud: 'account-agent', token_use: 'id', allowed_actions: undefined });
    case 'garbage': return 'this.is.not-a-jwt';
    default: throw new Error(`Unknown forgery "${kind}". Use one of: ${FORGERY_KINDS.join(', ')}`);
  }
}

/** A short fingerprint for logs and the audit trail when you must refer to a token: never log the token itself. */
export const fingerprint = token => createHash('sha256').update(String(token)).digest('hex').slice(0, 12);

// requireScope(action): the gate in front of a tool endpoint. It lets a request through only if the bearer token is a real
// access token for this service AND is allowed to call this action. Every refusal goes into the audit trail.
import jwt from 'jsonwebtoken';
import { audit } from '../lib/audit.js';

const ISSUER = 'https://auth.internal.bank/';
const AUDIENCE = 'agent-tools';

export function requireScope(action) {
  return (req, res, next) => {
    // Who, what, with which scope. Never the token itself, never customer data.
    const refuse = (status, error, claims) => {
      audit({
        event: 'tool_call',
        action,
        outcome: 'denied',
        reason: error,
        sub: claims?.sub ?? null,
        actor: claims?.act?.sub ?? null,
        allowedActions: Array.isArray(claims?.allowed_actions) ? claims.allowed_actions : [],
        accountId: typeof req.body?.accountId === 'string' ? req.body.accountId.slice(0, 64) : null,
        requestId: req.id,
      });
      return res.status(status).json({ error });
    };

    const [scheme, token, ...extra] = (req.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length) return refuse(401, 'invalid_token');

    let claims;
    try {
      claims = jwt.verify(token, process.env.JWT_PUBLIC_KEY, { algorithms: ['RS256'], audience: AUDIENCE, issuer: ISSUER });
    } catch {
      return refuse(401, 'invalid_token');
    }
    if (typeof claims.exp !== 'number') return refuse(401, 'invalid_token');
    if (!Array.isArray(claims.allowed_actions) || !claims.allowed_actions.includes(action)) return refuse(403, 'insufficient_scope', claims);

    req.tokenClaims = claims;
    next();
  };
}

// requireScope(action): the gate in front of a tool endpoint. It lets a request through only if the bearer token is a real
// access token for this service AND is allowed to call this action. Reference solution, based on the deck's helper.
import jwt from 'jsonwebtoken';

const ISSUER = 'https://auth.internal.bank/';
const AUDIENCE = 'agent-tools';

const deny = (res, status, error) => res.status(status).json({ error });

export function requireScope(action) {
  return (req, res, next) => {
    // 1. Take the token from the Authorization header, in the form "Bearer <token>". Nothing else counts.
    const [scheme, token, ...extra] = (req.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length) return deny(res, 401, 'invalid_token');

    // 2. Verify it, not just decode it. Pin the algorithm so the token cannot choose how it is checked.
    //    This checks the signature, the expiry (exp), the not-before (nbf), the audience and the issuer.
    let claims;
    try {
      claims = jwt.verify(token, process.env.JWT_PUBLIC_KEY, { algorithms: ['RS256'], audience: AUDIENCE, issuer: ISSUER });
    } catch {
      return deny(res, 401, 'invalid_token');
    }

    // 3. jsonwebtoken only checks exp when it is there. A token with no exp would be valid for ever, so require it.
    if (typeof claims.exp !== 'number') return deny(res, 401, 'invalid_token');

    // 4. The scope. allowed_actions must be an array that contains this exact action: on a string, includes() is a
    //    substring search, so "freeze_card_and_everything_else" would pass.
    if (!Array.isArray(claims.allowed_actions) || !claims.allowed_actions.includes(action)) return deny(res, 403, 'insufficient_scope');

    req.tokenClaims = claims;
    next();
  };
}

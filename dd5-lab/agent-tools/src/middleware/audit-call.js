// Records exactly one audit entry for every call to a tool, allowed or denied, once the response is finished.
// `sub`, `actor` and `allowedActions` come only from a VERIFIED token (req.verifiedClaims, set by requireScope after the
// signature, issuer, audience and expiry have checked out). A token that failed verification is never read, so its claims
// cannot put a name in the trail. The token itself and customer data never go in an entry.
import { audit } from '../lib/audit.js';

const REASONS = { 401: 'invalid_token', 403: 'insufficient_scope' };

export function auditCall(action) {
  return (req, res, next) => {
    res.once('finish', () => {
      const claims = req.verifiedClaims;
      const allowed = Boolean(req.tokenClaims) && !req.denyReason;
      const accountId = req.body?.accountId;
      audit({
        event: 'tool_call',
        action,
        outcome: allowed ? 'allowed' : 'denied',
        reason: allowed ? null : (req.denyReason ?? REASONS[res.statusCode] ?? 'denied'),
        sub: typeof claims?.sub === 'string' ? claims.sub : null,
        actor: typeof claims?.act?.sub === 'string' ? claims.act.sub : null,
        allowedActions: Array.isArray(claims?.allowed_actions) ? claims.allowed_actions : [],
        accountId: typeof accountId === 'string' ? accountId : null,
        requestId: req.id,
      });
    });
    next();
  };
}

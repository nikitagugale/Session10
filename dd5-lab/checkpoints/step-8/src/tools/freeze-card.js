// POST /tools/freeze_card   { "accountId": "acc_ana_1" }   ->   { accountId, cardStatus: "frozen" }
// Freezing a card stops it working at once. It is the most sensitive of the three tools.
//
// A valid scope says "this caller may freeze cards". It does not say "this caller may freeze THIS card". The token's sub is
// the person the agent is acting for, so the account must belong to them. An account that does not exist and an account that
// belongs to somebody else get the same answer, so the endpoint cannot be used to find out which account numbers exist.
import { audit } from '../lib/audit.js';

export function freezeCard({ store }) {
  return (req, res) => {
    const { accountId } = req.body ?? {};
    if (typeof accountId !== 'string' || !accountId) return res.status(400).json({ error: 'invalid_request', message: 'accountId is required' });

    const claims = req.tokenClaims;
    const entry = { event: 'tool_call', action: 'freeze_card', sub: claims.sub, actor: claims.act?.sub ?? null, allowedActions: claims.allowed_actions, accountId: accountId.slice(0, 64), requestId: req.id };

    const account = store.accounts.get(accountId);
    if (!account || account.ownerId !== claims.sub) {
      audit({ ...entry, outcome: 'denied', reason: account ? 'not_account_owner' : 'unknown_account' });
      return res.status(403).json({ error: 'forbidden' });
    }

    account.cardStatus = 'frozen';
    audit({ ...entry, outcome: 'allowed' });
    res.json({ accountId, cardStatus: 'frozen' });
  };
}

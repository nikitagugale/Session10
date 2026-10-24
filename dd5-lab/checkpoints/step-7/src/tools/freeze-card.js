// POST /tools/freeze_card   { "accountId": "acc_ana_1" }   ->   { accountId, cardStatus: "frozen" }
// Freezing a card stops it working at once. It is the most sensitive of the three tools.
import { audit } from '../lib/audit.js';

export function freezeCard({ store }) {
  return (req, res) => {
    const { accountId } = req.body ?? {};
    if (typeof accountId !== 'string' || !accountId) return res.status(400).json({ error: 'invalid_request', message: 'accountId is required' });
    const account = store.accounts.get(accountId);
    if (!account) return res.status(404).json({ error: 'not_found' });
    account.cardStatus = 'frozen';

    const claims = req.tokenClaims;
    audit({
      event: 'tool_call',
      action: 'freeze_card',
      outcome: 'allowed',
      sub: claims.sub,
      actor: claims.act?.sub ?? null,
      allowedActions: claims.allowed_actions,
      accountId,
      requestId: req.id,
    });
    res.json({ accountId, cardStatus: 'frozen' });
  };
}

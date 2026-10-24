// Confused-deputy guard: a correctly scoped token is not enough, the account must belong to the person the agent acts for.
// Runs after requireScope, so req.tokenClaims is verified. An unknown account and somebody else's account get the SAME
// answer, so the endpoint cannot be used to find out which account ids exist. The real reason goes only to the audit trail.
export function requireOwner({ store }) {
  return (req, res, next) => {
    const accountId = req.body?.accountId;
    if (typeof accountId !== 'string' || !accountId) return next(); // the handler answers 400
    const account = store.accounts.get(accountId);
    const sub = req.tokenClaims?.sub;
    if (account && typeof sub === 'string' && sub && account.ownerId === sub) return next();
    req.denyReason = account ? 'not_account_owner' : 'unknown_account';
    res.status(403).json({ error: 'forbidden' });
  };
}

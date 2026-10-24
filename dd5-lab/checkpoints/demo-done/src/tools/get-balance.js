// POST /tools/get_balance   { "accountId": "acc_ana_1" }   ->   { accountId, balance, currency }
export function getBalance({ store }) {
  return (req, res) => {
    const { accountId } = req.body ?? {};
    if (typeof accountId !== 'string' || !accountId) return res.status(400).json({ error: 'invalid_request', message: 'accountId is required' });
    const account = store.accounts.get(accountId);
    if (!account) return res.status(404).json({ error: 'not_found' });
    res.json({ accountId, balance: account.balance, currency: account.currency });
  };
}

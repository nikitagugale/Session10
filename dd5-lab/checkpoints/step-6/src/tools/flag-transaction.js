// POST /tools/flag_transaction   { "transactionId": "txn_9002", "reason": "unusual overseas wire" }   ->   { transactionId, flagged: true }
export function flagTransaction({ store }) {
  return (req, res) => {
    const { transactionId, reason } = req.body ?? {};
    if (typeof transactionId !== 'string' || !transactionId) return res.status(400).json({ error: 'invalid_request', message: 'transactionId is required' });
    const txn = store.transactions.get(transactionId);
    if (!txn) return res.status(404).json({ error: 'not_found' });
    txn.flagged = true;
    txn.flagReason = typeof reason === 'string' ? reason.slice(0, 200) : null;
    res.json({ transactionId, flagged: true });
  };
}

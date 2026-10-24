// The agent-tools service: the endpoints the AI agent calls to act on customer accounts.
//   POST /tools/get_balance        { accountId }
//   POST /tools/flag_transaction   { transactionId, reason }
//   POST /tools/freeze_card        { accountId }
// Keep this signature: createApp({ store, redis, config, log }) returns an Express router.
import express from 'express';
import { legacyAuth } from './middleware/legacy-auth.js';
import { auditCall } from './middleware/audit-call.js';
import { requireOwner } from './middleware/require-owner.js';
import { requireScope } from './middleware/require-scope.js';
import { flagTransaction } from './tools/flag-transaction.js';
import { freezeCard } from './tools/freeze-card.js';
import { getBalance } from './tools/get-balance.js';

export function createApp({ store, redis, config, log }) {
  const router = express.Router();
  const sharedCredential = legacyAuth(config);

  // get_balance and flag_transaction still sit behind the one shared credential; freeze_card needs a token scoped to it.
  router.post('/tools/get_balance', sharedCredential, getBalance({ store }));
  router.post('/tools/flag_transaction', sharedCredential, flagTransaction({ store }));
  router.post('/tools/freeze_card', auditCall('freeze_card'), requireScope('freeze_card'), requireOwner({ store }), freezeCard({ store }));

  return router;
}

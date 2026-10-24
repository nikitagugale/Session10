// The lab's control panel. Do not edit. It lets you (and the step checks) look inside the running service.
// Never ship anything like this: it shows every account and every entry in the audit trail with no login at all.
//
//   GET  /_lab/state    accounts, transactions, the audit trail, and everything in Redis
//   POST /_lab/reset    back to the starting data, an empty audit trail and an empty Redis
import { audit } from './lib/audit.js';

export function mountLab(app, { store, redis }) {
  app.get('/_lab/state', async (req, res) => {
    const keys = (await redis.keys('*')).sort();
    const entries = [];
    for (const key of keys) {
      const type = await redis.type(key);
      const value = type === 'string' ? await redis.get(key) : type === 'set' ? await redis.smembers(key) : null;
      entries.push({ key, type, ttl: await redis.ttl(key), value });
    }
    res.json({
      accounts: [...store.accounts.values()],
      transactions: [...store.transactions.values()],
      audit: audit.entries,
      redis: entries,
    });
  });

  app.post('/_lab/reset', async (req, res) => {
    store.reset();
    audit.reset();
    await redis.flushall();
    res.json({ ok: true });
  });
}

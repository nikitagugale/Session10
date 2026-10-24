// The audit trail. Call `audit({...})` once for every privileged action, allowed or denied.
// The entries are kept in memory and shown by `npm run state` and /_lab/state. In production this would append to a
// write-once store (for example Azure Monitor or Log Analytics) that the service itself cannot rewrite.
//
//   import { audit } from '../lib/audit.js';
//   audit({ event: 'tool_call', sub, actor, action, accountId, allowedActions, outcome, reason, requestId });
//
// It adds `ts` and `seq` for you. It does not check what you pass in: deciding what a useful entry holds is the job.
// An audit entry says who did what, with which scope. It must never hold a token, and never customer data.
const entries = [];
let seq = 0;

export function audit(entry) {
  const full = { seq: ++seq, ts: new Date().toISOString(), ...entry };
  entries.push(full);
  return full;
}
audit.entries = entries;
audit.reset = () => {
  entries.length = 0;
  seq = 0;
};

// `npm run state`: a readable snapshot of what is inside the running service. Needs `npm run dev`.
const base = process.env.API ?? 'http://127.0.0.1:4000';
let s;
try {
  s = await (await fetch(`${base}/_lab/state`)).json();
} catch {
  console.error(`Cannot reach ${base}. Start the server first: npm run dev (in another terminal).`);
  process.exit(2);
}

console.log(`accounts (${s.accounts.length})`);
for (const a of s.accounts) console.log(`  ${a.id.padEnd(13)} owner ${a.ownerId.padEnd(12)} card ${a.cardStatus}`);

const flagged = s.transactions.filter(t => t.flagged);
console.log(`\nflagged transactions (${flagged.length})`);
for (const t of flagged) console.log(`  ${t.id}  ${t.accountId}  ${t.flagReason ?? ''}`);

console.log(`\naudit trail (${s.audit.length})`);
for (const e of s.audit) {
  const { seq, ts, ...rest } = e;
  console.log(`  #${seq}  ${JSON.stringify(rest)}`);
}

console.log(`\nredis keys (${s.redis.length})`);
for (const k of s.redis) console.log(`  ${k.key}   ${k.type}   ttl ${k.ttl}s`);

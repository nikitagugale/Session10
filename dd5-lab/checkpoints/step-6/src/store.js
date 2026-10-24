// The bank's data, in memory. Fictional people and made-up numbers. Do not edit: the lab's fixtures.
// Every account has an owner (`ownerId`), which is the user the account belongs to.
const seed = () => ({
  accounts: [
    { id: 'acc_ana_1', ownerId: 'user_ana', holder: 'Ana Rao', balance: 125000, currency: 'INR', cardStatus: 'active' },
    { id: 'acc_ben_1', ownerId: 'user_ben', holder: 'Ben Thomas', balance: 8400, currency: 'INR', cardStatus: 'active' },
    { id: 'acc_chitra_1', ownerId: 'user_chitra', holder: 'Chitra Nair', balance: 56250, currency: 'INR', cardStatus: 'active' },
  ],
  transactions: [
    { id: 'txn_9001', accountId: 'acc_ana_1', amount: 2500, merchant: 'Metro Cash and Carry', flagged: false },
    { id: 'txn_9002', accountId: 'acc_ana_1', amount: 48000, merchant: 'Overseas wire', flagged: false },
    { id: 'txn_9003', accountId: 'acc_ben_1', amount: 640, merchant: 'Corner Pharmacy', flagged: false },
    { id: 'txn_9004', accountId: 'acc_chitra_1', amount: 12999, merchant: 'Electronics Mart', flagged: false },
  ],
});

function build() {
  const data = seed();
  return {
    accounts: new Map(data.accounts.map(a => [a.id, a])),
    transactions: new Map(data.transactions.map(t => [t.id, t])),
  };
}

export function createStore() {
  const store = build();
  store.reset = () => Object.assign(store, build());
  return store;
}

// Milestone 3: the schema. Checks the SHAPE of docs/token-schema.md against the card: a claim table with an example and a reason
// for each claim, a comparison table for the two jobs, and some prose on why the agent's token is narrower.
// A document check cannot judge whether the design is sensible. Reading it for sense is the checkpoint's job.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const file = new URL('../../docs/token-schema.md', import.meta.url);
const doc = existsSync(file) ? readFileSync(file, 'utf8') : '';
const lines = doc.split('\n');
const isTableRow = l => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|?\s*$/.test(l);
const rows = lines.filter(isTableRow).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
const plain = s => s.replace(/[`*]/g, '').trim();

test('docs/token-schema.md exists and has some substance', () => {
  assert.ok(existsSync(file), 'docs/token-schema.md is missing. The card says what it must contain.');
  assert.ok(doc.length > 400, 'it is too short to be a schema');
});

const claims = {
  iss: 'who issued the token',
  aud: 'who it is for',
  sub: 'the person the agent acts for',
  act: 'the agent acting on their behalf',
  allowed_actions: 'what the token may do',
  max_amount: 'a ceiling inside the scope',
  exp: 'when it expires',
};
const rowFor = claim => rows.find(r => new RegExp(`^${claim}(?![A-Za-z_])`).test(plain(r[0] ?? '')));

for (const [claim, meaning] of Object.entries(claims)) {
  test(`the claim table has a row for ${claim} (${meaning}), with an example and a reason`, () => {
    const row = rowFor(claim);
    assert.ok(row, `there is no table row for the ${claim} claim. The card lists the claims the table must cover.`);
    assert.ok(row.length >= 3, `the ${claim} row needs three columns: the claim, an example value, and why it is there`);
    assert.ok(plain(row[1]).length > 0 && plain(row[1]) !== '?', `the ${claim} row has no example value`);
    assert.ok(plain(row[row.length - 1]).split(/\s+/).length >= 4, `the ${claim} row has no real reason (one line on why the claim exists)`);
  });
}

test('allowed_actions is shown as a list, and max_amount as a number', () => {
  const a = rowFor('allowed_actions');
  const m = rowFor('max_amount');
  assert.ok(a && /\[/.test(a[1] ?? ''), 'the example for allowed_actions should look like a list (the card says it is an array of tool names)');
  assert.ok(m && /\d/.test(m[1] ?? ''), 'the example for max_amount should be a number (the card says it is a number)');
});

test('the token carries an absolute expiry, not a duration claim', () => {
  const ttl = rows.find(r => /^ttl\b/i.test(plain(r[0] ?? '')));
  assert.ok(!ttl, 'there is a claim called ttl. What does a token carry: how long it lives, or the moment it stops working? Check the card for the registered name.');
});

test('the comparison table covers both jobs: freeze_card against card_ops, flag_transaction against fraud_analyst', () => {
  const has = (...words) => rows.some(r => words.every(w => r.join(' ').includes(w)));
  assert.ok(has('card_ops', 'freeze_card'), 'the comparison table needs a row that sets the card_ops human role against the freeze_card agent scope');
  assert.ok(has('fraud_analyst', 'flag_transaction'), 'the comparison table needs a row that sets the fraud_analyst human role against the flag_transaction agent scope');
});

test('there is prose on why the agent\'s token must be narrower than the human role', () => {
  const prose = doc.split(/\n\s*\n/).filter(p => !/^\s*[|#]/.test(p) && p.trim().split(/\s+/).length >= 12);
  assert.ok(prose.some(l => /agent/i.test(l) && /\b(human|person|people|role)/i.test(l) && /(narrow|less|fewer|smaller|strict|restrict|minimal)/i.test(l)),
    'the card asks for two or three sentences on why the agent\'s token must be narrower than the human role it replaces. Add them as plain text, not in a table.');
});

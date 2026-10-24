// Milestone 2: what the tools really need. Reads YOUR docs/findings.json (toolPermissions and unusedPermissions)
// and compares it with the token's own permission list and what the three tools actually do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';

const file = new URL('../../docs/findings.json', import.meta.url);
const tokenPermissions = jwt.decode(config.accountAgentToken).permissions;
const needed = { get_balance: 'accounts:read:*', flag_transaction: 'transactions:flag', freeze_card: 'cards:freeze' };

let findings = {};
test('docs/findings.json exists and is valid JSON', () => {
  assert.ok(existsSync(file), 'docs/findings.json is missing. Create it (Milestone 1 does the first half).');
  findings = JSON.parse(readFileSync(file, 'utf8'));
});

for (const [tool, permission] of Object.entries(needed)) {
  test(`toolPermissions.${tool}: the one permission ${tool} needs`, () => {
    const got = findings.toolPermissions?.[tool];
    assert.ok(got !== undefined && got !== '?', `toolPermissions.${tool} is still a placeholder. What does the ${tool} tool read or change?`);
    assert.ok(tokenPermissions.includes(got), `"${got}" is not in the token's own permissions list. Use the names the token uses.`);
    assert.equal(got, permission, `that is a real permission, but it is not the one ${tool} needs. Re-read what the tool does to the data.`);
  });
}

test('unusedPermissions: the permissions in the token that no tool needs', () => {
  const list = findings.unusedPermissions;
  assert.ok(Array.isArray(list) && list.length > 0 && !list.includes('?'), 'unusedPermissions must be a list of permission names (not the "?" placeholder)');
  assert.equal(new Set(list).size, list.length, 'a permission appears twice in unusedPermissions');
  for (const p of list) assert.ok(tokenPermissions.includes(p), `"${p}" is not in the token's permissions list`);
  for (const p of Object.values(needed)) assert.ok(!list.includes(p), `"${p}" is needed by a tool, so it cannot be in the unused list`);
  const unused = tokenPermissions.filter(p => !Object.values(needed).includes(p));
  assert.ok(list.length >= unused.length - 1, `you listed ${list.length}, but more of the token's permissions are unused. (One judgement call is fine, and you can explain it in your log.)`);
});

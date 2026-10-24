// Milestone 1: the facts. Reads YOUR docs/findings.json and compares five facts with what is really true of the old
// credential. It does not tell you the answers: it tells you which ones do not match, so go and look again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';

const file = new URL('../../docs/findings.json', import.meta.url);
const claims = jwt.decode(config.accountAgentToken);
const daysLeft = Math.round((claims.exp - Date.now() / 1000) / 86400);

let findings = {};
test('docs/findings.json exists and is valid JSON', () => {
  assert.ok(existsSync(file), 'docs/findings.json is missing. Create it with the five keys from the milestone card.');
  findings = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(typeof findings, 'object');
});

const still = v => v === '?' || v === undefined || v === null;

test('permissionsInToken: how many permissions the token lists', () => {
  assert.ok(!still(findings.permissionsInToken), 'permissionsInToken is still a placeholder. Decode the token and count.');
  assert.equal(typeof findings.permissionsInToken, 'number', 'permissionsInToken must be a number, not text');
  assert.equal(findings.permissionsInToken, claims.permissions.length, 'that does not match the token. Decode it and count the entries in its permissions list.');
});

test('tokenValidDays: whole days from now until the token expires', () => {
  assert.ok(!still(findings.tokenValidDays), 'tokenValidDays is still a placeholder. The decode output says when it expires.');
  assert.equal(typeof findings.tokenValidDays, 'number', 'tokenValidDays must be a number, not text');
  assert.ok(Math.abs(findings.tokenValidDays - daysLeft) <= 2, 'that is not how long the token has left. Work it out from its exp claim (two days either way is fine).');
});

test('canActOnAnyAccount: does it work on an account that is not "its own"', () => {
  assert.ok(!still(findings.canActOnAnyAccount), 'canActOnAnyAccount is still a placeholder. Try it on somebody else\'s account.');
  assert.equal(typeof findings.canActOnAnyAccount, 'boolean', 'canActOnAnyAccount must be true or false (not text)');
  assert.equal(findings.canActOnAnyAccount, true, 'that does not match what happens. Use the old token to act on an account that belongs to somebody else, and see.');
});

test('auditEntriesAfterUse: how many audit entries exist after a privileged call with it', () => {
  assert.ok(!still(findings.auditEntriesAfterUse), 'auditEntriesAfterUse is still a placeholder. Use the token, then look at what was recorded.');
  assert.equal(typeof findings.auditEntriesAfterUse, 'number', 'auditEntriesAfterUse must be a number, not text');
  assert.equal(findings.auditEntriesAfterUse, 0, 'that does not match. Make a privileged call with the old token, then count what the audit trail holds.');
});

test('canBeRevoked: is there any way to cut this token off', () => {
  assert.ok(!still(findings.canBeRevoked), 'canBeRevoked is still a placeholder. Look for a way to revoke it.');
  assert.equal(typeof findings.canBeRevoked, 'boolean', 'canBeRevoked must be true or false (not text)');
  assert.equal(findings.canBeRevoked, false, 'that does not match. Look at the identity provider\'s endpoints: is there one that revokes?');
});

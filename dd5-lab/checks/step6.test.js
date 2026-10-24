// Step 6: your tests. Three things are checked:
//   1. tests/learner/auth.scope*.test.js exists, every test passes, and the names start with "allow:" or "deny:".
//   2. src/auth/policy.js has a role table and an agent-scope table, and every agent scope is strictly narrower than each
//      human role that shares one of its actions.
//   3. YOUR tests would catch the deck's unsafe helper: on a scratch copy, the helper from slide 101 is swapped in for your
//      middleware, and at least one of your tests must fail. A test that cannot fail proves nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { advise } from '../helpers/harness.js';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const learnerDir = path.join(app, 'tests', 'learner');
const learnerFiles = existsSync(learnerDir) ? readdirSync(learnerDir).filter(f => /^auth\.scope.*\.test\.[cm]?js$/.test(f)) : [];

function runLearnerTests(cwd) {
  // A nested `node --test` inherits NODE_TEST_CONTEXT from this run and then prints no summary, so drop it.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['scripts/test.mjs', 'auth.scope'], { cwd, env, encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL' });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const num = name => Number(new RegExp(`^ℹ ${name} (\\d+)`, 'm').exec(out)?.[1] ?? NaN);
  const names = [...out.matchAll(/^\s*[✔✖] (.+?) \(\d/gm)].map(m => m[1]);
  return { out, status: r.status, tests: num('tests'), pass: num('pass'), fail: num('fail'), names };
}

test('tests/learner has an auth.scope test file', () => {
  assert.ok(learnerFiles.length > 0, 'No tests/learner/auth.scope.test.js yet. Write them there: the milestone card says what they must cover.');
});

let real;
test('your tests pass', () => {
  assert.ok(learnerFiles.length > 0, 'no auth.scope test file');
  real = runLearnerTests(app);
  assert.equal(real.fail, 0, `${real.fail} of your tests fail:\n${real.out.split('\n').filter(l => /✖|Error|!==/.test(l)).slice(0, 12).join('\n')}`);
  assert.ok(real.pass >= 10, `only ${real.pass} tests: a thorough matrix of allow and deny cases needs at least 10`);
});

test('their names start with "allow:" or "deny:", with at least 3 allow and 6 deny', () => {
  assert.ok(real, 'your tests did not run');
  const allow = real.names.filter(n => n.startsWith('allow:')).length;
  const deny = real.names.filter(n => n.startsWith('deny:')).length;
  assert.ok(allow >= 3, `only ${allow} test names start with "allow:"`);
  assert.ok(deny >= 6, `only ${deny} test names start with "deny:"`);
});

test('src/auth/policy.js: roles and agent scopes, and every agent scope is strictly narrower than a human role', async () => {
  const file = path.join(app, 'src', 'auth', 'policy.js');
  assert.ok(existsSync(file), 'src/auth/policy.js is missing. The milestone card says to put the table there.');
  const { ROLE_ACTIONS, AGENT_SCOPES } = await import(pathToFileURL(file).href);
  assert.ok(ROLE_ACTIONS && Object.keys(ROLE_ACTIONS).length >= 3, 'ROLE_ACTIONS must map at least three roles to arrays of actions');
  assert.ok(AGENT_SCOPES && Object.keys(AGENT_SCOPES).length >= 2, 'AGENT_SCOPES must map at least two agent scopes to arrays of actions');
  for (const [scope, actions] of Object.entries(AGENT_SCOPES)) {
    assert.ok(Array.isArray(actions) && actions.length > 0, `${scope} must list its actions`);
    for (const [role, roleActions] of Object.entries(ROLE_ACTIONS)) {
      if (!actions.some(a => roleActions.includes(a))) continue;
      assert.ok(actions.every(a => roleActions.includes(a)) && actions.length < roleActions.length,
        `${scope} (${actions.join(', ')}) must be strictly narrower than ${role} (${roleActions.join(', ')})`);
    }
  }
});

test('your tests would catch the deck\'s unsafe helper', () => {
  assert.ok(real, 'your tests did not run');
  const fixture = path.resolve(app, '..', 'checks', 'deck-require-scope.js');
  if (!existsSync(fixture) || !existsSync(path.join(app, 'src', 'middleware', 'require-scope.js'))) {
    return advise(false, 'could not find checks/deck-require-scope.js or src/middleware/require-scope.js, so the swap was skipped.');
  }
  const tmp = mkdtempSync(path.join(tmpdir(), 'dd5-mutant-'));
  try {
    cpSync(app, tmp, {
      recursive: true,
      filter: p => !/[\\/](node_modules|\.git|\.data|\.checkpoint-backup)([\\/]|$)/.test(p) && !p.endsWith(`${path.sep}tests${path.sep}steps`),
    });
    symlinkSync(path.join(app, 'node_modules'), path.join(tmp, 'node_modules'), 'junction');
    cpSync(fixture, path.join(tmp, 'src', 'middleware', 'require-scope.js'));
    const mutant = runLearnerTests(tmp);
    assert.ok(mutant.fail > 0 || mutant.status !== 0,
      'Your tests all still pass when the middleware is replaced by the unsafe starter helper from milestone 4, so none of them would have caught what was wrong with it. A test that cannot fail proves nothing. Run the zoo against that starter to see which tokens it wrongly lets in, then add a test for each.');
    console.log(`The deck's helper fails ${mutant.fail} of your ${mutant.tests} tests. Good: they can fail.`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

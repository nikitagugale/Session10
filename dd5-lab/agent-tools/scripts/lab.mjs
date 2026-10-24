// Lab helper. Plain Node, no dependencies, no shell syntax: runs the same on Linux, macOS and Windows.
//
//   npm run doctor                  check Node, the install, the port and the kit layout
//   npm run baseline                git-commit the starting point, so you can see exactly what changes
//   npm run step -- N               check your work for milestone N (1 to 8)
//   npm run checkpoint -- N         reset the code to the reference solution for milestone N (1 to 8)
//
// `step` copies the hidden check in, runs it, and removes it again, so `npm test` never changes under you.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MILESTONES } from './milestones.mjs';

const app = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const kit = path.resolve(app, '..');
const checksDir = path.join(kit, 'checks');
const checkpointsDir = path.join(kit, 'checkpoints');
const [, , command, arg] = process.argv;

const STEPS = {
  ...Object.fromEntries(MILESTONES.map(m => [m.n, m.check])),
  facts: 'presenter: the baseline facts the milestone-1 findings are checked against',
  demo: 'presenter: refresh-token rotation and revocation in the identity provider',
};

const say = (...a) => console.log(...a);
const fail = (msg, code = 1) => { console.error(msg); process.exit(code); };

// Node prints a stack trace and an object dump for every failed assertion. Learners need the sentence, not the trace.
// It also names the check file and, for equality assertions, prints "actual !== expected". The check file is the answer key,
// and for the milestones about finding facts the expected value IS the answer, so neither is shown.
function tidy(text, { hideValues = false } = {}) {
  const out = [];
  let skipping = false;
  for (const line of text.split('\n')) {
    if (skipping) { if (/^\s*\}\s*$/.test(line)) skipping = false; continue; }
    if (/^\s+generatedMessage:/.test(line)) { skipping = true; continue; }
    if (/^test at .*\.test\.js:\d+:\d+\s*$/.test(line)) continue;
    if (hideValues && /^\s+\S.* !== .+$/.test(line)) continue;
    if (/^\s+at .+:\d+:\d+\)?\s*$/.test(line) || /^\s+at .*\(node:/.test(line) || /^\s+at async /.test(line)) continue;
    out.push(line.replace(/^(\s*AssertionError.*) \{\s*$/, '$1'));
  }
  return out.join('\n');
}

function nodeTest(files, options) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files], { cwd: app, encoding: 'utf8' });
  process.stdout.write(tidy(r.stdout ?? '', options));
  process.stderr.write(tidy(r.stderr ?? '', options));
  return r.status ?? 1;
}

function portFree(port) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}

async function doctor() {
  let bad = 0;
  const ok = m => say(`  ok    ${m}`);
  const no = (m, fix) => { bad += 1; say(`  FAIL  ${m}\n        -> ${fix}`); };

  const [maj] = process.versions.node.split('.').map(Number);
  maj >= 20 ? ok(`Node ${process.versions.node}`) : no(`Node ${process.versions.node} is too old`, 'install Node 20 or newer');
  existsSync(path.join(app, 'node_modules', 'express')) ? ok('dependencies installed') : no('node_modules is missing', 'run `npm ci` in this folder');
  existsSync(path.join(app, 'keys', 'jwt-public.pem')) && existsSync(path.join(app, 'config', 'agent.env')) ? ok('dev keys and config/agent.env found') : no('keys/ or config/agent.env is missing', 're-extract the kit zip');
  existsSync(checksDir) && existsSync(checkpointsDir) && existsSync(path.join(kit, 'hints')) ? ok('checks/, checkpoints/ and hints/ found next to this folder') : no('checks/, checkpoints/ or hints/ not found next to agent-tools/', 're-extract the kit zip and keep the folders together');
  (await portFree(4000)) ? ok('port 4000 is free for the service') : no('port 4000 is already in use', 'stop the other process (an old `npm run dev`?)');
  const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
  git.status === 0 ? ok(git.stdout.trim()) : say('  warn  git not found: `npm run baseline` will be skipped (use the editor diff instead)');

  say(bad ? `\n${bad} problem(s) above. Fix them, then run \`npm run doctor\` again.` : '\nReady. Next: npm test, then open LAB-GUIDE.md');
  process.exit(bad ? 1 : 0);
}

function baseline() {
  const git = (...a) => spawnSync('git', ['-C', app, ...a], { encoding: 'utf8' });
  try {
    if (git('--version').status !== 0) return say('git not found: skipping. In Milestone 4, use the editor diff instead.');
    if (!existsSync(path.join(app, '.git'))) git('-c', 'init.defaultBranch=main', 'init', '-q');
    git('add', '-A');
    const r = git('-c', 'user.name=lab', '-c', 'user.email=lab@local', 'commit', '-q', '-m', 'baseline: starting point');
    say(r.status === 0 ? 'Baseline committed. `git diff` and the editor diff now show only what you change.'
                       : 'Nothing new to commit (a baseline already exists).');
  } catch (e) {
    say(`baseline skipped: ${e.message}`);
  }
}

function step(n) {
  if (!STEPS[n]) fail(`Unknown milestone "${n}". Use a number from 1 to 8.`);
  const numbered = /^\d+$/.test(n);
  say(`\n${numbered ? `MILESTONE ${n}` : `STEP ${n}`}: ${STEPS[n]}\n`);

  const file = n === 'demo' ? 'demo.test.js' : n === 'facts' ? 'facts-baseline.test.js' : `step${n}.test.js`;
  const src = path.join(checksDir, file);
  if (!existsSync(src)) fail(`Missing ${src}. Is checks/ next to agent-tools/?`);
  const destDir = path.join(app, 'tests', 'steps');
  const dest = path.join(destDir, file);
  mkdirSync(destDir, { recursive: true });
  cpSync(src, dest);
  let status;
  try { status = nodeTest([dest], { hideValues: n === '1' || n === '2' }); }
  finally { rmSync(dest, { force: true }); try { rmdirSync(destDir); } catch { /* not empty */ } }

  if (status === 0) {
    say(`\nSTEP ${n} PASSED${numbered ? `\nMilestone ${n} is done. Write it up in LAB-LOG.md, then keep an eye on the clock.` : ''}`);
  } else {
    say(`\nSTEP ${n} not passing yet. Read the first failure above: it says which success criterion is not met.`);
    if (numbered) say(`Stuck? npm run hint -- ${n} gives you the next hint. When the time box is up, npm run checkpoint -- ${n} gives you the reference code.`);
  }
  process.exit(status);
}

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? listFiles(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name))]);
}

async function checkpoint(name) {
  const dir = path.join(checkpointsDir, name === 'demo-done' ? 'demo-done' : `step-${name}`);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`No checkpoint "${name}". Use a number from 1 to 8 (demo-done is for the presenter).`);
  if (!(await portFree(4000))) fail('Something is using port 4000: the server is probably running. Stop it (Ctrl+C in the `npm run dev` terminal) and run this again.');

  const backup = path.join(app, '.checkpoint-backup', new Date().toISOString().replace(/[:.]/g, '-'));
  const apply = (from, to) => cpSync(from, to, { recursive: true, force: true });

  // src/ and docs/ are REPLACED (files the reference does not have are removed). tests/learner is saved, then overlaid.
  for (const folder of ['src', 'docs']) {
    const from = path.join(dir, folder);
    if (!existsSync(from)) continue;
    const to = path.join(app, folder);
    if (existsSync(to)) {
      mkdirSync(backup, { recursive: true });
      cpSync(to, path.join(backup, folder), { recursive: true });
      const keep = new Set(listFiles(from));
      for (const f of listFiles(to)) if (!keep.has(f)) rmSync(path.join(to, f), { force: true });
    }
    apply(from, to);
  }
  // The reference findings carry a placeholder for "days until the token expires", which depends on today's date.
  const findingsFile = path.join(app, 'docs', 'findings.json');
  if (existsSync(findingsFile)) {
    const env = existsSync(path.join(app, 'config', 'agent.env')) ? readFileSync(path.join(app, 'config', 'agent.env'), 'utf8') : '';
    const token = /ACCOUNT_AGENT_TOKEN=([^\s]+)/.exec(env)?.[1];
    if (token) {
      const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp;
      writeFileSync(findingsFile, readFileSync(findingsFile, 'utf8').replace('"__DAYS__"', String(Math.round((exp - Date.now() / 1000) / 86400))));
    }
  }
  const learnerFrom = path.join(dir, 'tests', 'learner');
  if (existsSync(learnerFrom)) {
    const learnerTo = path.join(app, 'tests', 'learner');
    if (existsSync(learnerTo)) { mkdirSync(backup, { recursive: true }); cpSync(learnerTo, path.join(backup, 'tests-learner'), { recursive: true }); }
    apply(learnerFrom, learnerTo);
  }

  say(`The code now matches the reference solution for milestone ${name}.${existsSync(backup) ? `\nYour previous work was saved in ${path.relative(app, backup)}` : ''}`);
  say('Run `npm test` to confirm, then carry on with the next milestone.');
}

switch (command) {
  case 'doctor': await doctor(); break;
  case 'baseline': baseline(); break;
  case 'step': step(String(arg)); break;
  case 'checkpoint': await checkpoint(String(arg)); break;
  default: fail('Usage: node scripts/lab.mjs <doctor | baseline | step N | checkpoint N>');
}

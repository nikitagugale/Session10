// `npm run progress` runs the check for every milestone and prints where you are, plus one line to paste in the chat.
// It reads your work and never changes it. It takes about half a minute because each check starts the service.
//   npm run progress                all eight milestones
//   npm run progress -- 4           just milestone 4 (a quick re-check)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MILESTONES } from './milestones.mjs';

const app = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const only = process.argv.slice(2).map(Number).filter(Boolean);
const list = only.length ? MILESTONES.filter(m => only.includes(m.n)) : MILESTONES;
let state = {};
try { state = JSON.parse(readFileSync(path.join(app, '.lab', 'hints.json'), 'utf8')); } catch { /* none yet */ }

console.log(`Checking ${list.length === 1 ? `milestone ${list[0].n}` : 'all the milestones'}${list.length > 1 ? ' (about half a minute)' : ''}...\n`);
const results = [];
for (const m of list) {
  const r = spawnSync(process.execPath, ['scripts/lab.mjs', 'step', String(m.n)], { cwd: app, encoding: 'utf8', timeout: 150000, killSignal: 'SIGKILL' });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const pass = /^ℹ pass (\d+)/m.exec(out)?.[1];
  const fail = /^ℹ fail (\d+)/m.exec(out)?.[1];
  results.push({ ...m, ok: r.status === 0, pass, fail, hints: state[m.n]?.used ?? 0, revealed: !!state[m.n]?.revealed });
  console.log(`  ${r.status === 0 ? '[x]' : '[ ]'}  ${m.n}  ${m.title.padEnd(40)} ${r.status === 0 ? 'done' : 'not yet'}${pass !== undefined ? `  (${pass} pass, ${fail ?? 0} fail)` : ''}  hints ${state[m.n]?.used ?? 0}${state[m.n]?.revealed ? ' +reveal' : ''}`);
}

const done = results.filter(r => r.ok).length;
const totalHints = Object.values(state).reduce((a, s) => a + (s.used ?? 0), 0);
console.log(`\n${done} of ${results.length} milestones done, ${totalHints} hints taken.`);
if (done < results.length) {
  const next = results.find(r => !r.ok);
  console.log(`Next: milestone ${next.n}. Run  npm run step -- ${next.n}  to see exactly which part is failing, or  npm run hint -- ${next.n}  for a hint.`);
}
console.log(`\nPASTE THIS IN THE CHAT:\nPULSE ${results.map(r => `M${r.n}${r.ok ? '[x]' : '[ ]'}`).join(' ')} hints=${totalHints}`);
process.exitCode = done === results.length ? 0 : 1;

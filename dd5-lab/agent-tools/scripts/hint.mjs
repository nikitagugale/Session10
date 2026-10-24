// `npm run hint -- N` gives you the next hint for milestone N, one level at a time.
//   npm run hint                    which milestones you have taken hints for
//   npm run hint -- 4               the next hint for milestone 4 (there are three, then the reveal)
//   npm run hint -- 4 --again       read the hints you have already taken, without taking a new one
//   npm run hint -- 4 --reveal      the reference brief, the approach and the common mistakes (the facilitator unlocks this at the checkpoint)
//
// How to use them: try for a few minutes first. The facilitator announces when each hint "unlocks", but nothing stops you taking one
// sooner. If you do, write it in LAB-LOG.md. Your usage is saved in .lab/hints.json so `npm run progress` can show it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MILESTONES, titleOf } from './milestones.mjs';

const app = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const hintsDir = path.join(path.resolve(app, '..'), 'hints');
const stateFile = path.join(app, '.lab', 'hints.json');
const args = process.argv.slice(2);
const n = Number(args.find(a => /^\d+$/.test(a)));
const flag = args.find(a => a.startsWith('--'));

const readState = () => { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return {}; } };
const writeState = s => { mkdirSync(path.dirname(stateFile), { recursive: true }); writeFileSync(stateFile, JSON.stringify(s, null, 2)); };
const wrap = (text, width = 78) => String(text).split('\n').map(line => {
  if (/^\s*(```|\||-|\d+\.)/.test(line) || line.length <= width) return line;
  const out = []; let cur = '';
  for (const w of line.split(' ')) { if ((cur + ' ' + w).trim().length > width) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  out.push(cur);
  return out.join('\n');
}).join('\n');
const rule = '-'.repeat(78);

if (!n) {
  const state = readState();
  console.log('Hints used so far:\n');
  for (const m of MILESTONES) {
    const s = state[m.n] ?? { used: 0, revealed: false };
    console.log(`  ${m.n}  ${m.title.padEnd(40)} ${s.used} of 3 hints${s.revealed ? ', reveal read' : ''}`);
  }
  console.log('\nTake the next hint for a milestone with:  npm run hint -- <number>');
  process.exit(0);
}

const file = path.join(hintsDir, `step-${n}.json`);
if (!existsSync(file)) {
  console.error(`No hints for milestone "${n}". Use a number from 1 to 8. (Is the hints/ folder next to agent-tools/?)`);
  process.exit(1);
}
const data = JSON.parse(readFileSync(file, 'utf8'));
const state = readState();
const s = state[n] ?? { used: 0, revealed: false, log: [] };
const head = `Milestone ${n} · ${titleOf(n)}`;

if (flag === '--reveal') {
  console.log(`${head}\nREFERENCE SOLUTION\n${rule}`);
  console.log('The facilitator reveals this at the checkpoint. If you are reading it earlier, say so in LAB-LOG.md: that is fine, it is honest.\n');
  console.log('THE REFERENCE BRIEF (a good prompt for Claude Code, or a good set of requirements for yourself)\n');
  console.log(wrap(data.reveal.referenceBrief));
  console.log('\nTHE APPROACH\n');
  console.log(wrap(data.reveal.approach));
  console.log('\nCOMMON MISTAKES\n');
  for (const m of data.reveal.commonMistakes) console.log(wrap(`- ${m}`));
  console.log(`\n${rule}\nAfter reading it: close the gap in your own work, or run  npm run checkpoint -- ${n}  to get the reference code.`);
  s.revealed = true;
  s.log = [...(s.log ?? []), { what: 'reveal', at: new Date().toISOString() }];
  state[n] = s;
  writeState(state);
  process.exit(0);
}

const taken = flag === '--again' ? s.used : Math.min(s.used + 1, data.levels.length);
if (flag === '--again') {
  if (!s.used) { console.log(`You have not taken any hints for milestone ${n} yet. Run:  npm run hint -- ${n}`); process.exit(0); }
} else if (s.used >= data.levels.length) {
  console.log(`${head}\nYou have taken all ${data.levels.length} hints. The next step is the reveal, which the facilitator unlocks at the checkpoint (${data.schedule?.checkpointAfterMinutes ?? '?'} minutes in).\nRead your hints again with:  npm run hint -- ${n} --again\nOr, if you have run out of road:  npm run hint -- ${n} --reveal`);
  process.exit(0);
} else {
  s.used = taken;
  s.log = [...(s.log ?? []), { what: `hint ${taken}`, at: new Date().toISOString() }];
  state[n] = s;
  writeState(state);
}

const from = flag === '--again' ? 1 : taken;
for (let i = from; i <= taken; i++) {
  const lvl = data.levels[i - 1];
  console.log(`${head}\nHint ${i} of ${data.levels.length} · ${lvl.label}\n${rule}\n${wrap(lvl.text)}\n${rule}`);
}
if (flag !== '--again') {
  console.log(taken < data.levels.length
    ? `Try again for a few minutes before taking the next one. Note this hint in LAB-LOG.md.`
    : `That was the last hint. Next comes the reveal (npm run hint -- ${n} --reveal), which the facilitator unlocks at the checkpoint.`);
}

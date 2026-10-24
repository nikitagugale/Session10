// `npm run help`: every command in this kit, in one screen. The participant handbook explains each of them in depth.
const sections = [
  ['Run and look', [
    ['npm run dev', 'Start the service on http://127.0.0.1:4000. Ctrl+C stops it. Restart it after you change code.'],
    ['npm test', 'Run the baseline tests and your own tests (tests/learner/). Add a word to run only matching files: npm test -- auth.scope'],
    ['npm run state', 'Show the accounts, the audit trail and what is in Redis (needs the service running).'],
  ]],
  ['Tokens', [
    ['npm run -s token -- freeze_card --user user_ana', 'Print a scoped token for one tool, acting for a user. Add --forge expired (and others) for a broken one, or use "broad" for the old credential.'],
    ['npm run -s decode -- <token>', 'Show what is inside a token. Use --env to decode the old credential in config/agent.env.'],
    ['npm run zoo', 'Send 17 different tokens to freeze_card and show what the service did. With --middleware <file> it tests one middleware on its own, no server needed.'],
    ['npm run attack', 'The confused-deputy test: Ana\'s agent, tricked into freezing Ben\'s card (needs the service running).'],
  ]],
  ['The lab', [
    ['npm run step -- N', 'Check milestone N (1 to 8). It tells you which success criteria are not met yet.'],
    ['npm run progress', 'Check every milestone and print one line to paste in the chat.'],
    ['npm run hint -- N', 'Take the next hint for milestone N. There are three, then --reveal for the reference solution.'],
    ['npm run checkpoint -- N', 'Replace your code with the reference solution for milestone N, so the next milestone starts from known-good code. Your work is saved in .checkpoint-backup/.'],
    ['npm run baseline', 'Commit the starting point with git, so git diff shows only what you change.'],
    ['npm run doctor', 'Check Node, the install, the keys, the port and the kit layout.'],
    ['npm run help', 'This screen.'],
  ]],
];

console.log('DD5 lab commands\n');
for (const [title, rows] of sections) {
  console.log(title.toUpperCase());
  for (const [cmd, what] of rows) console.log(`  ${cmd}\n      ${what}`);
  console.log('');
}
console.log('Your guide is LAB-GUIDE.md. Your evidence log is LAB-LOG.md. If a command is a mystery, the handbook has a page on it.');

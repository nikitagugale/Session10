// The eight milestones, in one place: the lab runner, `npm run hint`, `npm run progress` and `npm run help` all read this.
export const MILESTONES = [
  { n: 1, title: 'Find the over-broad credential', check: 'the facts about the credential, in docs/findings.json' },
  { n: 2, title: 'Work out what the tools really need', check: 'the permission each tool needs, and the ones nothing uses' },
  { n: 3, title: 'Design the scoped token', check: 'docs/token-schema.md names the claims a scoped agent token carries' },
  { n: 4, title: 'Validate the token properly', check: 'requireScope rejects every bad token and accepts a good one' },
  { n: 5, title: 'Protect freeze_card', check: 'only a token scoped to freeze_card gets in; the old token gets a 403' },
  { n: 6, title: 'Prove it with tests', check: 'allow and deny tests that pass, and that would catch the deck\'s unsafe helper' },
  { n: 7, title: 'Leave an audit trail', check: 'who, what and which scope for every privileged call, and never a token' },
  { n: 8, title: 'Close the confused-deputy hole', check: 'a valid scope is not enough: the account has to belong to the caller' },
];

export const titleOf = n => MILESTONES.find(m => m.n === Number(n))?.title ?? `Milestone ${n}`;

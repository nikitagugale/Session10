# DD5 Lab Guide: securing an AI agent's tools

A bank's AI agent calls three tools (read a balance, flag a transaction, freeze a card) with one shared, ten-year token.
Over eight milestones you will find out exactly how bad that is, replace it with something safe, and prove the fix.

**There are no prompts to paste in this lab.** Each milestone is a ticket: a goal, requirements and success criteria. You decide how
to get there, with Claude Code (writing your own brief), by hand, or both. When the time box ends we stop, compare approaches, and the
facilitator shows a reference solution and the reference brief.

---

## How a milestone runs

| Stage | What happens |
|---|---|
| **Launch** | The facilitator reads the card aloud. Read it yourself too: the success criteria are your acceptance criteria. |
| **Work** | You work. Start with the questions under "Where to start", not with the keyboard. |
| **Hints** | Hints unlock at fixed times (shown on each card). Take them with `npm run hint -- N`. One at a time, each a little more help than the last. Nothing stops you taking one early; if you do, write it in your log. |
| **Pulse** | A minute before the checkpoint the facilitator asks for a pulse in the chat. Run `npm run progress` and paste its last line. |
| **Checkpoint** | We stop. You see the reference approach and the reference brief (the "correct prompt"), and we compare it with what you wrote. |
| **Sync** | Not there yet? Run `npm run checkpoint -- N`. You get the reference code, your own work is saved in `.checkpoint-backup/`, and the next milestone starts from known-good code. Nobody is blocked by a step they missed. |
| **Log** | Two lines in `LAB-LOG.md`: what you tried, and what you learned. |

## Ground rules

1. **Read the card before you open Claude.** Know what "done" looks like first.
2. **Write your own brief.** The success criteria on the card are your acceptance criteria. A good brief says the context, the task, the constraints, how you will know it worked, and how to check (see the template at the end).
3. **Review every change.** Read the diff. Run the check. Claude is quick, and it is also confident when it is wrong.
4. **Understand each fix well enough to explain it.** Several milestones ask for one sentence on why something was wrong.
5. **Hints are free once they unlock.** Taking one early is allowed. Taking one without trying first is how you miss the learning.
6. **Every key in this kit is a throwaway.** Never paste a real token, password or key into the chat or into Claude, here or at work.

## Your commands

`npm run help` lists everything. The ones you will use all the time:

| Command | What it does |
|---|---|
| `npm run dev` | Start the service (Ctrl+C stops it; restart it after every code change) |
| `npm test` | Run the baseline tests and your own tests |
| `npm run step -- N` | Check milestone N against its success criteria |
| `npm run progress` | Check every milestone and print one line to paste in the chat |
| `npm run hint -- N` | The next hint for milestone N |
| `npm run checkpoint -- N` | Get the reference code for milestone N (your work is saved first) |
| `npm run -s decode -- <token>` | See what is inside a token |
| `npm run -s token -- <tool> --user <id>` | Print a token to use with curl (`--forge <kind>` makes a broken one, `broad` is the old credential, `--help` lists the kinds) |
| `npm run zoo` | Throw 17 good and bad tokens at `freeze_card` (`-- --middleware <file>` tests one middleware file on its own, no server needed) |
| `npm run attack` | The confused-deputy test |
| `npm run state` | Accounts, the audit trail and Redis |

## What is yours to change, and what is not

Yours: `src/app.js`, `src/tools/`, `src/middleware/`, `src/auth/`, `docs/`, `tests/learner/`, `LAB-LOG.md`.
Not yours (the lab's fixtures): `src/config.js`, `src/server.js`, `src/lab.js`, `src/store.js`, `src/lib/`, `src/idp/` (except in the demo), `keys/`, `config/`, `scripts/`, `tests/baseline/`, `tests/helpers/`.

---

## Milestone 1 · Find the over-broad credential

**Ticket SEC-101** · deck slide 98 · ⏱ **8 minutes** · hints unlock at **+3, +4, +5** · checkpoint at **+6**

**Why this matters.** A security review flagged the account agent's credential. It lives in a variable called `ACCOUNT_AGENT_TOKEN`, which sounds modest. Before anything is fixed, we establish what it can really do.

**Your goal.** Establish five facts about the old credential from evidence you gathered yourself, and record them.

**You are given.** The service source in `src/` (reading it is fair game), the service itself (start it yourself with `npm run dev` in a second terminal; Claude Code is told not to start one on port 4000, so if you ask it to call the API, tell it the service is already running at `http://127.0.0.1:4000`), the credential in `config/agent.env`, the decode and token commands, `npm run state`, curl, and three accounts: `acc_ana_1` (owner `user_ana`), `acc_ben_1` (`user_ben`) and `acc_chitra_1` (`user_chitra`).

**Interface contract.** Create `docs/findings.json` with these keys, replacing every `"?"` with what you found:

```json
{
  "permissionsInToken": "?",
  "tokenValidDays": "?",
  "canActOnAnyAccount": "?",
  "auditEntriesAfterUse": "?",
  "canBeRevoked": "?"
}
```

| Key | Type | Meaning |
|---|---|---|
| `permissionsInToken` | number | How many entries the token's `permissions` list has |
| `tokenValidDays` | number | Whole days from now until the token expires (two either way is fine) |
| `canActOnAnyAccount` | true or false | Does it work on an account that is not "its own"? |
| `auditEntriesAfterUse` | number | After you use it for a privileged call on the running service, how many entries does `npm run state` show in the audit trail? |
| `canBeRevoked` | true or false | Is there any way to cut this token off? |

**Success criteria.**
- **Must:** ☐ all five values are filled in, and each one comes from something you ran  ☐ `npm run step -- 1` passes  ☐ your log names the command that gave you each fact
- **Stretch:** ☐ find a sixth problem and write it in your log  ☐ say in one sentence why a variable's *name* tells you nothing

**Where to start.** Settle these before you type:
- How would you find out what is inside a token, without trusting what it is called?
- How would you test whether a credential works on somebody else's account?
- Where would you look to see whether anything was recorded?
- How would you find out whether there is a way to revoke it? (Proving something is *missing* is harder than finding something that is there: where would you look, in the code and in the service's endpoints?)

**Verify yourself.** `npm run step -- 1`

---

## Milestone 2 · Work out what the tools really need

**Ticket SEC-102** · deck slide 99 · ⏱ **6 minutes** · hints unlock at **+2, +3, +4** · checkpoint at **+4**

**Why this matters.** You cannot cut a credential down until you know how little the job needs.

**Your goal.** For each tool, name the one permission it really needs, and list every permission in the token that no tool needs.

**You are given.** The three tools in `src/tools/`, and the token's own `permissions` list (decode it). Those names are your vocabulary.

**Interface contract.** Add two keys to the same `docs/findings.json`, keeping the milestone 1 keys:

```json
{
  "toolPermissions": { "get_balance": "?", "flag_transaction": "?", "freeze_card": "?" },
  "unusedPermissions": ["?"]
}
```

Every permission name must come from the token's own list.

**Success criteria.**
- **Must:** ☐ each tool maps to exactly one permission from the token's list  ☐ `unusedPermissions` lists every permission no tool needs (one judgement call is fine: explain it in your log)  ☐ `npm run step -- 2` passes
- **Stretch:** ☐ which of the three permissions you kept is still wider than its tool needs, and why?

**Where to start.**
- For each file in `src/tools/`: what does it read, and what does it change?
- Does any tool touch customer details, balances beyond the one it reads, or other cards?

**Verify yourself.** `npm run step -- 2`

---

## Milestone 3 · Design the scoped token

**Ticket SEC-103** · deck slide 100 · ⏱ **12 minutes** · hints unlock at **+3, +5, +7** · checkpoint at **+8**

**Why this matters.** The identity team will not build anything until the token is designed. The service will only ever see the token, so everything it needs to decide has to be inside it.

**Your goal.** Design a scoped token for the account agent that is narrower than any human role on the team, and write the design down.

**You are given.** Your findings from milestones 1 and 2, the three tools in `src/tools/`, and RFC 8693 (token exchange) for where the `act` claim comes from. The identity provider in `src/idp/` already mints tokens: look at what it issues only *after* you have written your own design, and compare.

**Requirements.** From the token alone, with no help from the request body, the service must be able to tell: who issued it, who it is meant for, which person the agent is acting for, which agent is acting, which actions it may call, the most it may move, and when it stops working.

**Interface contract.** Write `docs/token-schema.md`. The check looks at its *shape* (it cannot judge sense: the checkpoint does that). It must name these claims, as rows of a table: the registered names `iss`, `aud`, `sub` and `exp`; `act` for the agent acting on someone's behalf (the idea from RFC 8693, token exchange); and two custom claims, `allowed_actions` (an array of tool names, one per token) and `max_amount` (a number). It must contain:
- a table of the claims, with an example value and one line on why each exists;
- a comparison table for `freeze_card` (human role `card_ops` can `get_balance` and `freeze_card`) and `flag_transaction` (`fraud_analyst` can `get_balance` and `flag_transaction`) showing what the agent's token gets instead;
- two or three sentences on why the agent's token must be narrower than the human role it replaces.

Do not change any code in this milestone.

**Success criteria.**
- **Must:** ☐ every claim above is named and explained  ☐ the comparison table is there  ☐ `npm run step -- 3` passes
- **Stretch:** ☐ say where `max_amount` would be enforced, given that none of the three tools moves money  ☐ name the one claim whose absence would make a token dangerous  ☐ compare your schema with what `npm run -s token -- freeze_card --user user_ana` issues, and say what differs and why

**Where to start.**
- Who should decide how long the token lives: the caller, or the identity provider? Why?
- If the person's identity came from the request body, what would stop an attacker typing someone else's?
- What can a human do before acting that an agent calling a tool cannot?

**Verify yourself.** `npm run step -- 3`

---

## Milestone 4 · Validate the token properly

**Ticket SEC-104** · deck slide 101 · ⏱ **19 minutes** · hints unlock at **+5, +8, +11** · checkpoint at **+14**

**Why this matters.** Everything after this depends on one function that decides whether a token can be trusted. If it is wrong, every scope and every audit entry after it is meaningless.

**Your goal.** Make `requireScope(action)` reject every bad token and accept a good one.

**You are given.** A **starter**: `src/middleware/require-scope.js` already contains the helper from the course deck, exactly as printed. It looks finished. It is not wired into any route yet. Your job is to find out what is wrong with it, and fix it.

**Interface contract.**
- Keep the file `src/middleware/require-scope.js` and the export `requireScope(action)`.
- Read the public key from `process.env.JWT_PUBLIC_KEY`. The issuer is `https://auth.internal.bank/` and the audience is `agent-tools`.
- A missing, malformed or invalid token is a `401` with body `{"error":"invalid_token"}`. A valid token that is not allowed this action is a `403` with `{"error":"insufficient_scope"}`.
- On success, put the verified claims on `req.tokenClaims` and call `next()`.
- Do not wire it into a route yet (milestone 5 does that).

**Success criteria.**
- **Must:** ☐ `npm run zoo -- --middleware src/middleware/require-scope.js` ends with "Every answer is what a hardened endpoint gives"  ☐ `npm run step -- 4` passes  ☐ `npm test` is still green  ☐ your log explains, in one sentence each, *why* every problem you fixed was exploitable
- **Stretch:** ☐ the zoo shows only some of the starter's problems. Find another one, and say in your log whether you could actually exploit it (a flaw you cannot exploit is a cleanup, not a vulnerability)  ☐ list one thing the middleware still does not do that a production one would

**Where to start.**
- Run the zoo against the starter first. Read the rows marked `<-- not yet`.
- For every wrong row, answer: what exactly does the library, or JavaScript, do with that input?
- Before you let Claude touch the code, ask it to *list what is wrong* with the starter, and check its list against the zoo. A review finds more than a test run does: for each finding, ask whether you can prove it is exploitable.
- After every change, run the zoo again. A stricter rule can quietly change an answer the contract fixes (look at the status of the old credential's row).

**Verify yourself.** `npm run zoo -- --middleware src/middleware/require-scope.js`, then `npm run step -- 4`

---

## Milestone 5 · Protect freeze_card

**Ticket SEC-105** · deck slide 102 · ⏱ **10 minutes** · hints unlock at **+3, +4, +5** · checkpoint at **+6**

**Why this matters.** A correct gate that nothing uses protects nothing.

**Your goal.** Make `POST /tools/freeze_card` accept only a token scoped to `freeze_card`. The old broad token must now be refused.

**You are given.** Your `requireScope` from milestone 4, and the running service. The old token is printed by `npm run -s token -- broad`.

**Interface contract.**
- Change only the `freeze_card` route. `get_balance` and `flag_transaction` keep working with the old shared credential for now (hardening them is the homework).
- The freeze_card handler itself stays as it is.

**Success criteria.**
- **Must:** ☐ after you restart the server, `npm run zoo` ends with "Every answer is what a hardened endpoint gives"  ☐ the old broad token gets a **403** on `freeze_card`  ☐ `npm run step -- 5` passes
- **Stretch:** ☐ explain the difference between the 401s and the 403s the zoo shows

**Where to start.**
- Where are the routes defined? What stands in front of the `freeze_card` handler today?
- Remember: a change to the code does nothing until the server is restarted.

**Verify yourself.** Restart the server, then `npm run zoo` and `npm run step -- 5`.

---

## Milestone 6 · Prove it with tests

**Ticket SEC-106** · deck slide 103 · ⏱ **15 minutes** · hints unlock at **+4, +6, +8** · checkpoint at **+10**

**Why this matters.** "It works on my machine" is not evidence. Tests that can fail are.

**Your goal.** Write the role and scope table, and tests for it that would catch a regression. A test that cannot fail proves nothing, so the check also runs your tests against the unsafe starter helper from milestone 4 and expects at least one of them to fail.

**Requirements.** People have roles: `support_agent` can `get_balance`; `fraud_analyst` can `get_balance` and `flag_transaction`; `card_ops` can `get_balance` and `freeze_card`; `admin` can do all three. The agent has scopes: `card-agent` (`freeze_card` only) and `fraud-agent` (`flag_transaction` only). Every agent scope must be **strictly narrower** than each human role that shares one of its actions.

**You are given.** The harness in `tests/helpers/harness.js`: `useServer()` starts the real service for your tests and returns `api` (`api.post(path, body, headers)`, `api.get`, `api.state()`, `api.reset()`); `mintScoped({ sub, actions })` makes a good scoped token; `forge(kind)` makes a broken one (`npm run -s token -- --help` lists the kinds); `bearer(token)` makes the `Authorization` header; and `config.accountAgentToken` (from `src/config.js`) is the old broad credential.

**Interface contract.**
- Put the table in `src/auth/policy.js`, exporting `ROLE_ACTIONS` (role to an array of actions) and `AGENT_SCOPES` (agent scope to an array of actions).
- Put your tests in `tests/learner/auth.scope.test.js`, using `node:test`, `node:assert` and `useServer` from `tests/helpers/harness.js`.
- Start every test name with `allow:` or `deny:`.
- Test the real `freeze_card` endpoint, not only the table.

**Success criteria.**
- **Must:** ☐ at least 10 tests, at least 3 starting `allow:` and at least 6 starting `deny:`  ☐ they all pass (`npm test -- auth.scope`)  ☐ `npm run step -- 6` passes, including the line that says the starter helper fails some of your tests
- **Stretch:** ☐ a test that fails if somebody widens an agent scope later  ☐ a test that checks the card stayed active after a refusal

**Where to start.**
- Open `tests/baseline/service.test.js` to see how a test starts the service. `useServer()`, `mintScoped()` and `forge()` come from the harness.
- Which tokens would have caught the starter helper?
- What should each bad token get back: which status, and which body?

**Verify yourself.** `npm test -- auth.scope`, then `npm run step -- 6`

---

## Milestone 7 · Leave an audit trail

**Ticket SEC-107** · deck slide 104 · ⏱ **12 minutes** · hints unlock at **+3, +5, +7** · checkpoint at **+8**

**Why this matters.** When something goes wrong, the audit trail is the only way anyone can say what happened. And when nothing has gone wrong yet, a run of refused calls is the first sign of someone probing.

**Your goal.** Record every call to `freeze_card`, allowed or denied, including calls with a bad or missing token, exactly once.

**You are given.** `audit(entry)` in `src/lib/audit.js` (read its header comment), and `npm run state`, which shows what was recorded.

**Interface contract.** Each entry has these fields:

| Field | Value |
|---|---|
| `event` | `"tool_call"` |
| `action` | the tool name |
| `outcome` | `"allowed"` or `"denied"` |
| `reason` | on a denial, why (for example `invalid_token` or `insufficient_scope`). `null` or left out is fine on an allowed call |
| `sub` | the person the agent acts for, taken **only from a verified token**: `null` if the token failed verification or there was none. A token that verified but lacks the scope (the old broad token, or a token for another tool) is still a verified caller: record who tried |
| `actor` | the agent (`act.sub`), or `null` |
| `allowedActions` | the array from the token, or `[]` |
| `accountId` | the account in the request, or `null` if there was none |
| `requestId` | `req.id` |

Never put the token, or customer data such as a name or a balance, in an entry.

**Success criteria.**
- **Must:** ☐ one entry per call, allowed and denied  ☐ the fields above, with the right values  ☐ nothing secret in any entry  ☐ `npm run step -- 7` passes
- **Stretch:** ☐ say in your log why a bad token must give `sub: null` instead of reading the name inside it

**Where to start.**
- Which code sees every refusal? Which code sees the success?
- Where can you write the entry so you never log one call twice?
- The scope gate is the only code that has verified the token on a call it refuses. How will the entry for that refusal know who tried? (The way you share it is your design.)
- What would an investigator need at 2 a.m.?

**Verify yourself.** Restart the server, run `npm run zoo`, then `npm run state` and `npm run step -- 7`.

---

## Milestone 8 · Close the confused-deputy hole

**Ticket SEC-108** · deck slide 105 · ⏱ **19 minutes** · hints unlock at **+5, +8, +11** · checkpoint at **+14**

**Why this matters.** A valid, correctly scoped token is still not enough. This is the milestone the whole morning builds to.

**Your goal.** Run `npm run attack` first. Then close the hole it shows.

**You are given.** `npm run attack` (Ana's agent holds a perfectly valid `freeze_card` token and is tricked into asking about Ben's account), and the data: every account has an `ownerId`, and the token's `sub` is the person the agent is acting for.

**Interface contract.**
- The account must belong to the token's `sub`.
- Refuse with `403` and `{"error":"forbidden"}`. An account that does not exist must get **exactly the same response** as one that belongs to somebody else, and the body must not mention the account.
- Record the refusal as a `denied` audit entry with a reason (`not_account_owner` or `unknown_account`). A refused call leaves **exactly one** entry.
- A token whose `sub` is not a person who owns the account (for example the agent's own service identity, with no user) owns nothing: refuse it the same way.
- A missing `accountId` is still a `400`.

**Success criteria.**
- **Must:** ☐ `npm run attack` ends with "OK"  ☐ `npm run step -- 8` passes  ☐ `npm test` is still green
- **Stretch:** ☐ apply the same idea to `flag_transaction` (that is the homework)  ☐ say how this relates to the idempotency key from DD4

**Where to start.**
- Run the attack and read the answer. What did the endpoint ask? What did it forget to ask?
- Where does the decision have to live, given what each part of the code knows?
- What should a request for a missing account answer, compared with one for somebody else's account? Why?
- Your audit code from milestone 7 and this refusal must add up to one entry per call. Where does yours live?
- If a test of your own breaks after the fix, ask which is wrong, the test or the code.

**Verify yourself.** Restart the server, then `npm run attack` and `npm run step -- 8`.

What I changed: an ownership check between the scope gate and the handler. The decision lives there because that is the only place that has both the verified sub and the store.
Missing against someone else's account: both give the same 403 body, so an attacker can't tell which account ids exist. The audit trail still records the true reason.
Stretch, DD4 idempotency key: I'd answer from your DD4 notes, since I haven't seen them. In both cases the server decides from something it can verify, not from whatever the request body claims.
Homework: flag_transaction and get_balance still use the shared credential. They need the same scope check and ownership check. For flag_transaction that means looking up the transaction's account owner.
---

## Homework · Milestone 9 · Scope down flag_transaction

**Ticket SEC-109** · deck slide 108 · about an hour, in your own time

**Your goal.** Do for `POST /tools/flag_transaction` what you did for `freeze_card`.

**Interface contract.** Require a token scoped to `flag_transaction`. Flagging a transaction that belongs to an account the token's `sub` does not own is a `403 forbidden`, and so is an unknown transaction. Write allow and deny tests in `tests/learner/auth.flag.test.js`.

**Success criteria.**
- **Must:** ☐ the old broad token (`npm run -s token -- broad`) now fails against **both** hardened endpoints  ☐ allow and deny tests pass  ☐ `npm test` is green (if an earlier test of yours pinned "flag_transaction still accepts the old credential", update it: that state ends here)
- **Stretch:** ☐ audit `flag_transaction` too  ☐ do `get_balance`

---

## Appendix · How to brief an AI coding assistant

This is a template, not a prompt for any milestone. A good brief makes the result checkable.

| Part | Say |
|---|---|
| **Context** | What the code is, and what already exists. "This is an Express service; the tools are in `src/tools`." |
| **Task** | One thing to do, in one sentence. |
| **Constraints** | What it must not touch or add. "Do not change tests/baseline. No new dependencies." |
| **Acceptance** | The observable results that mean "done": statuses, bodies, file names. |
| **Verify** | The commands that prove it. "Run `npm run step -- 4` and `npm test`." |

Two habits make a big difference: ask for a **plan or a list of findings before any change**, and **read the diff** before you accept it.

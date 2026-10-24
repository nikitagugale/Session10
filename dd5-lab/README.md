# DD5 Lab Kit: Auth, Identity & App-Security Essentials
**PwC Full-Stack AI track · Sat 24 Oct 2026 · 09:00–12:00 IST**

A bank's AI agent calls three tools (read a balance, flag a transaction, freeze a card), and it does it with one shared,
ten-year token that can do far more than any of them needs. Over eight milestones you will find out how bad that is, replace it
with something safe, prove the fix, and then find the hole that a perfect scope still leaves open.

**This is a milestone lab, not a follow-along.** There are no prompts to paste. Each milestone is a ticket with a goal, an
interface contract and success criteria, in `LAB-GUIDE.md`. You decide how to get there. Hints unlock on a clock, and at each
checkpoint the facilitator shows the reference solution and the reference brief (the "correct prompt").

## Setup: at the start of the session (about 2 minutes)

Needs **Node 20 or newer** and access to the npm registry. Save `dd5-lab-kit.zip` in your home folder, then
run this in a terminal on the lab VM. It runs happily in the background while the session carries on:

```bash
cd ~
unzip -q dd5-lab-kit.zip     # or: python3 -m zipfile -e dd5-lab-kit.zip .
cd dd5-lab/agent-tools
npm ci                       # one-time install, about a minute
npm test                     # should end with: pass 20
npm run doctor               # should end with: Ready.
```

When `npm test` is green, open **only the `agent-tools` folder** in VS Code (File, Open Folder), then open `LAB-GUIDE.md`.
Do not open `dd5-lab` itself. The folders next to `agent-tools` (`hints/`, `checks/`, `checkpoints/`) hold the answers, and
Claude Code reads everything in the folder you open.

If `npm test` does not show `pass 20`, paste the last line of the error into the chat and carry on listening.
It gets fixed at the first break.

**There is nothing else to install.** No identity provider account, no Redis, no Docker, no API key: the identity provider
is a small stand-in inside the service, and Redis is an in-process stand-in with the same API. Every key in this kit is a
throwaway development key. Nothing in it is a real credential.

## What is in the folder you open (`agent-tools/`)

| Path | What it is |
|---|---|
| `LAB-GUIDE.md` | **Your milestone cards.** Read the card before you start each milestone. |
| `LAB-LOG.md` | Your evidence log. Two or three lines per milestone. |
| `docs/` | Where your written deliverables go (`findings.json`, `token-schema.md`). |
| `src/app.js`, `src/tools/`, `src/middleware/`, `src/auth/` | The code you change. `src/middleware/require-scope.js` is **starter code** for milestone 4. |
| `tests/learner/` | Your tests (milestone 6). |
| everything else | The lab's fixtures. Please leave them alone. |

## The commands

`npm run help` lists them all on one screen, and the participant handbook explains each in depth.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the service on http://127.0.0.1:4000. Ctrl+C stops it. **After you change code, stop it and start it again.** |
| `npm test` | The baseline tests plus your own in `tests/learner/`. They stay green all session. `npm test -- auth.scope` runs only the test files whose path contains that. |
| `npm run step -- N` | Checks milestone N (1 to 8) against its success criteria. It checks what a client sees, not what you named your files. |
| `npm run progress` | Checks every milestone and prints a table and one line to paste in the chat. |
| `npm run hint -- N` | The next hint for milestone N. Three hints, then `--reveal` for the reference solution (the facilitator unlocks that at the checkpoint). |
| `npm run checkpoint -- N` | Resets the code to the reference solution for milestone N. Your old work is saved in `.checkpoint-backup/`. |
| `npm run -s token -- freeze_card --user user_ana` | Prints a scoped token on its own line, ready for curl. `--forge expired` (and others) prints a broken one. `npm run -s token -- broad` prints the old shared credential. |
| `npm run -s decode -- <token>` | Shows what is inside a token. `npm run -s decode -- --env` decodes the old shared credential. |
| `npm run zoo` | Sends seventeen different tokens, good and bad, to `freeze_card` and shows what the service did. `npm run zoo -- --middleware <file>` tests one middleware on its own, with no server. |
| `npm run attack` | The confused-deputy test: a good token for Ana's agent, asked to freeze Ben's card. |
| `npm run state` | Shows the accounts, the audit trail and what is in Redis. |
| `npm run doctor` | Checks Node, the install, the keys, the port and the kit layout. |
| `npm run baseline` | Commits the starting point with git, so the diff shows only what you change. |
| `npm run help` | The command list. |

`zoo`, `attack`, `state` and `refresh-demo` talk to http://127.0.0.1:4000. To point them at another server, set `API`, for example `API=http://127.0.0.1:4011 npm run zoo`.

Use `-s` with `token` and `decode`: it stops npm printing its own header, so a token can go straight into curl:

```bash
TOKEN=$(npm run -s token -- freeze_card --user user_ana)
curl -s -X POST http://127.0.0.1:4000/tools/freeze_card -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' -d '{"accountId":"acc_ana_1"}'
```

## What is real and what stands in

| In this kit | Stands in for | Notes |
|---|---|---|
| `src/idp/` | Microsoft Entra ID (OIDC identity provider) | Discovery document, JWKS and a token endpoint with the client-credentials grant. |
| `keys/`, `config/agent.env` | Azure Key Vault | Throwaway dev keys, committed on purpose. In production the private key never leaves the vault. |
| `ioredis-mock` | Azure Cache for Redis | Same API as `ioredis`: one changed line in `src/lib/redis.js`. |
| `src/lib/audit.js` | Azure Monitor / Log Analytics | An in-memory list. A real audit store is append-only and the service cannot rewrite it. |
| `jsonwebtoken` | the same library, in production | Real verification, nothing mocked. |

## If something goes wrong

| Symptom | Fix |
|---|---|
| `unzip: command not found` | Use Python instead: `python3 -m zipfile -e dd5-lab-kit.zip .` |
| `cannot find or open dd5-lab-kit.zip` | It is probably in `~/Downloads`. `cd` there, unzip, then `cd dd5-lab/agent-tools`. |
| `Unsupported engine`, `SyntaxError` | Node is too old. `node --version` has to say 20 or newer. |
| `npm ERR! ... ETIMEDOUT` or a proxy error | The VM cannot reach the npm registry. Tell the facilitator. |
| `Port 4000 is already in use` | An old `npm run dev` is still running. Stop it with Ctrl+C. |
| `Cannot reach http://127.0.0.1:4000` from `zoo`, `attack` or `state` | Start the server first: `npm run dev` in another terminal. |
| "My change does nothing" | Restart the server: Ctrl+C, then `npm run dev`. |
| `npm run checkpoint` says something is using port 4000 | Stop the server first, then run it again. |
| `npm run hint` or `npm run doctor` says `hints/` is missing | You opened the wrong folder or moved something. Keep `agent-tools/`, `hints/`, `checks/` and `checkpoints/` side by side inside `dd5-lab/`. |

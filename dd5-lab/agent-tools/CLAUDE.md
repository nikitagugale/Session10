# agent-tools: notes for Claude Code

A small Express 5 service (plain JavaScript, ES modules, Node 20+) with the endpoints an AI agent calls to act on bank
accounts. Read this first. It is the project's context file.

## Stack, and what stands in for what
- **Express 5** for the routes. **jsonwebtoken** (already installed) for JWTs. Do not add dependencies.
- **Identity provider**: `src/idp/` is a small stand-in for Microsoft Entra ID. It issues access tokens at `POST /idp/token`.
  Change it only if the task is about the identity provider.
- **Redis** is `ioredis-mock`, the same API as `ioredis`. The client is `redis`. Never `new Redis(...)` yourself.
- **Keys**: the dev public key is in `keys/jwt-public.pem`. `src/config.js` puts it in `process.env.JWT_PUBLIC_KEY`.
  The service's current credential is `ACCOUNT_AGENT_TOKEN`, loaded from `config/agent.env`.
- To read what is inside a token: `npm run -s decode -- <token>`, or `npm run -s decode -- --env` for `ACCOUNT_AGENT_TOKEN`.
  To make test tokens: `npm run -s token -- --help`.

## How the code is organised
- `src/app.js` is where the routes live: `createApp({ store, redis, config, log })`. Keep that signature.
- Tool handlers are in `src/tools/`, middleware in `src/middleware/`, anything about roles or policy in `src/auth/`, notes and runbooks in `docs/`.
- Do **not** edit `src/config.js`, `src/server.js`, `src/lab.js`, `src/store.js`, `src/lib/*`, `keys/`, `config/`, `scripts/`,
  `tests/baseline/` or `tests/helpers/` unless the user's prompt says to. They are the lab's fixtures.

## Contracts the tests rely on (never rename)
- Routes: `POST /tools/get_balance`, `POST /tools/flag_transaction`, `POST /tools/freeze_card`. Bodies are JSON.
- Errors are `{ "error": "<code>" }`: `invalid_token` is a 401, `insufficient_scope` is a 403.
- Every request has `req.id` (also the `X-Request-Id` header). Log with `log.info(msg, { requestId: req.id, ... })`.
- Audit entries go through `audit(entry)` from `src/lib/audit.js`.
- Tokens, passwords and customer data never go in a log line or an audit entry.

## Rules for this session
- Do not run `npm run dev`. It never exits and will hang your tool call. Ask the user to start and restart the service.
- After you change code the user must restart the server (Ctrl+C, then `npm run dev`).
- If the user says the service is already running on port 4000, use that one (it is the scripts' default). Otherwise, to try the service yourself,
  start a temporary copy on a spare port in the background (`PORT=4011 node src/server.js &`), point the scripts at it
  (`API=http://127.0.0.1:4011 npm run zoo`, and the same for `attack`, `state` and `refresh-demo`), and stop it again when you are done.
  (These `VAR=value command` forms are for a Linux or macOS shell.)
- New tests go in `tests/learner/` and use `tests/helpers/harness.js`.
- Run `npm test` before you say you are done. It must stay green.
- The user is working through the milestones in `LAB-GUIDE.md`. Each milestone's **interface contract** (file paths, export names, status codes, error bodies, field names) is binding: follow it exactly, and say so if the user's request conflicts with it.
- `src/middleware/require-scope.js` starts as helper code from a course deck. It has not been reviewed.
- You may run `npm run step -- N`, `npm run zoo`, `npm run attack` and `npm run state` to check work. Do not run `npm run hint` or `npm run checkpoint`: they are the user's tools.

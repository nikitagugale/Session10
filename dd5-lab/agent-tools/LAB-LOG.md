# My lab log

Fill this in as you go: two or three lines per milestone is plenty. It is for you (and it is what you would show a colleague to say
"here is how I got there"). Nobody marks it.

| | Milestone | Done at | Hints taken | Used Claude? |
|---|---|---|---|---|
| 1 | Find the over-broad credential | | | |
| 2 | Work out what the tools really need | | | |
| 3 | Design the scoped token | | | |
| 4 | Validate the token properly | | | |
| 5 | Protect freeze_card | | | |
| 6 | Prove it with tests | | | |
| 7 | Leave an audit trail | | | |
| 8 | Close the confused-deputy hole | | | |

(`npm run progress` shows hints taken and what is done.)

---

## Milestone 1 · Find the over-broad credential
- **The command that gave me each fact:**
- **Something that surprised me:**

-npm run -s decode -- --env
he command that gave me each fact:
permissionsInToken (11): npm run -s decode -- --env showed permissions : 11 listed.
tokenValidDays (3647): the same decode showed expires : 2036-10-18 (in 3647 days).
canActOnAnyAccount (true): curl POST /tools/get_balance with the token on acc_ana_1, acc_ben_1 and acc_chitra_1 returned data for all three. freeze_card on acc_ben_1 also worked.
auditEntriesAfterUse (0): npm run state after the freeze_card call showed audit trail (0).
canBeRevoked (false): I read src/middleware/legacy-auth.js, which only compares the token string to the environment copy. The jti is static (svc-account-agent-static-key-1), and grep -rniE "revok|denylist|blocklist" src found nothing.
Something that surprised me: A token called ACCOUNT_AGENT_TOKEN carries admin and PII permissions. It is valid for about 10 years and leaves no audit trail. The service never reads the claims inside it

## Milestone 2 · Work out what the tools really need
- **My judgement call (and why):**
My judgement call (and why): flag_transaction looks up the transaction before flagging it, but it never returns the transaction's data. I counted that as part of flagging rather than needing transactions:read, so transactions:read is unused.
Mapping: get_balance needs accounts:read:*, flag_transaction needs transactions:flag, and freeze_card needs cards:freeze. The other 8 permissions are unused.
Stretch: accounts:read:* is still wider than get_balance needs. The * covers every account, but the tool reads one per call. It should be limited to the accounts the caller is allowed to read.
---------Propmt expected Given By Instructor-------------
CONTEXT: The three tools are in src/tools/*.js. The token's permissions list (from npm run -s decode -- --env) is the only vocabulary for permission names. Do not change any code.
 
TASK: For each tool, name the minimum permission it needs, choosing from the token's own permissions list. Then list every permission in the token that no tool needs.
 
OUTPUT: add two keys to docs/findings.json: toolPermissions ({ get_balance, flag_transaction, freeze_card } each mapped to one permission string) and unusedPermissions (an array of permission strings). Keep the keys from milestone 1.
 
VERIFY: npm run step -- 2
----------------------------------------------
## Milestone 3 · Design the scoped token
- **The claim I thought hardest about, and why:**
The claim I thought hardest about, and why: max_amount. No tool moves money, so I set it to 0 rather than a cap. Close second is exp: the identity provider sets it, not the caller, and it is short (5 minutes) so a stolen token is useless quickly.
Compared with the provider's token: It matches on iss, aud, sub, act, allowed_actions, iat, exp and jti. It differs on lifetime (15 minutes against my 5) and max_amount (5000 against my 0). It also adds client_id and token_use.
Most dangerous missing claim: exp, because the token would never stop working.
---------Propmt expected Given By Instructor-------------
CONTEXT: Our account agent calls bank tools with one shared credential. We want a scoped token instead. The service will only ever see the token, so everything it needs to decide must be inside it.
 
TASK: Design a scoped-token schema for the account agent. It must be narrower than any human role on the team.
 
REQUIREMENTS: The token must say who issued it (iss), who it is for (aud), which person the agent is acting for (sub), which agent is acting (act, with act.sub), which actions it may call (allowed_actions: an array of tool names, one action per token), the most it may move (max_amount, a number), and when it stops working (exp, an absolute time, not a duration).
 
FORMAT: Write docs/token-schema.md. A table of claims with an example value and one line on why each exists. Then a table comparing human roles with agent scopes for freeze_card (card_ops can get_balance and freeze_card) and flag_transaction (fraud_analyst can get_balance and flag_transaction). Say why the agent's token must be narrower than the human role it replaces. Do not change any code.
 
VERIFY: npm run step -- 3
----------------------------------------
## Milestone 4 · Validate the token properly
- **My brief to Claude (paste it or summarise it):**
- **What Claude got right, and what I had to correct:**
- **Why each problem was exploitable (one sentence each):**
String allowed_actions: an attacker whose token has "allowed_actions": "freeze_card,get_balance" passes the substring check.
No exp: a leaked token would work forever.
Unpinned algorithm: a token could ask for a weaker algorithm, such as HS256 with the public key as the secret.
Loose header parsing: .replace accepts a malformed header, so this check never reliably says what an exact match would.
Stretch, honest assessment:

Unpinned algorithm and loose header parsing: these are cleanups, not vulnerabilities. I couldn't exploit either against this library version, since the zoo's HS256 and none rows already returned 401.
Still missing for production: a jti revocation or denylist check, key rotation by kid, and a small clock-skew allowance.

---------Propmt expected Given By Instructor-------------
CONTEXT: src/middleware/require-scope.js holds a helper from a course deck. It is not wired into any route yet. Tokens are RS256 JWTs. The public key is in process.env.JWT_PUBLIC_KEY. The issuer is https://auth.internal.bank/ and the audience is agent-tools.
 
TASK: Review the helper and list everything wrong with it BEFORE you change anything. Then fix it.
 
ACCEPTANCE: It exports requireScope(action). A missing, malformed or invalid token is a 401 {"error":"invalid_token"}, whatever the reason. A valid token that is not allowed this action is a 403 {"error":"insufficient_scope"}. A token with no expiry is invalid. allowed_actions must be an array that contains the action. On success, put the verified claims on req.tokenClaims and call next(). Do not wire it into a route yet.
 
VERIFY: npm run zoo -- --middleware src/middleware/require-scope.js shows every answer as a hardened endpoint gives it; npm run step -- 4; npm test stays green.
-----------------------------------
## Milestone 5 · Protect freeze_card
- **What I changed:**
- **The difference between a 401 and a 403, in my words:**

What I changed: I wired requireScope('freeze_card') into the freeze_card route in src/app.js, replacing the shared credential on that route only.
401 against 403, in my words: 401 means "I can't tell who you are or trust your token". 403 means "I know exactly who you are, and you aren't allowed to do this".

## Milestone 6 · Prove it with tests
- **My brief to Claude:**
- **Which of my tests failed against the starter helper, and why that is good:**

What I built: a policy table and 19 allow: and deny: tests against the real endpoint. I picked the bad tokens that exercise each Milestone 4 fix, so the unsafe helper gets caught.
Check: the starter helper failed 2 of my tests, which shows they can fail.

## Milestone 7 · Leave an audit trail
- **Where I write the entry, and why there:**
- **What I decided never to log:**
Design: the audit middleware sits outside the scope gate and writes on response finish, so there is one entry per call whatever the outcome. The scope gate shares verified claims through req.verifiedClaims.
Stretch, why a bad token gives sub: null: anyone can write any name into a JWT, so reading it from an unverified token would let an attacker frame another user or hide behind a fake name in the trail.
## Milestone 8 · Close the confused-deputy hole
- **What the endpoint forgot to ask:**
- **Why a missing account and somebody else's account must answer the same:**

---

## At the end
- **Three things I will do differently in my own work:**
- **One thing I am still not sure about:**

# Scoped agent token: schema

The account agent no longer holds one shared credential. For each job it asks the identity provider for a short-lived access
token that can do exactly one thing, for exactly one person. The token is a signed JWT.

| Claim | Example | Why it is there |
|---|---|---|
| `iss` | `https://auth.internal.bank/` | Who issued it. The service only trusts its own identity provider. |
| `aud` | `agent-tools` | Who it is meant for. A token made for another service is refused here. |
| `sub` | `user_ana` | The person the agent is acting for. The service decides who owns what from this, never from the request body. |
| `act` | `{ "sub": "client:account-agent" }` | The actor: the agent doing the acting on that person's behalf. |
| `allowed_actions` | `["freeze_card"]` | The tool actions this token may call. One per token. It is an array, never a string. |
| `max_amount` | `5000` | A ceiling inside the scope, for any tool that moves money. None of today's three tools does, so nothing enforces it yet. |
| `exp` | `iat + 900` | Expiry, 15 minutes after issue. The schema says "ttl" for how long it lives; the token carries the absolute time as `exp`. A token with no `exp` is refused. |
| `iat` | 1792561627 | When it was issued. |
| `jti` | a UUID | A unique id, so one token can be traced in the audit log or revoked on its own. |

## Narrower than any human role

| Human role | Can do | Agent scope that does the same job | Can do |
|---|---|---|---|
| `card_ops` | `get_balance`, `freeze_card` | `card-agent` | `freeze_card` |
| `fraud_analyst` | `get_balance`, `flag_transaction` | `fraud-agent` | `flag_transaction` |

A person doing a job can read a balance first, notice something odd and stop. An agent calling a tool has no such moment of
judgment, so its token gets strictly less than the role it replaces, and it lives for minutes, not years.

## What the token does not do

A valid scope says the caller may use the tool. It does not say the caller may use it on **this account**. The endpoint
checks that `sub` owns the account separately (milestone 8).

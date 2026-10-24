# Scoped token for the account agent (SEC-103)

One token per tool call. The service decides from the token alone; nothing in the request body is trusted for identity or authority.

## Claims

| Claim | Example value | Why it exists |
|---|---|---|
| `iss` | `https://auth.internal.bank/` | Says who issued the token, so the service accepts only the bank's identity provider. |
| `aud` | `agent-tools` | Says which service the token is for, so a token minted for another API is useless here. |
| `sub` | `user_ana` | The customer or staff member the agent acts for. It comes from the signed token, so a caller cannot type someone else's identity into the body. |
| `act` | `{ "sub": "account-agent" }` | The agent doing the acting (RFC 8693 delegation), so the audit trail records both the person and the agent. |
| `allowed_actions` | `["freeze_card"]` | The one tool this token may call. Never a list of all three, and never a wildcard. |
| `max_amount` | `0` | The most the token may move. `0` for the current tools, since none moves money. It is there so a future money-moving tool starts with a cap. |
| `iat` | `1792561627` | When it was issued. Lets the service reject tokens from the future and age them. |
| `exp` | `iat + 300` (5 minutes) | When it stops working. The identity provider sets it, not the caller, so a caller cannot ask for a long life. |
| `jti` | `7c1e...` (random UUID) | A unique id per token, so one token can be denied or traced individually. |

## Comparison with the human roles

| Tool | Human role and what it can do | Agent token gets instead |
|---|---|---|
| `freeze_card` | `card_ops`: `get_balance` and `freeze_card`, standing, for a whole shift | `allowed_actions: ["freeze_card"]` only, `sub` = the one person, `max_amount: 0`, `exp` about 5 minutes. No `get_balance`. |
| `flag_transaction` | `fraud_analyst`: `get_balance` and `flag_transaction`, standing | `allowed_actions: ["flag_transaction"]` only, `sub` = the one person, `max_amount: 0`, `exp` about 5 minutes. No `get_balance`. |

## Why narrower than the human role

The agent's token must be narrower than the human role it replaces, because a human checks the situation, notices when something looks wrong and stops, and an agent calling a tool does none of that. An agent can also be steered by text it reads (prompt injection), so a token as wide as the role would hand the role's full power to whoever steers it. Least privilege means the agent gets one action, one person and a few minutes, which keeps the damage from a misuse to a single call.

## Stretch

- **Where `max_amount` is enforced:** None of the three tools moves money, so nothing enforces it today. It would be checked in the handler of any future money-moving tool (for example a transfer), which rejects with `insufficient_scope` when the amount is over the cap. Until then it is `0`.
- **The claim whose absence is most dangerous:** `exp`. Without it the token never stops working, which is exactly the Milestone 1 problem. A close second is `aud`, because without it a token minted for another service would be accepted here.
- **Comparison with what the identity provider issues** (`npm run -s token -- freeze_card --user user_ana`, run after the design was written):
  - **Same as my design:** `iss`, `aud`, `sub` (`user_ana`), `act` (`client:account-agent`), `allowed_actions` (`["freeze_card"]`), `iat`, `exp` and `jti`.
  - **`exp` differs:** the provider issues 900 seconds (15 minutes), and I designed for 300 seconds (5 minutes). Both are short. Mine limits the window further, and the provider's allows for clock skew and slow calls.
  - **`max_amount` differs:** the provider issues 5000, and I set 0 because no current tool moves money. 0 is tighter. 5000 is a default cap that is harmless today but would apply to any future money-moving tool.
  - **Extra claims:** the provider adds `client_id` (`account-agent`) and `token_use` (`access`). They let the service see which client asked and tell an access token from another token type, so they are worth adding to my table.

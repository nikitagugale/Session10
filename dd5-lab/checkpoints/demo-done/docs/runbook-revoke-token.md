# Runbook: revoke a suspected-compromised refresh token

**When:** a security review or an alert says a refresh token for the account-agent-service may have leaked.

1. **Get the token.** Ask the service owner for the refresh token, or find the client's most recent one in the incident ticket.
   Never paste it into chat or a ticket: share it through the vault.
2. **Revoke it.** Call the identity provider, with the client's own credentials:
   `curl -s -X POST http://127.0.0.1:4000/idp/revoke -d 'client_id=account-agent&client_secret=<secret>&refresh_token=<token>'`
   The answer is `{"revoked":true}`.
3. **Check it is dead.** Try to refresh with it. The answer must be 400 `invalid_grant`.
4. **Check the family.** If an old token was replayed, the whole token family is already revoked automatically. Confirm the
   client's current refresh token also fails.
5. **Wait out the access token.** An access token already issued still works until it expires, at most 15 minutes. If that is
   too long for this incident, rotate the signing key as well (see the key rotation runbook).
6. **Re-issue.** Have the agent service authenticate again with its client credentials to get a fresh pair.
7. **Review the audit trail** for the window since the suspected leak: who used which scope, on which accounts.
8. **Write it up.** Record when it was revoked, by whom, and what the audit trail showed.

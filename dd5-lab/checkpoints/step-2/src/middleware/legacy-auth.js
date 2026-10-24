// The credential check the service has today. The agent presents ONE shared token, and the service compares it to the copy
// in its own environment (ACCOUNT_AGENT_TOKEN). It never reads what is inside the token, and the token never changes.
export function legacyAuth(config) {
  return (req, res, next) => {
    const presented = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (presented && config.accountAgentToken && presented === config.accountAgentToken) return next();
    res.status(401).json({ error: 'invalid_token' });
  };
}

// The identity provider's registry: which clients exist, and the most each one may ever ask for.
// In production this is Microsoft Entra ID (app registrations and app roles). Here it is a plain object.
export const CLIENTS = {
  'account-agent': {
    secret: 'dev-only-secret',
    // Everything this client is ever allowed to request. A token may carry any SUBSET of these, never more.
    allowedActions: ['get_balance', 'flag_transaction', 'freeze_card'],
    maxTtlSeconds: 900, // 15 minutes
    maxAmount: 5000,
  },
};

// People the agent can act for ("on behalf of"). In production the user comes from a real sign-in, not from a parameter.
export const USERS = ['user_ana', 'user_ben', 'user_chitra'];

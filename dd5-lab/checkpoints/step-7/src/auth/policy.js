// Who may do what. People have roles. The agent has narrow scopes, and each one is strictly narrower than the human role
// that does the same job, because an agent calling a tool has no moment of human judgment before it acts.
export const ROLE_ACTIONS = {
  support_agent: ['get_balance'],
  fraud_analyst: ['get_balance', 'flag_transaction'],
  card_ops: ['get_balance', 'freeze_card'],
  admin: ['get_balance', 'flag_transaction', 'freeze_card'],
};

export const AGENT_SCOPES = {
  'card-agent': ['freeze_card'],
  'fraud-agent': ['flag_transaction'],
};

export const roleCan = (role, action) => ROLE_ACTIONS[role]?.includes(action) ?? false;
export const scopeCan = (scope, action) => AGENT_SCOPES[scope]?.includes(action) ?? false;

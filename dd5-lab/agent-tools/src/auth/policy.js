// Who may do what. Humans have roles; the agent has narrower scopes.
export const ROLE_ACTIONS = {
  support_agent: ['get_balance'],
  fraud_analyst: ['get_balance', 'flag_transaction'],
  card_ops: ['get_balance', 'freeze_card'],
  admin: ['get_balance', 'flag_transaction', 'freeze_card'],
};

// Each agent scope is one action. Every scope must stay strictly narrower than every role that shares one of its actions.
export const AGENT_SCOPES = {
  'card-agent': ['freeze_card'],
  'fraud-agent': ['flag_transaction'],
};

// Issues a scoped access token for a client, after checking the request against the client's registration.
import { mintScoped } from '../lib/dev-tokens.js';
import { CLIENTS, USERS } from './clients.js';

export class IdpError extends Error {
  constructor(status, error, description) {
    super(description ?? error);
    this.status = status;
    this.error = error;
    this.description = description;
  }
}

export function authenticateClient(clientId, clientSecret) {
  const client = CLIENTS[clientId];
  if (!client || client.secret !== clientSecret) throw new IdpError(401, 'invalid_client', 'Unknown client or wrong secret');
  return { id: clientId, ...client };
}

/** `actions` is an array of tool names, `onBehalfOf` an optional user id. Returns { token, ttl, actions }. */
export function issueAccessToken({ client, actions, onBehalfOf, ttl }) {
  if (!actions.length) throw new IdpError(400, 'invalid_scope', 'Ask for at least one action in scope');
  const outside = actions.filter(a => !client.allowedActions.includes(a));
  if (outside.length) throw new IdpError(400, 'invalid_scope', `This client may not ask for: ${outside.join(', ')}`);
  if (onBehalfOf !== undefined && !USERS.includes(onBehalfOf)) throw new IdpError(400, 'invalid_request', 'Unknown user in on_behalf_of');
  const life = Math.min(ttl ?? client.maxTtlSeconds, client.maxTtlSeconds);
  const token = mintScoped({ sub: onBehalfOf, client: client.id, actions, ttl: life, maxAmount: client.maxAmount });
  return { token, ttl: life, actions };
}

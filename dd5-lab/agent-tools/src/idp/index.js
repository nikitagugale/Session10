// The mini identity provider: a stand-in for Microsoft Entra ID.
//   GET  /idp/.well-known/openid-configuration   the discovery document: where a client finds everything else
//   GET  /idp/jwks.json                          the public key, as a JWK
//   POST /idp/token                              grant_type=client_credentials  ->  a short-lived, scoped access token
//
// Ask for ONE action per token. Add `on_behalf_of=<user>` when the agent is acting for a person: the token's `sub` is then
// that person and `act.sub` is the agent. Today the service ignores all of this and uses one static credential.
// You only change this folder in the demo (refresh tokens and revocation). Nothing else in the lab needs it.
import { createPublicKey } from 'node:crypto';
import express from 'express';
import { PUBLIC_KEY } from '../lib/dev-tokens.js';
import { CLIENTS } from './clients.js';
import { IdpError, authenticateClient, issueAccessToken } from './issue.js';

export function createIdp({ redis, config, log }) {
  const router = express.Router();
  router.use(express.urlencoded({ extended: false }));
  const base = (req, path) => `${req.protocol}://${req.get('host')}/idp${path}`;

  router.get('/.well-known/openid-configuration', (req, res) => {
    res.json({
      issuer: config.issuer,
      token_endpoint: base(req, '/token'),
      jwks_uri: base(req, '/jwks.json'),
      grant_types_supported: ['client_credentials'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      id_token_signing_alg_values_supported: ['RS256'],
      claims_supported: ['sub', 'aud', 'iss', 'exp', 'iat', 'jti', 'act', 'allowed_actions', 'max_amount'],
    });
  });

  router.get('/jwks.json', (req, res) => {
    const jwk = createPublicKey(PUBLIC_KEY).export({ format: 'jwk' });
    res.json({ keys: [{ ...jwk, kid: 'dev-1', use: 'sig', alg: 'RS256' }] });
  });

  router.post('/token', (req, res, next) => {
    try {
      const body = req.body ?? {};
      let clientId = body.client_id;
      let clientSecret = body.client_secret;
      const basic = /^Basic (.+)$/i.exec(req.headers.authorization ?? '');
      if (basic) [clientId, clientSecret] = Buffer.from(basic[1], 'base64').toString().split(':');

      if (body.grant_type !== 'client_credentials') throw new IdpError(400, 'unsupported_grant_type', 'Only client_credentials is supported');
      const client = authenticateClient(clientId, clientSecret);
      const actions = String(body.scope ?? '').split(/\s+/).filter(Boolean);
      const { token, ttl } = issueAccessToken({ client, actions, onBehalfOf: body.on_behalf_of });
      log.info('token issued', { requestId: req.id, client: client.id, actions, onBehalfOf: body.on_behalf_of ?? null });
      res.set('Cache-Control', 'no-store').json({ access_token: token, token_type: 'Bearer', expires_in: ttl, scope: actions.join(' ') });
    } catch (err) {
      if (err instanceof IdpError) return res.status(err.status).json({ error: err.error, error_description: err.description });
      next(err);
    }
  });

  return router;
}

export { CLIENTS };

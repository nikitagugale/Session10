// The mini identity provider: a stand-in for Microsoft Entra ID.
//   GET  /idp/.well-known/openid-configuration   the discovery document: where a client finds everything else
//   GET  /idp/jwks.json                          the public key, as a JWK
//   POST /idp/token                              grant_type=client_credentials  ->  access token + refresh token
//                                                grant_type=refresh_token       ->  a new access token + a NEW refresh token
//   POST /idp/revoke                             { "refresh_token": "..." }     ->  cut a refresh token off at once
//
// Ask for ONE action per token. Add `on_behalf_of=<user>` when the agent is acting for a person: the token's `sub` is then
// that person and `act.sub` is the agent.
import { createPublicKey } from 'node:crypto';
import express from 'express';
import { PUBLIC_KEY } from '../lib/dev-tokens.js';
import { CLIENTS } from './clients.js';
import { IdpError, authenticateClient, issueAccessToken } from './issue.js';
import { createRefreshStore } from './refresh.js';

export function createIdp({ redis, config, log }) {
  const router = express.Router();
  router.use(express.urlencoded({ extended: false }));
  const refreshTokens = createRefreshStore({ redis });
  const base = (req, path) => `${req.protocol}://${req.get('host')}/idp${path}`;

  const clientFrom = req => {
    const body = req.body ?? {};
    let clientId = body.client_id;
    let clientSecret = body.client_secret;
    const basic = /^Basic (.+)$/i.exec(req.headers.authorization ?? '');
    if (basic) [clientId, clientSecret] = Buffer.from(basic[1], 'base64').toString().split(':');
    return authenticateClient(clientId, clientSecret);
  };

  router.get('/.well-known/openid-configuration', (req, res) => {
    res.json({
      issuer: config.issuer,
      token_endpoint: base(req, '/token'),
      jwks_uri: base(req, '/jwks.json'),
      revocation_endpoint: base(req, '/revoke'),
      grant_types_supported: ['client_credentials', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      id_token_signing_alg_values_supported: ['RS256'],
      claims_supported: ['sub', 'aud', 'iss', 'exp', 'iat', 'jti', 'act', 'allowed_actions', 'max_amount'],
    });
  });

  router.get('/jwks.json', (req, res) => {
    const jwk = createPublicKey(PUBLIC_KEY).export({ format: 'jwk' });
    res.json({ keys: [{ ...jwk, kid: 'dev-1', use: 'sig', alg: 'RS256' }] });
  });

  router.post('/token', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const client = clientFrom(req);
      let actions;
      let onBehalfOf;
      let family;

      if (body.grant_type === 'client_credentials') {
        actions = String(body.scope ?? '').split(/\s+/).filter(Boolean);
        onBehalfOf = body.on_behalf_of;
      } else if (body.grant_type === 'refresh_token') {
        const record = body.refresh_token ? await refreshTokens.consume(body.refresh_token) : null;
        if (!record || record.clientId !== client.id) throw new IdpError(400, 'invalid_grant', 'The refresh token is invalid, used, expired or revoked');
        ({ actions, onBehalfOf, family } = record);
      } else {
        throw new IdpError(400, 'unsupported_grant_type', 'Use client_credentials or refresh_token');
      }

      const { token, ttl } = issueAccessToken({ client, actions, onBehalfOf });
      const refreshToken = await refreshTokens.issue({ clientId: client.id, actions, onBehalfOf }, family);
      log.info('token issued', { requestId: req.id, client: client.id, grant: body.grant_type, actions, onBehalfOf: onBehalfOf ?? null });
      res.set('Cache-Control', 'no-store').json({ access_token: token, refresh_token: refreshToken, token_type: 'Bearer', expires_in: ttl, scope: actions.join(' ') });
    } catch (err) {
      if (err instanceof IdpError) return res.status(err.status).json({ error: err.error, error_description: err.description });
      next(err);
    }
  });

  router.post('/revoke', async (req, res, next) => {
    try {
      clientFrom(req);
      const token = req.body?.refresh_token;
      if (typeof token !== 'string' || !token) throw new IdpError(400, 'invalid_request', 'refresh_token is required');
      await refreshTokens.revoke(token);
      log.info('refresh token revoked', { requestId: req.id });
      res.json({ revoked: true });
    } catch (err) {
      if (err instanceof IdpError) return res.status(err.status).json({ error: err.error, error_description: err.description });
      next(err);
    }
  });

  return router;
}

export { CLIENTS };

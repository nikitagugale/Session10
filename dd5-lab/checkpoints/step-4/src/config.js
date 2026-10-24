// Settings, read once. The lab's fixtures: do not edit.
// It also loads config/agent.env (the account-agent-service's credential) and the public key the service verifies tokens
// with, into process.env, because that is where real services keep them.
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);

function loadEnvFile(relative) {
  const file = new URL(relative, root);
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

loadEnvFile('config/agent.env');
// The deck's middleware reads process.env.JWT_PUBLIC_KEY. In production this comes from your identity provider's key set.
process.env.JWT_PUBLIC_KEY ??= readFileSync(new URL('keys/jwt-public.pem', root), 'utf8');

const int = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : Number(v);
};

export const config = {
  port: int('PORT', 4000),
  host: '127.0.0.1',
  issuer: 'https://auth.internal.bank/',
  audience: 'agent-tools',
  // The one credential every agent tool call presents today.
  accountAgentToken: process.env.ACCOUNT_AGENT_TOKEN ?? '',
};

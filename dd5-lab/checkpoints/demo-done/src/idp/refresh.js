// Refresh tokens with rotation and revocation, kept in Redis.
//   - Only the sha256 of a refresh token is ever stored, so a leaked database does not leak usable tokens.
//   - Every use rotates it: the old token is deleted and a new one is issued in the same family.
//   - Presenting an old, already-rotated token means it was copied, so the WHOLE family is revoked.
//   - Revoked ids live in the Redis set `revoked_refresh_tokens`, and revoked families in `revoked_refresh_families`.
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const LIFETIME_SECONDS = 7 * 24 * 3600;

export function createRefreshStore({ redis }) {
  const key = id => `refresh:${id}`;

  async function issue(record, family = randomUUID()) {
    const token = randomBytes(32).toString('base64url');
    const id = sha256(token);
    await redis.set(key(id), JSON.stringify({ ...record, family }), 'EX', LIFETIME_SECONDS);
    return token;
  }

  /** Returns the record behind a refresh token and rotates it, or null if the token is unknown, used, or revoked. */
  async function consume(token) {
    const id = sha256(String(token));
    if (await redis.sismember('revoked_refresh_tokens', id)) return null;
    const raw = await redis.get(key(id));
    if (!raw) {
      // Unknown, expired, or already rotated. If it was rotated, somebody is replaying it: revoke its family.
      const family = await redis.get(`rotated:${id}`);
      if (family) await redis.sadd('revoked_refresh_families', family);
      return null;
    }
    const record = JSON.parse(raw);
    if (await redis.sismember('revoked_refresh_families', record.family)) return null;
    await redis.del(key(id));
    await redis.set(`rotated:${id}`, record.family, 'EX', LIFETIME_SECONDS);
    return record;
  }

  /** Revokes one refresh token at once. Returns true if it existed. */
  async function revoke(token) {
    const id = sha256(String(token));
    const existed = (await redis.del(key(id))) > 0;
    await redis.sadd('revoked_refresh_tokens', id);
    return existed;
  }

  return { issue, consume, revoke };
}

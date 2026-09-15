// lib/auth/api-token.ts
// Bearer tokens for the browser extension. The extension signs in with the
// admin's username and password once (app/api/extension/session); the server
// answers with a token of its own, so the password is never stored in the
// browser and each signed-in extension can be revoked on its own.
//
// A token is 32 random bytes behind a recognisable prefix (so secret scanners
// and humans can tell what a leaked string is). Only its SHA-256 is stored: the
// token already carries 256 bits of entropy, so a slow password hash buys
// nothing, and a plain digest lets the lookup go through the unique index.

import { createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';

import { db, apiTokens, users } from '@/lib/db';

const TOKEN_PREFIX = 'reach_';

export function generateApiToken(): { token: string; tokenHash: string } {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { token, tokenHash: hashApiToken(token) };
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The token from `Authorization: Bearer <token>`, or null when absent or malformed. */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}

/** Create a token for an admin; the plaintext is returned once and never stored. */
export async function issueApiToken(userId: string, name: string): Promise<string> {
  const { token, tokenHash } = generateApiToken();
  await db.insert(apiTokens).values({ userId, name, tokenHash });
  return token;
}

export async function revokeApiToken(id: string): Promise<void> {
  await db.delete(apiTokens).where(eq(apiTokens.id, id));
}

export interface ApiPrincipal {
  tokenId: string;
  userId: string;
  username: string;
}

/**
 * Resolve the admin behind a request's bearer token and stamp the token's
 * last use. Null for a missing, malformed, unknown or revoked token.
 */
export async function authenticateApiRequest(request: Request): Promise<ApiPrincipal | null> {
  const token = readBearerToken(request);
  if (!token?.startsWith(TOKEN_PREFIX)) return null;

  const [row] = await db
    .select({ tokenId: apiTokens.id, userId: users.id, username: users.username })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.id))
    .where(eq(apiTokens.tokenHash, hashApiToken(token)))
    .limit(1);
  if (!row) return null;

  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.tokenId));
  return row;
}

// lib/auth/__tests__/api-token.test.ts
// Bearer tokens for the browser extension: format, hashing, header parsing,
// issuing (hash stored, plaintext returned) and the lookup that turns a
// request into the admin behind it.

import { describe, it, expect, beforeEach, vi } from 'vitest';

let tokenRows: Array<{ tokenId: string; userId: string; username: string }> = [];
let lookedUpHash: unknown = null;
let lastUsedUpdates: Record<string, unknown>[] = [];
let insertedTokens: Record<string, unknown>[] = [];

const apiTokens = { __table: 'api_tokens', tokenHash: 'token_hash', id: 'id', userId: 'user_id' };
const users = { __table: 'users', id: 'id', username: 'username' };

vi.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown) => {
    if (column === apiTokens.tokenHash) lookedUpHash = value;
    return { column, value };
  },
}));

vi.mock('@/lib/db', () => ({
  apiTokens,
  users,
  db: {
    select: () => {
      const query = {
        from: () => query,
        innerJoin: () => query,
        where: () => query,
        limit: () => Promise.resolve(tokenRows),
      };
      return query;
    },
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        insertedTokens.push(row);
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        lastUsedUpdates.push(patch);
        return { where: () => Promise.resolve() };
      },
    }),
  },
}));

const { generateApiToken, hashApiToken, readBearerToken, issueApiToken, authenticateApiRequest } = await import(
  '@/lib/auth/api-token'
);

function requestWith(authorization?: string) {
  return new Request('https://reach.test/api/extension/share', {
    headers: authorization ? { authorization } : {},
  });
}

describe('generateApiToken', () => {
  it('returns a prefixed 256-bit token and its SHA-256 hex digest', () => {
    const { token, tokenHash } = generateApiToken();
    expect(token).toMatch(/^reach_[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashApiToken(token));
  });

  it('never repeats', () => {
    expect(generateApiToken().token).not.toBe(generateApiToken().token);
  });
});

describe('readBearerToken', () => {
  it('reads the token from a Bearer header, scheme case-insensitive', () => {
    expect(readBearerToken(requestWith('Bearer reach_abc'))).toBe('reach_abc');
    expect(readBearerToken(requestWith('bearer reach_abc'))).toBe('reach_abc');
  });

  it('rejects missing, empty or non-Bearer credentials', () => {
    expect(readBearerToken(requestWith())).toBeNull();
    expect(readBearerToken(requestWith('Bearer '))).toBeNull();
    expect(readBearerToken(requestWith('Basic dXNlcjpwYXNz'))).toBeNull();
    expect(readBearerToken(requestWith('Bearer two parts'))).toBeNull();
  });
});

describe('issueApiToken', () => {
  beforeEach(() => {
    insertedTokens = [];
  });

  it('stores only the hash and hands the plaintext back once', async () => {
    const token = await issueApiToken('user-1', 'Chrome · Linux');
    expect(token).toMatch(/^reach_/);
    expect(insertedTokens).toEqual([{ userId: 'user-1', name: 'Chrome · Linux', tokenHash: hashApiToken(token) }]);
    expect(JSON.stringify(insertedTokens)).not.toContain(token);
  });
});

describe('authenticateApiRequest', () => {
  beforeEach(() => {
    tokenRows = [];
    lookedUpHash = null;
    lastUsedUpdates = [];
  });

  it('resolves a known token to its admin and stamps lastUsedAt', async () => {
    tokenRows = [{ tokenId: 'token-1', userId: 'user-1', username: 'admin' }];
    const { token, tokenHash } = generateApiToken();

    const principal = await authenticateApiRequest(requestWith(`Bearer ${token}`));

    expect(principal).toEqual({ tokenId: 'token-1', userId: 'user-1', username: 'admin' });
    expect(lookedUpHash).toBe(tokenHash);
    expect(lastUsedUpdates).toHaveLength(1);
    expect(lastUsedUpdates[0]!.lastUsedAt).toBeInstanceOf(Date);
  });

  it('returns null for an unknown or revoked token without touching lastUsedAt', async () => {
    const principal = await authenticateApiRequest(requestWith(`Bearer ${generateApiToken().token}`));
    expect(principal).toBeNull();
    expect(lastUsedUpdates).toHaveLength(0);
  });

  it('does not query the database for a string that is not a Reach token', async () => {
    tokenRows = [{ tokenId: 'token-1', userId: 'user-1', username: 'admin' }];
    expect(await authenticateApiRequest(requestWith('Bearer ghp_something'))).toBeNull();
    expect(lookedUpHash).toBeNull();
  });
});

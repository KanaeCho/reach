// app/api/extension/session/__tests__/route.test.ts
// /api/extension/session — the extension signs in with the admin password and
// keeps a token instead; GET checks that token, DELETE signs out.

import { describe, it, expect, beforeEach, vi } from 'vitest';

let validCredentials = true;
let principal: { tokenId: string; userId: string; username: string } | null = null;
let issued: Array<{ userId: string; name: string }> = [];
let revoked: string[] = [];

vi.mock('@/lib/auth/verify-credentials', () => ({
  verifyAdminCredentials: async (username: string, password: string) =>
    validCredentials && username === 'admin' && password === 'correct horse'
      ? { id: 'user-1', username: 'admin' }
      : null,
}));

vi.mock('@/lib/auth/api-token', () => ({
  authenticateApiRequest: async () => principal,
  issueApiToken: async (userId: string, name: string) => {
    issued.push({ userId, name });
    return 'reach_issued-token';
  },
  revokeApiToken: async (id: string) => {
    revoked.push(id);
  },
}));

const { POST, GET, DELETE, OPTIONS } = await import('@/app/api/extension/session/route');

const ENDPOINT = 'https://reach.test/api/extension/session';

function signIn(body: unknown) {
  return POST(
    new Request(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

describe('/api/extension/session', () => {
  beforeEach(() => {
    validCredentials = true;
    principal = null;
    issued = [];
    revoked = [];
  });

  it('answers the CORS preflight, DELETE included', () => {
    const response = OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toMatch(/DELETE/);
  });

  it('trades a correct password for a token named after the browser', async () => {
    const response = await signIn({ username: 'admin', password: 'correct horse', name: 'Chrome · Linux' });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(await response.json()).toEqual({ token: 'reach_issued-token', username: 'admin' });
    expect(issued).toEqual([{ userId: 'user-1', name: 'Chrome · Linux' }]);
  });

  it('refuses a wrong password without issuing anything', async () => {
    const response = await signIn({ username: 'admin', password: 'wrong', name: 'Chrome · Linux' });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: '用户名或密码错误' });
    expect(issued).toHaveLength(0);
  });

  it('rejects malformed sign-in bodies with 400', async () => {
    expect((await signIn('not json')).status).toBe(400);
    expect((await signIn({ username: 'admin', password: '', name: 'x' })).status).toBe(400);
    expect((await signIn({ username: 'admin', password: 'correct horse' })).status).toBe(400);
    expect((await signIn({ username: 'admin', password: 'correct horse', name: 'x'.repeat(61) })).status).toBe(400);
    expect(issued).toHaveLength(0);
  });

  it('GET reports the admin behind a valid token, 401 otherwise', async () => {
    const unauthenticated = await GET(new Request(ENDPOINT));
    expect(unauthenticated.status).toBe(401);

    principal = { tokenId: 'token-1', userId: 'user-1', username: 'admin' };
    const response = await GET(new Request(ENDPOINT, { headers: { authorization: 'Bearer reach_x' } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ username: 'admin' });
  });

  it('DELETE revokes exactly the token that made the request', async () => {
    const unauthenticated = await DELETE(new Request(ENDPOINT, { method: 'DELETE' }));
    expect(unauthenticated.status).toBe(401);
    expect(revoked).toHaveLength(0);

    principal = { tokenId: 'token-7', userId: 'user-1', username: 'admin' };
    const response = await DELETE(new Request(ENDPOINT, { method: 'DELETE', headers: { authorization: 'Bearer reach_x' } }));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(revoked).toEqual(['token-7']);
  });
});

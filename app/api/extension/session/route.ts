// app/api/extension/session/route.ts
// Sign-in for the browser extension.
//
//   POST   { username, password, name } → { token, username }
//   GET    (Bearer)                      → { username }   — is this sign-in still valid?
//   DELETE (Bearer)                      → 204            — sign out, revoking the token
//
// The extension trades the admin password for its own token once and keeps
// only the token (lib/auth/api-token.ts). The admin sees every signed-in
// extension under 系统 → 浏览器扩展 and can revoke any of them there.

export const runtime = 'nodejs';

import { z } from 'zod';

import { authenticateApiRequest, issueApiToken, revokeApiToken } from '@/lib/auth/api-token';
import { credsSchema } from '@/lib/auth/credentials-schema';
import { verifyAdminCredentials } from '@/lib/auth/verify-credentials';
import { corsJson, corsPreflight, OPEN_CORS_HEADERS } from '@/lib/http/cors';

const signInSchema = credsSchema.extend({
  /** Shown in the admin's list, e.g. "Chrome · macOS". */
  name: z.string().trim().min(1).max(60),
});

const INVALID_TOKEN = '登录已失效，请重新登录';

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return corsJson({ error: 'Invalid JSON' }, 400);
  }
  const parsed = signInSchema.safeParse(body);
  if (!parsed.success) return corsJson({ error: '请填写用户名和密码' }, 400);

  const user = await verifyAdminCredentials(parsed.data.username, parsed.data.password);
  if (!user) return corsJson({ error: '用户名或密码错误' }, 401);

  const token = await issueApiToken(user.id, parsed.data.name);
  return corsJson({ token, username: user.username });
}

export async function GET(request: Request) {
  const principal = await authenticateApiRequest(request);
  if (!principal) return corsJson({ error: INVALID_TOKEN }, 401);
  return corsJson({ username: principal.username });
}

export async function DELETE(request: Request) {
  const principal = await authenticateApiRequest(request);
  if (!principal) return corsJson({ error: INVALID_TOKEN }, 401);
  await revokeApiToken(principal.tokenId);
  return new Response(null, { status: 204, headers: OPEN_CORS_HEADERS });
}

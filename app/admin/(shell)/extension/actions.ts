// app/admin/(shell)/extension/actions.ts
// Sign a browser extension out from the admin side by revoking its token.

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import { revokeApiToken } from '@/lib/auth/api-token';

export async function revokeExtension(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'Unauthorized' };

  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: 'invalid token id' };

  try {
    await revokeApiToken(parsed.data);
  } catch (err) {
    return { ok: false, error: `撤销失败：${(err as Error).message}` };
  }

  revalidatePath('/admin/extension');
  return { ok: true };
}

// lib/auth/verify-credentials.ts
// The one place an admin password is checked — used by the Auth.js
// Credentials provider (the login page) and by the browser extension's login.

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db, users } from '@/lib/db';

/** The admin with this username and password, or null. */
export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<{ id: string; username: string } | null> {
  const [user] = await db
    .select({ id: users.id, username: users.username, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!user?.passwordHash) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? { id: user.id, username: user.username } : null;
}

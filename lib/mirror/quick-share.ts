// lib/mirror/quick-share.ts
// From a post URL to a share link in one call — what the browser extension's
// share button does.
//
// A post that is already mirrored gets a new link on the existing mirror (a
// content item has many shares by design) instead of a second fetch and a
// duplicate copy of its images; the admin can still refresh that mirror from
// its detail page. Anything else goes through the wizard's creation path with
// every comment retained.
//
// The access password belongs to the mirror, not the link. A password given
// here is written to the mirror — for a reused mirror that changes it for every
// link it already has, the same as setting it on the mirror's detail page. No
// password means the mirror's setting is left as it is, never cleared.

import { and, desc, eq, sql } from 'drizzle-orm';

import { db, contentItems } from '@/lib/db';
import { isNotArticle } from '@/lib/article/queries';
import {
  getSitePasswordHash,
  hashPassword,
  readPasswordMode,
  type PasswordMode,
} from '@/lib/content/password';
import { parsePostUrl } from '@/lib/fetcher/platforms';
import {
  createMirrorFromUrl,
  insertShare,
  platformUrlSchema,
  type AccessControlInput,
  type CreateMirrorStage,
} from '@/lib/mirror/create';

/** Password to put on the mirror; absent leaves the mirror's setting unchanged. */
export type MirrorPasswordInput = { mode: 'inherit' } | { mode: 'custom'; value: string };

export type QuickShareOutcome =
  | {
      ok: true;
      mirrorId: string;
      shareToken: string;
      title: string;
      /** True when the link was added to a mirror that already existed. */
      reused: boolean;
      /** When the mirrored content was last fetched from the platform. */
      fetchedAt: Date | null;
      /** The mirror's password mode after this share — what a visitor will face. */
      passwordMode: PasswordMode;
      warnings: string[];
    }
  | { ok: false; error: string; kind?: string };

async function setMirrorPassword(mirrorId: string, password: MirrorPasswordInput): Promise<void> {
  await db
    .update(contentItems)
    .set({
      passwordMode: password.mode,
      passwordHash: password.mode === 'custom' ? await hashPassword(password.value) : null,
    })
    .where(eq(contentItems.id, mirrorId));
}

export async function quickShare(input: {
  url: string;
  accessControl?: AccessControlInput;
  password?: MirrorPasswordInput;
  createdBy: string | null;
  onStage?: (stage: CreateMirrorStage) => void;
}): Promise<QuickShareOutcome> {
  const { password } = input;

  // 'inherit' with no site password would leave the mirror open while the
  // sharer believes it is protected.
  if (password?.mode === 'inherit' && !(await getSitePasswordHash())) {
    return {
      ok: false,
      error: 'Reach 还没有设置系统密码，请先在后台「系统设置」里设置，或改用单独密码',
    };
  }

  const post = parsePostUrl(input.url);

  if (post) {
    const [existing] = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        fetchedAt: contentItems.fetchedAt,
        refreshedAt: contentItems.refreshedAt,
        passwordMode: contentItems.passwordMode,
      })
      .from(contentItems)
      .where(
        and(
          isNotArticle,
          eq(contentItems.platform, post.platform),
          sql`${contentItems.platformData}->>'sourceId' = ${post.sourceId}`,
        ),
      )
      .orderBy(desc(contentItems.createdAt))
      .limit(1);

    if (existing) {
      // Password first: the new link must never exist in front of an open mirror.
      if (password) await setMirrorPassword(existing.id, password);
      const shareToken = await insertShare(db, existing.id, input.accessControl);
      return {
        ok: true,
        mirrorId: existing.id,
        shareToken,
        title: existing.title,
        reused: true,
        fetchedAt: existing.refreshedAt ?? existing.fetchedAt,
        passwordMode: password?.mode ?? readPasswordMode(existing.passwordMode),
        warnings: [],
      };
    }
  }

  const url = post?.url ?? input.url;
  if (!platformUrlSchema.safeParse(url).success) {
    return { ok: false, kind: 'invalid_url', error: '请提供 X / 推特帖子或 YouTube 视频的链接' };
  }

  const created = await createMirrorFromUrl({
    url,
    selectedCommentIds: null,
    accessControl: input.accessControl,
    createdBy: input.createdBy,
    onStage: input.onStage,
  });
  if (!created.ok) return { ok: false, error: created.error, kind: created.kind };

  // The link has not left the server yet, so nobody can open the mirror in the
  // moment between its creation and this update.
  if (password) await setMirrorPassword(created.mirrorId, password);

  return {
    ok: true,
    mirrorId: created.mirrorId,
    shareToken: created.shareToken,
    title: created.content.title,
    reused: false,
    fetchedAt: created.content.fetchedAt ? new Date(created.content.fetchedAt) : null,
    passwordMode: password?.mode ?? 'none',
    warnings: created.warnings,
  };
}

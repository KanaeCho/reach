// lib/mirror/quick-share.ts
// From a post URL to a share link in one call — what the browser extension's
// share button does.
//
// A post that is already mirrored gets a new link on the existing mirror (a
// content item has many shares by design) instead of a second fetch and a
// duplicate copy of its images; the admin can still refresh that mirror from
// its detail page. Anything else goes through the wizard's creation path with
// every comment retained.

import { and, desc, eq, sql } from 'drizzle-orm';

import { db, contentItems } from '@/lib/db';
import { isNotArticle } from '@/lib/article/queries';
import { parsePostUrl } from '@/lib/fetcher/platforms';
import {
  createMirrorFromUrl,
  insertShare,
  platformUrlSchema,
  type AccessControlInput,
  type CreateMirrorStage,
} from '@/lib/mirror/create';

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
      warnings: string[];
    }
  | { ok: false; error: string; kind?: string };

export async function quickShare(input: {
  url: string;
  accessControl?: AccessControlInput;
  createdBy: string | null;
  onStage?: (stage: CreateMirrorStage) => void;
}): Promise<QuickShareOutcome> {
  const post = parsePostUrl(input.url);

  if (post) {
    const [existing] = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        fetchedAt: contentItems.fetchedAt,
        refreshedAt: contentItems.refreshedAt,
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
      const shareToken = await insertShare(db, existing.id, input.accessControl);
      return {
        ok: true,
        mirrorId: existing.id,
        shareToken,
        title: existing.title,
        reused: true,
        fetchedAt: existing.refreshedAt ?? existing.fetchedAt,
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

  return {
    ok: true,
    mirrorId: created.mirrorId,
    shareToken: created.shareToken,
    title: created.content.title,
    reused: false,
    fetchedAt: created.content.fetchedAt ? new Date(created.content.fetchedAt) : null,
    warnings: created.warnings,
  };
}

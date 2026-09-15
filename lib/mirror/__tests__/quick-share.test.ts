// lib/mirror/__tests__/quick-share.test.ts
// quickShare — reuse an existing mirror of the same post, otherwise create one
// with every comment retained; reject links that are not X / YouTube posts.

import { describe, it, expect, beforeEach, vi } from 'vitest';

let existingRows: Array<Record<string, unknown>> = [];
let insertShareCalls: Array<{ contentItemId: string; accessControl: unknown }> = [];
let createCalls: Array<Record<string, unknown>> = [];
let createOutcome: Record<string, unknown> = {};

const contentItems = { __table: 'content_items' };

vi.mock('@/lib/db', () => ({
  contentItems,
  db: {
    select: () => {
      const query = {
        from: () => query,
        where: () => query,
        orderBy: () => query,
        limit: () => Promise.resolve(existingRows),
      };
      return query;
    },
  },
}));

vi.mock('@/lib/article/queries', () => ({ isNotArticle: { __cond: 'not-article' } }));

vi.mock('@/lib/mirror/create', async () => {
  const { z } = await import('zod');
  return {
    platformUrlSchema: z.string().url().refine((url) => /^https?:\/\/(twitter\.com|x\.com|t\.co|www\.youtube\.com|youtu\.be)\//i.test(url)),
    insertShare: async (_executor: unknown, contentItemId: string, accessControl: unknown) => {
      insertShareCalls.push({ contentItemId, accessControl });
      return 'TOKEN_REUSED_000000000';
    },
    createMirrorFromUrl: async (input: Record<string, unknown>) => {
      createCalls.push(input);
      return createOutcome;
    },
  };
});

const { quickShare } = await import('@/lib/mirror/quick-share');

describe('quickShare', () => {
  beforeEach(() => {
    existingRows = [];
    insertShareCalls = [];
    createCalls = [];
    createOutcome = {
      ok: true,
      mirrorId: 'mirror-new',
      shareToken: 'TOKEN_NEW_0000000000000',
      content: { title: 'New post', fetchedAt: '2026-09-15T10:00:00.000Z' },
      warnings: ['Image download failed for x'],
    };
  });

  it('adds a link to the mirror that already exists for the post, without fetching', async () => {
    const refreshedAt = new Date('2026-09-14T08:00:00Z');
    existingRows = [
      { id: 'mirror-1', title: 'Old post', fetchedAt: new Date('2026-09-01T00:00:00Z'), refreshedAt },
    ];

    const outcome = await quickShare({
      url: 'https://twitter.com/jack/status/20?s=20',
      accessControl: { burnAfterRead: true },
      createdBy: 'admin',
    });

    expect(outcome).toEqual({
      ok: true,
      mirrorId: 'mirror-1',
      shareToken: 'TOKEN_REUSED_000000000',
      title: 'Old post',
      reused: true,
      fetchedAt: refreshedAt,
      warnings: [],
    });
    expect(insertShareCalls).toEqual([{ contentItemId: 'mirror-1', accessControl: { burnAfterRead: true } }]);
    expect(createCalls).toHaveLength(0);
  });

  it('creates a mirror from the canonical URL, retaining every comment, when none exists', async () => {
    const onStage = () => {};
    const outcome = await quickShare({
      url: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      createdBy: 'admin',
      onStage,
    });

    expect(createCalls).toEqual([
      {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        selectedCommentIds: null,
        accessControl: undefined,
        createdBy: 'admin',
        onStage,
      },
    ]);
    expect(outcome).toEqual({
      ok: true,
      mirrorId: 'mirror-new',
      shareToken: 'TOKEN_NEW_0000000000000',
      title: 'New post',
      reused: false,
      fetchedAt: new Date('2026-09-15T10:00:00.000Z'),
      warnings: ['Image download failed for x'],
    });
    expect(insertShareCalls).toHaveLength(0);
  });

  it('passes a whitelisted non-post link (t.co) straight to creation', async () => {
    await quickShare({ url: 'https://t.co/abc123', createdBy: null });
    expect(createCalls[0]!.url).toBe('https://t.co/abc123');
  });

  it('carries the fetch failure kind through', async () => {
    createOutcome = { ok: false, error: 'Tweet not found', kind: 'not_found', warnings: [] };
    const outcome = await quickShare({ url: 'https://x.com/jack/status/20', createdBy: null });
    expect(outcome).toEqual({ ok: false, error: 'Tweet not found', kind: 'not_found' });
  });

  it('rejects links outside the supported platforms before any fetch', async () => {
    const outcome = await quickShare({ url: 'https://example.com/post/1', createdBy: null });
    expect(outcome).toMatchObject({ ok: false, kind: 'invalid_url' });
    expect(createCalls).toHaveLength(0);
  });
});

// lib/mirror/__tests__/quick-share.test.ts
// quickShare — reuse an existing mirror of the same post, otherwise create one
// with every comment retained; reject links that are not X / YouTube posts.
// The access password belongs to the mirror: a given password is written to it
// (before any new link exists), an absent one leaves it untouched.

import { describe, it, expect, beforeEach, vi } from 'vitest';

let existingRows: Array<Record<string, unknown>> = [];
let calls: string[] = [];
let passwordUpdates: Array<{ patch: Record<string, unknown> }> = [];
let insertShareCalls: Array<{ contentItemId: string; accessControl: unknown }> = [];
let createCalls: Array<Record<string, unknown>> = [];
let createOutcome: Record<string, unknown> = {};
let sitePasswordHash = '';

const contentItems = { __table: 'content_items', id: 'id' };

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
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: () => {
          calls.push('update-password');
          passwordUpdates.push({ patch });
          return Promise.resolve();
        },
      }),
    }),
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...conds: unknown[]) => ({ and: conds }),
  desc: (col: unknown) => ({ desc: col }),
  eq: (col: unknown, value: unknown) => ({ eq: [col, value] }),
  sql: () => ({ sql: true }),
}));

vi.mock('@/lib/article/queries', () => ({ isNotArticle: { __cond: 'not-article' } }));

vi.mock('@/lib/content/password', () => ({
  getSitePasswordHash: async () => sitePasswordHash,
  hashPassword: async (value: string) => `hash(${value})`,
  readPasswordMode: (raw: string | null) => (raw === 'inherit' || raw === 'custom' ? raw : 'none'),
}));

vi.mock('@/lib/mirror/create', async () => {
  const { z } = await import('zod');
  return {
    platformUrlSchema: z.string().url().refine((url) => /^https?:\/\/(twitter\.com|x\.com|t\.co|www\.youtube\.com|youtu\.be)\//i.test(url)),
    insertShare: async (_executor: unknown, contentItemId: string, accessControl: unknown) => {
      calls.push('insert-share');
      insertShareCalls.push({ contentItemId, accessControl });
      return 'TOKEN_REUSED_000000000';
    },
    createMirrorFromUrl: async (input: Record<string, unknown>) => {
      calls.push('create-mirror');
      createCalls.push(input);
      return createOutcome;
    },
  };
});

const { quickShare } = await import('@/lib/mirror/quick-share');

describe('quickShare', () => {
  beforeEach(() => {
    existingRows = [];
    calls = [];
    passwordUpdates = [];
    insertShareCalls = [];
    createCalls = [];
    sitePasswordHash = '';
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
      { id: 'mirror-1', title: 'Old post', fetchedAt: new Date('2026-09-01T00:00:00Z'), refreshedAt, passwordMode: null },
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
      passwordMode: 'none',
      warnings: [],
    });
    expect(insertShareCalls).toEqual([{ contentItemId: 'mirror-1', accessControl: { burnAfterRead: true } }]);
    expect(createCalls).toHaveLength(0);
  });

  it('writes a given password to the reused mirror before creating the link', async () => {
    existingRows = [{ id: 'mirror-1', title: 'Old post', fetchedAt: null, refreshedAt: null, passwordMode: null }];

    const outcome = await quickShare({
      url: 'https://x.com/jack/status/20',
      password: { mode: 'custom', value: 'open sesame' },
      createdBy: 'admin',
    });

    expect(calls).toEqual(['update-password', 'insert-share']);
    expect(passwordUpdates).toEqual([{ patch: { passwordMode: 'custom', passwordHash: 'hash(open sesame)' } }]);
    expect(outcome).toMatchObject({ ok: true, reused: true, passwordMode: 'custom' });
  });

  it('leaves a protected mirror as it is when no password is given, and reports its mode', async () => {
    existingRows = [{ id: 'mirror-1', title: 'Old post', fetchedAt: null, refreshedAt: null, passwordMode: 'inherit' }];

    const outcome = await quickShare({ url: 'https://x.com/jack/status/20', createdBy: null });

    expect(passwordUpdates).toHaveLength(0);
    expect(outcome).toMatchObject({ ok: true, reused: true, passwordMode: 'inherit' });
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
      passwordMode: 'none',
      warnings: ['Image download failed for x'],
    });
    expect(passwordUpdates).toHaveLength(0);
  });

  it('protects a new mirror with the site password before returning its link', async () => {
    sitePasswordHash = '$2a$10$site';
    const outcome = await quickShare({
      url: 'https://x.com/jack/status/20',
      password: { mode: 'inherit' },
      createdBy: null,
    });

    expect(calls).toEqual(['create-mirror', 'update-password']);
    expect(passwordUpdates).toEqual([{ patch: { passwordMode: 'inherit', passwordHash: null } }]);
    expect(outcome).toMatchObject({ ok: true, reused: false, passwordMode: 'inherit' });
  });

  it('refuses the site password when none is configured, before touching anything', async () => {
    existingRows = [{ id: 'mirror-1', title: 'Old post', fetchedAt: null, refreshedAt: null, passwordMode: null }];
    const outcome = await quickShare({
      url: 'https://x.com/jack/status/20',
      password: { mode: 'inherit' },
      createdBy: null,
    });

    expect(outcome).toMatchObject({ ok: false });
    expect(calls).toHaveLength(0);
  });

  it('passes a whitelisted non-post link (t.co) straight to creation', async () => {
    await quickShare({ url: 'https://t.co/abc123', createdBy: null });
    expect(createCalls[0]!.url).toBe('https://t.co/abc123');
  });

  it('carries the fetch failure kind through, setting no password', async () => {
    createOutcome = { ok: false, error: 'Tweet not found', kind: 'not_found', warnings: [] };
    const outcome = await quickShare({
      url: 'https://x.com/jack/status/20',
      password: { mode: 'custom', value: 'x' },
      createdBy: null,
    });
    expect(outcome).toEqual({ ok: false, error: 'Tweet not found', kind: 'not_found' });
    expect(passwordUpdates).toHaveLength(0);
  });

  it('rejects links outside the supported platforms before any fetch', async () => {
    const outcome = await quickShare({ url: 'https://example.com/post/1', createdBy: null });
    expect(outcome).toMatchObject({ ok: false, kind: 'invalid_url' });
    expect(createCalls).toHaveLength(0);
  });
});

// lib/mirror/__tests__/create.test.ts
// createMirrorFromUrl — shared by the admin wizard and the extension's share
// route. Covers what the wizard's action tests do not reach: stage reporting,
// "retain every comment" (null selection), image failures as warnings, fetch
// failures carrying their kind, and uploadMirrorVideos staying off by default.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const contentItems = { __table: 'content_items', id: 'id' };
const media = { __table: 'media' };
const comments = { __table: 'comments' };
const shares = { __table: 'shares' };
const mirrorVersions = { __table: 'mirror_versions' };

let inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
let events: string[] = [];
let fetchImpl: () => Promise<unknown>;
let failingImages = new Set<string>();
let storageEnabled = 'false';

const tx = {
  insert: (table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      inserts.push({ table, values });
      events.push(`insert:${(table as { __table: string }).__table}`);
      return { returning: () => Promise.resolve([{ id: 'mirror-1' }]) };
    },
  }),
};

vi.mock('@/lib/db', () => ({
  db: {
    transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    select: () => {
      throw new Error('uploadMirrorVideos must not query when storage is disabled');
    },
  },
  contentItems,
  media,
  comments,
  shares,
  mirrorVersions,
}));

vi.mock('@/lib/fetcher', () => ({ fetchContent: () => fetchImpl() }));

vi.mock('@/lib/fetcher/errors', () => ({
  FetcherError: class FetcherError extends Error {
    constructor(
      public kind: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock('@/lib/blob/download-image', () => ({
  downloadImageToBlob: async (url: string) => {
    events.push(`download:${url}`);
    if (failingImages.has(url)) throw new Error('404');
    return { blobUrl: `blob:${url}`, size: 100 };
  },
}));

vi.mock('@/lib/quota', () => ({
  getStorageUsage: async () => 0,
  evaluateQuota: () => ({ warnings: { totalQuota: false, perImage: false, perMirror: false } }),
  LIMITS: { totalQuota: 1, perImage: 1, perMirror: 1 },
}));

vi.mock('@/lib/mirror/versioning', () => ({
  createSnapshot: async () => ({ snapshot: true }),
}));

vi.mock('@/lib/settings', () => ({
  getSetting: async (key: string) => (key === 'video_storage_enabled' ? storageEnabled : ''),
}));

vi.mock('@/lib/storage/s3', () => ({
  downloadAndUploadVideo: async () => ({ ok: true }),
  videoStorageKey: () => 'key',
}));

vi.mock('@/lib/video/playback-url', () => ({ resolveVideoFetchUrl: async (url: string) => url }));

const { createMirrorFromUrl, uploadMirrorVideos } = await import('@/lib/mirror/create');
// The mocked class above, typed as it is built here rather than as the real one.
const { FetcherError } = (await import('@/lib/fetcher/errors')) as unknown as {
  FetcherError: new (kind: string, message: string) => Error;
};

function comment(id: string, replies: string[] = []) {
  const make = (cid: string) => ({
    id: cid,
    content: `text ${cid}`,
    author: { id: 'a', name: 'A', handle: 'a', url: '', avatarUrl: '' },
    createdAt: '2026-09-01T00:00:00.000Z',
    stats: { likes: 1, replies: 0 },
  });
  return { ...make(id), replies: replies.map(make) };
}

const content = {
  platform: 'x',
  sourceId: '20',
  sourceUrl: 'https://x.com/jack/status/20',
  title: 'just setting up my twttr',
  content: 'just setting up my twttr',
  body: 'just setting up my twttr',
  author: { id: '1', name: 'jack', handle: 'jack', url: '', avatarUrl: '' },
  publishedAt: '2006-03-21T20:50:14.000Z',
  media: [
    { type: 'image', originalUrl: 'https://pbs.twimg.com/a.jpg' },
    { type: 'image', originalUrl: 'https://pbs.twimg.com/b.jpg' },
  ],
  stats: { likes: 1, comments: 2, reposts: 0, views: 0, collects: 0 },
  comments: [comment('c1', ['r1']), comment('c2')],
  platformData: { sourceId: '20' },
  fetchedAt: '2026-09-15T10:00:00.000Z',
};

describe('createMirrorFromUrl', () => {
  beforeEach(() => {
    inserts = [];
    events = [];
    failingImages = new Set();
    storageEnabled = 'false';
    fetchImpl = async () => content;
  });

  it('reports stages in order and downloads images before the transaction', async () => {
    const stages: unknown[] = [];
    const outcome = await createMirrorFromUrl({
      url: 'https://x.com/jack/status/20',
      selectedCommentIds: null,
      createdBy: 'admin',
      onStage: (stage) => {
        stages.push(stage);
        events.push(`stage:${stage.phase}`);
      },
    });

    expect(outcome.ok).toBe(true);
    expect(stages).toEqual([
      { phase: 'fetching' },
      { phase: 'images', done: 0, total: 2 },
      { phase: 'images', done: 1, total: 2 },
      { phase: 'saving' },
    ]);
    const firstInsert = events.indexOf('insert:content_items');
    expect(events.lastIndexOf('download:https://pbs.twimg.com/b.jpg')).toBeLessThan(firstInsert);
    expect(inserts.find((i) => i.table === contentItems)?.values.createdBy).toBe('admin');
  });

  it('retains every comment, replies included, when the selection is null', async () => {
    await createMirrorFromUrl({ url: 'https://x.com/jack/status/20', selectedCommentIds: null, createdBy: null });
    const stored = inserts.filter((i) => i.table === comments).map((i) => [i.values.platformCommentId, i.values.retained]);
    expect(stored).toEqual([
      ['c1', true],
      ['r1', true],
      ['c2', true],
    ]);
  });

  it('honours an explicit selection from the wizard', async () => {
    await createMirrorFromUrl({ url: 'https://x.com/jack/status/20', selectedCommentIds: ['c2'], createdBy: null });
    const stored = inserts.filter((i) => i.table === comments).map((i) => [i.values.platformCommentId, i.values.retained]);
    expect(stored).toEqual([
      ['c1', false],
      ['r1', false],
      ['c2', true],
    ]);
  });

  it('writes the share with its access control and a v0 snapshot', async () => {
    const outcome = await createMirrorFromUrl({
      url: 'https://x.com/jack/status/20',
      selectedCommentIds: null,
      accessControl: { expiresAt: '2026-09-22T10:00:00.000Z', maxViews: 3, burnAfterRead: true },
      createdBy: null,
    });

    const share = inserts.find((i) => i.table === shares)!.values;
    expect(share).toMatchObject({ contentItemId: 'mirror-1', status: 'active', maxViews: 3, burnAfterRead: true, maxUniqueVisitors: null });
    expect(share.expiresAt).toEqual(new Date('2026-09-22T10:00:00.000Z'));
    expect(outcome.ok && outcome.shareToken).toBe(share.token);
    expect(inserts.find((i) => i.table === mirrorVersions)?.values).toMatchObject({ contentItemId: 'mirror-1', versionNumber: 0 });
  });

  it('keeps going when an image fails, recording a warning and a null blob', async () => {
    failingImages.add('https://pbs.twimg.com/a.jpg');
    const outcome = await createMirrorFromUrl({ url: 'https://x.com/jack/status/20', selectedCommentIds: null, createdBy: null });

    expect(outcome.ok).toBe(true);
    expect(outcome.warnings).toEqual(['Image download failed for https://pbs.twimg.com/a.jpg: 404']);
    const images = inserts.filter((i) => i.table === media).map((i) => i.values.blobUrl);
    expect(images).toEqual([null, 'blob:https://pbs.twimg.com/b.jpg']);
  });

  it('returns a fetch failure with its kind and writes nothing', async () => {
    fetchImpl = async () => {
      throw new FetcherError('not_found', 'Tweet 20 not found');
    };
    const outcome = await createMirrorFromUrl({ url: 'https://x.com/jack/status/20', selectedCommentIds: null, createdBy: null });
    expect(outcome).toEqual({ ok: false, error: 'Tweet 20 not found', kind: 'not_found', warnings: [] });
    expect(inserts).toHaveLength(0);
  });
});

describe('uploadMirrorVideos', () => {
  it('does nothing while the storage backend is disabled', async () => {
    storageEnabled = 'false';
    await expect(uploadMirrorVideos('mirror-1')).resolves.toEqual([]);
  });
});

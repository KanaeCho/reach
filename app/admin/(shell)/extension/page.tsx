// app/admin/(shell)/extension/page.tsx
// 浏览器扩展 — 接入说明 + 已登录扩展管理。扩展凭管理员账号登录后换得的
// 令牌调用 /api/extension/*。

import { desc } from 'drizzle-orm';
import { headers } from 'next/headers';

import { AdminPageHeader } from '@/app/_components/admin/AdminPageHeader';
import { db, apiTokens } from '@/lib/db';
import { EXTENSION_REPO_URL } from '@/lib/site';
import { CopyTextButton, ExtensionSessions } from './_components/ExtensionSessions';

function formatDate(d: Date) {
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ExtensionPage() {
  const [tokens, h] = await Promise.all([
    db
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        createdAt: apiTokens.createdAt,
        lastUsedAt: apiTokens.lastUsedAt,
      })
      .from(apiTokens)
      .orderBy(desc(apiTokens.createdAt)),
    headers(),
  ]);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <AdminPageHeader
        label="系统"
        title="浏览器扩展"
        description="在 X / YouTube 页面一键生成分享链接，链接自动复制到剪贴板"
      />

      <div className="ds-card p-6">
        <h2 className="text-base font-semibold text-ink">连接扩展</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted">
          <li>
            按{' '}
            <a href={EXTENSION_REPO_URL} target="_blank" rel="noreferrer" className="text-brand hover:underline">
              扩展仓库
            </a>{' '}
            的说明构建并安装（Chrome / Edge / Firefox）。
          </li>
          <li>打开扩展设置，填入下面的 Reach 地址，用管理员账号登录。</li>
          <li>在帖子或视频页点扩展图标、按 Alt+Shift+S，或在链接上右键「用 Reach 分享」。</li>
        </ol>
        <div className="mt-4 flex items-center gap-2">
          <span className="shrink-0 text-[13px] text-muted">Reach 地址</span>
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink">
            {siteUrl}
          </code>
          <CopyTextButton text={siteUrl} />
        </div>
      </div>

      <ExtensionSessions
        sessions={tokens.map((t) => ({
          id: t.id,
          name: t.name,
          signedInAt: formatDate(t.createdAt),
          lastUsedAt: t.lastUsedAt ? formatDate(t.lastUsedAt) : null,
        }))}
      />
    </div>
  );
}

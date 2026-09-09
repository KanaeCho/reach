// app/about/page.tsx
// The repositories behind the site, each with its README rendered in place.
// READMEs are fetched from GitHub on request and cached for an hour, so the
// page tracks the public repositories rather than a copy checked in here.

import type { Metadata } from 'next';

import { ArticleBody } from '@/app/_components/article/ArticleBody';
import { PageBackground } from '@/app/_components/layout/PageBackground';
import { PageContainer } from '@/app/_components/layout/PageContainer';
import { PublicFooter } from '@/app/_components/layout/PublicFooter';
import { PublicHeader } from '@/app/_components/layout/PublicHeader';
import { SurfaceCard } from '@/app/_components/ui/SurfaceCard';
import { fetchRepoReadme, SITE_REPOS } from '@/lib/site';

export const metadata: Metadata = {
  title: '关于 — Reach',
  description: 'Reach 由三个开源仓库组成：站点本体、抓取端代理与视频通道。',
};

export const revalidate = 3600;

export default async function AboutPage() {
  const readmes = await Promise.all(SITE_REPOS.map((repo) => fetchRepoReadme(repo)));

  return (
    <main className="relative flex min-h-screen flex-col bg-paper text-ink">
      <PageBackground intensity="subtle" />
      <PageContainer className="flex flex-1 flex-col">
        <PublicHeader loginLabel="管理登录" />

        <div className="flex-1 px-6 py-10 md:px-14 md:py-14">
          <div className="mx-auto max-w-[760px]">
            <div className="ds-section-label">About</div>
            <h1 className="mt-2 ds-page-heading">关于 Reach</h1>
            <p className="ds-page-subtitle">
              本站的代码全部开源，由三个仓库组成。下面是各自的说明，README 直接取自 GitHub。
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {SITE_REPOS.map((repo) => (
                <a
                  key={repo.slug}
                  href={`#repo-${repo.slug}`}
                  className="group block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-brand/60"
                >
                  <div className="ds-section-label">{repo.role}</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-ink group-hover:text-brand">
                    {repo.slug}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{repo.description}</p>
                </a>
              ))}
            </div>

            {SITE_REPOS.map((repo, i) => (
              <section key={repo.slug} id={`repo-${repo.slug}`} className="mt-14 scroll-mt-24">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-2xl font-bold text-ink">{repo.name}</h2>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand transition-opacity hover:opacity-80"
                  >
                    在 GitHub 打开 ↗
                  </a>
                </div>
                <p className="mt-2 text-sm text-muted">{repo.description}</p>

                <SurfaceCard className="mt-5 p-6 md:p-8">
                  {readmes[i] ? (
                    <ArticleBody markdown={readmes[i]} />
                  ) : (
                    <p className="text-sm text-muted">
                      暂时无法从 GitHub 读取 README，请直接访问{' '}
                      <a
                        href={`${repo.url}/blob/main/${repo.readmePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand"
                      >
                        {repo.readmePath}
                      </a>
                      。
                    </p>
                  )}
                </SurfaceCard>
              </section>
            ))}
          </div>
        </div>

        <PublicFooter />
      </PageContainer>
    </main>
  );
}

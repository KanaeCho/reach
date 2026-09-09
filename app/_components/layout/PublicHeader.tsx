import Link from 'next/link';
import { ReachMarkWordmark } from '@/app/_components/brand/ReachMark';
import { ThemeToggle } from '@/app/_components/theme/ThemeToggle';
import { GITHUB_REPO_URL } from '@/lib/site';

export type PublicNavLink = { href: string; label: string };

const DEFAULT_LINKS: PublicNavLink[] = [
  { href: '/#features', label: '其要' },
  { href: '/#how-it-works', label: '其法' },
  { href: '/about', label: '其源' },
];

export function PublicHeader({
  navLinks = DEFAULT_LINKS,
  showNav = true,
  loginLabel = '管理登录',
}: {
  navLinks?: PublicNavLink[];
  showNav?: boolean;
  loginLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-6 py-4 md:px-10">
        <Link href="/" className="shrink-0 transition-opacity hover:opacity-80">
          <ReachMarkWordmark size="md" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {showNav && (
            <div className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="ds-ghost-nav">
                  {link.label}
                </a>
              ))}
            </div>
          )}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub 仓库"
            title="GitHub 仓库"
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.13-4.56-5.05 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05A9.4 9.4 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.04.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.81 0 .27.18.59.69.49A10.24 10.24 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
            </svg>
          </a>
          <ThemeToggle size="sm" className="hidden sm:inline-flex" />
          <Link
            href="/admin/login"
            className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90"
          >
            {loginLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
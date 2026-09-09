import Link from 'next/link';
import { getBuildVersion } from '@/lib/version';
import { GITHUB_REPO_URL } from '@/lib/site';

/** Footer meta row: version (links to /status) + privacy policy. */
export function SiteMetaLinks({ className = '' }: { className?: string }) {
  const version = getBuildVersion();
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      <Link
        href="/status"
        className="font-mono text-subtle transition-colors hover:text-muted"
        title="系统状态"
      >
        {version}
      </Link>
      <Link href="/about" className="transition-colors hover:text-ink">
        关于
      </Link>
      <Link href="/privacy-policy" className="transition-colors hover:text-ink">
        隐私政策
      </Link>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-ink"
      >
        GitHub
      </a>
    </div>
  );
}
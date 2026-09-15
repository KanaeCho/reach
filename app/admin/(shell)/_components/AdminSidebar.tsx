// app/admin/(shell)/_components/AdminSidebar.tsx
// Admin 侧边栏（服务端组件）— 桌面端固定在布局左侧，移动端由 MobileNav
// 作为抽屉复用同一份渲染。含登出 server action。

import { signOut } from '@/auth';
import { ReachMark } from '@/app/_components/brand/ReachMark';
import { NavLink } from './NavLink';

// ── 导航配置 ──
const NAV_GROUPS = [
  {
    label: '概览',
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
    ],
  },
  {
    label: '文章',
    items: [
      { href: '/admin/articles/new', label: '写文章', icon: 'pen' },
      {
        href: '/admin/articles',
        label: '文章管理',
        icon: 'doc',
        exclude: ['/admin/articles/new', '/admin/articles/media'],
      },
      { href: '/admin/articles/media', label: '素材管理', icon: 'media' },
    ],
  },
  {
    label: '镜像',
    items: [
      { href: '/admin/mirrors/new', label: '创建镜像', icon: 'plus' },
      { href: '/admin/mirrors', label: '镜像管理', icon: 'list', exclude: ['/admin/mirrors/new'] },
    ],
  },
  {
    label: '分析',
    items: [
      { href: '/admin/analytics/sessions', label: '访问记录', icon: 'chart' },
    ],
  },
  {
    label: '系统',
    items: [
      { href: '/admin/settings', label: '系统设置', icon: 'settings' },
      { href: '/admin/extension', label: '浏览器扩展', icon: 'puzzle' },
    ],
  },
];

// ── 图标 ──
const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  plus: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  list: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
    </svg>
  ),
  pen: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  ),
  doc: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  ),
  media: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  share: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14" />
    </svg>
  ),
  puzzle: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
    </svg>
  ),
  chart: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 3v18h18M7 14l4-4 3 3 5-6" />
    </svg>
  ),
  settings: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

export function AdminSidebar({ username }: { username: string }) {
  const initial = username.charAt(0).toUpperCase();

  return (
    <nav className="flex h-full w-[228px] shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-text">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-[22px] pb-[22px] pt-[22px]">
        <ReachMark size={22} className="text-brand-dark" />
        <span className="font-display text-[19px] font-bold text-white">Reach</span>
      </div>

      {/* 导航分组 */}
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="mb-2 mt-3.5 px-[22px] text-[10px] font-bold uppercase tracking-wider text-sidebar-label">
            {group.label}
          </div>
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={ICONS[item.icon]}
              excludePrefixes={'exclude' in item ? item.exclude : undefined}
            />
          ))}
        </div>
      ))}

      {/* 底部用户区 + 登出 */}
      <div className="mt-auto border-t border-sidebar-border px-[22px] py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-[13px] font-bold text-white">
            {initial}
          </div>
          <div className="flex-1 text-xs">
            <div className="font-medium text-white">{username}</div>
            <div className="text-[11px] text-sidebar-label">管理员</div>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/admin/login' });
            }}
          >
            <button
              type="submit"
              className="text-sidebar-label transition-colors hover:text-white"
              title="登出"
              aria-label="登出"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

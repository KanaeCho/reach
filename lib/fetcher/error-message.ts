// lib/fetcher/error-message.ts
// User-facing wording for a failed fetch, keyed by FetcherError kind. Shared by
// the create-mirror wizard and the quick-share API, so the extension and the
// admin UI describe the same failure the same way.

export function describeFetchError(kind: string | undefined, detail?: string): string {
  switch (kind) {
    case 'rate_limited': return '请求太频繁，请稍后重试';
    case 'not_found':
    case 'empty_item': return '内容不存在或已删除';
    case 'auth_required': return '源站需要登录，暂无法抓取';
    case 'unsupported':
    case 'unsupported_platform': return '不支持的平台，仅支持 X/推特 或 YouTube 链接';
    case 'invalid_url': return detail || '链接格式无效';
    default: return '抓取失败，请检查链接或稍后重试';
  }
}

// app/admin/(shell)/extension/_components/ExtensionSessions.tsx
// 已登录的扩展列表 + 两次点击撤销（撤销后该扩展需要重新登录）。
// 另含一个通用的复制按钮，页面上的 Reach 地址用它。

'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { revokeExtension } from '../actions';

export interface ExtensionSessionRow {
  id: string;
  name: string;
  signedInAt: string;
  lastUsedAt: string | null;
}

export function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`shrink-0 rounded-md border px-3 py-2 text-[13px] transition-colors ${
        copied ? 'border-success text-success' : 'border-border bg-surface text-muted hover:text-ink'
      }`}
    >
      {copied ? '已复制' : '复制'}
    </button>
  );
}

function RevokeButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(async () => {
    if (!confirming) {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setRevoking(true);
    const result = await revokeExtension(id);
    setRevoking(false);
    setConfirming(false);
    if (!result.ok) {
      setError(result.error ?? '撤销失败');
      return;
    }
    router.refresh();
  }, [confirming, id, router]);

  if (error) return <span className="text-[12px] text-danger">{error}</span>;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={revoking}
      className={
        confirming
          ? 'rounded-md border border-danger bg-danger px-2.5 py-1.5 text-[12px] text-white'
          : 'rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-danger hover:text-danger'
      }
    >
      {revoking ? '撤销中…' : confirming ? '确认撤销？' : '撤销'}
    </button>
  );
}

export function ExtensionSessions({ sessions }: { sessions: ExtensionSessionRow[] }) {
  return (
    <div className="ds-card p-6">
      <h2 className="text-base font-semibold text-ink">已登录的扩展</h2>
      <p className="mt-1 text-[13px] text-subtle">
        扩展用管理员账号登录后会得到自己的令牌（不保存密码）。设备丢失或不再使用时在这里撤销，扩展需要重新登录。
      </p>

      <div className="mt-4 overflow-x-auto">
        {sessions.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-subtle">还没有扩展登录过</p>
        ) : (
          <table className="w-full min-w-[480px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-subtle">
                <th className="border-b border-border py-2 font-semibold">浏览器</th>
                <th className="border-b border-border py-2 font-semibold">登录时间</th>
                <th className="border-b border-border py-2 font-semibold">最近使用</th>
                <th className="border-b border-border py-2" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="border-b border-border py-2.5 text-ink">{s.name}</td>
                  <td className="border-b border-border py-2.5 text-muted">{s.signedInAt}</td>
                  <td className="border-b border-border py-2.5 text-muted">{s.lastUsedAt ?? '—'}</td>
                  <td className="border-b border-border py-2.5 text-right">
                    <RevokeButton id={s.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

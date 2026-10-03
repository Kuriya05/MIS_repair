'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckIcon, secondaryButtonClass } from '@/csmju';
import { LoadingButton } from '@/components/shared/LoadingButton';
import { useToast } from '@/components/shared/Toast';
import { api } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { Notification } from '@/lib/types';

const changed = () => window.dispatchEvent(new CustomEvent('csmju:notifications-changed'));

/** รายการแจ้งเตือน — เปิดแล้วทำเครื่องหมายว่าอ่านให้เอง · ลิงก์ภายในระบบเท่านั้น (ขึ้นต้น "/") */
export function NotificationList({ items }: { items: Notification[] }) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (item: Notification) => {
    setOpening(item.id);
    try {
      if (!item.isRead)
        await api(`/api/v1/notifications/${item.id}`, { method: 'PATCH', json: { isRead: true } });
      changed();
    } catch {
      // เปิดลิงก์ต่อได้แม้ทำเครื่องหมายไม่สำเร็จ
    }
    if (item.link?.startsWith('/') && !item.link.startsWith('//')) router.push(item.link);
    else {
      setOpening(null);
      router.refresh();
    }
  };

  return (
    <ul className="divide-y divide-outline-variant/40">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => void open(item)}
            aria-busy={opening === item.id || undefined}
            className={`flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-surface/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-container md:px-6 ${
              item.isRead ? '' : 'bg-primary-container/5'
            }`}
          >
            <span
              className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? 'bg-transparent' : 'bg-primary-container'}`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 space-y-1">
              <span
                className={`block text-body-md ${item.isRead ? 'text-on-surface' : 'font-semibold text-on-surface'}`}
              >
                {item.title}
                {item.isRead ? null : <span className="sr-only"> (ยังไม่อ่าน)</span>}
              </span>
              <span className="block text-body-md text-on-surface-variant">{item.message}</span>
              <span className="block text-caption text-secondary">
                <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
                  {formatRelative(item.createdAt)}
                </time>
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<{ updated: number }>('/api/v1/notifications', {
        method: 'PATCH',
        json: { isRead: true },
      });
      toast.success(`ทำเครื่องหมายว่าอ่านแล้ว ${data.updated} รายการ`);
      changed();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <LoadingButton
        onClick={run}
        loading={busy}
        disabled={disabled}
        className={secondaryButtonClass}
        title={disabled ? 'ไม่มีการแจ้งเตือนที่ยังไม่อ่าน' : undefined}
      >
        <CheckIcon className="h-4 w-4" />
        อ่านแล้วทั้งหมด
      </LoadingButton>
      {disabled ? (
        <span className="text-label-sm font-normal text-on-surface-variant">ไม่มีรายการที่ยังไม่อ่าน</span>
      ) : null}
      {error ? (
        <span role="alert" className="text-label-sm text-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/**
 * "ความเคลื่อนไหวล่าสุด" ในแผงข้างบอร์ดงานซ่อม — ช่าง/ผู้ดูแลไม่มีเมนูการแจ้งเตือนแยก จึงรวมไว้กับบอร์ด
 * รายการที่ยังไม่อ่านเน้นสี · กดรายการ = เปิดใบแจ้งซ่อมและทำเครื่องหมายว่าอ่าน · ปุ่มติ๊ก = อ่านแล้วโดยไม่เปิด
 * onUnreadChange แจ้งจำนวนที่ยังไม่อ่านล่าสุดให้ผู้เรียก (เช่น ปุ่มเปิดแผงแสดง "N ใหม่")
 */
export function ActivityFeed({
  items: initial,
  unread: initialUnread,
  onUnreadChange,
}: {
  items: Notification[];
  unread: number;
  onUnreadChange?: (unread: number) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(initial);
    setUnread(initialUnread);
  }, [initial, initialUnread]);

  useEffect(() => {
    onUnreadChange?.(unread);
  }, [unread, onUnreadChange]);

  const markRead = async (item: Notification) => {
    setBusy(item.id);
    setError(null);
    setItems((list) => list.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
    setUnread((count) => Math.max(0, count - 1));
    try {
      await api(`/api/v1/notifications/${item.id}`, { method: 'PATCH', json: { isRead: true } });
      changed();
    } catch (failure) {
      setItems((list) => list.map((n) => (n.id === item.id ? { ...n, isRead: false } : n)));
      setUnread((count) => count + 1);
      setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  const open = async (item: Notification) => {
    if (!item.isRead) {
      try {
        await api(`/api/v1/notifications/${item.id}`, { method: 'PATCH', json: { isRead: true } });
        changed();
      } catch {
        // เปิดลิงก์ต่อได้แม้ทำเครื่องหมายไม่สำเร็จ
      }
    }
    if (item.link?.startsWith('/') && !item.link.startsWith('//')) router.push(item.link);
    else router.refresh();
  };

  const markAll = async () => {
    setBusy('all');
    setError(null);
    try {
      const { data } = await api<{ updated: number }>('/api/v1/notifications', {
        method: 'PATCH',
        json: { isRead: true },
      });
      setItems((list) => list.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
      toast.success(`ทำเครื่องหมายว่าอ่านแล้ว ${data.updated} รายการ`);
      changed();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-outline-variant/40 px-4 py-4">
        <h2 id="activity-title" className="flex items-center gap-2 text-label-md text-on-surface">
          ความเคลื่อนไหวล่าสุด
          {unread > 0 ? (
            <span className="rounded-full bg-primary-container px-2 py-0.5 text-label-sm tabular-nums text-on-primary">
              {unread}
              <span className="sr-only"> รายการที่ยังไม่อ่าน</span>
            </span>
          ) : null}
        </h2>
        <LoadingButton
          onClick={markAll}
          loading={busy === 'all'}
          disabled={unread === 0 || busy !== null}
          className={`${secondaryButtonClass} px-3`}
          title={unread === 0 ? 'ไม่มีรายการที่ยังไม่อ่าน' : undefined}
        >
          <CheckIcon className="h-4 w-4" />
          อ่านทั้งหมด
        </LoadingButton>
      </div>
      {error ? (
        <p
          role="alert"
          className="mx-4 mt-3 rounded-lg bg-error-container px-3 py-2 text-label-sm text-on-error-container"
        >
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
          ยังไม่มีความเคลื่อนไหว — งานใหม่ งานที่มอบหมายให้คุณ และความคิดเห็นจะแสดงที่นี่
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant/40">
          {items.map((item) => (
            <li key={item.id} className={`flex items-start ${item.isRead ? '' : 'bg-primary-container/5'}`}>
              <button
                type="button"
                onClick={() => void open(item)}
                className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-container"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.isRead ? 'bg-transparent' : 'bg-primary-container'}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span
                    className={`block text-label-md ${item.isRead ? 'font-normal text-on-surface' : 'text-on-surface'}`}
                  >
                    {item.title}
                    {item.isRead ? null : <span className="sr-only"> (ยังไม่อ่าน)</span>}
                  </span>
                  <span className="line-clamp-2 block text-caption text-on-surface-variant">
                    {item.message}
                  </span>
                  <span className="block text-caption text-secondary">
                    <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
                      {formatRelative(item.createdAt)}
                    </time>
                  </span>
                </span>
              </button>
              {!item.isRead ? (
                <button
                  type="button"
                  onClick={() => void markRead(item)}
                  disabled={busy === item.id}
                  aria-label={`ทำเครื่องหมายว่าอ่านแล้ว: ${item.title}`}
                  title="ทำเครื่องหมายว่าอ่านแล้ว"
                  className="m-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-variant/50 hover:text-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container disabled:opacity-40"
                >
                  <CheckIcon className="h-5 w-5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, HistoryIcon, iconRoundButtonClass, secondaryButtonClass } from '@/csmju';
import { ActivityFeed } from '@/components/features/NotificationList';
import type { Notification } from '@/lib/types';

/**
 * ปุ่ม "ความเคลื่อนไหว (N ใหม่)" + แผงเลื่อนออกจากขวา — บอร์ดจึงกว้างเต็มจอตลอด
 * แผงเปิดแล้วเป็น dialog: ปิดด้วย Esc / ปุ่มปิด / คลิกพื้นหลัง และคืน focus กลับที่ปุ่มเดิม
 * ActivityFeed ถูก mount ไว้ตลอด (ซ่อนเมื่อปิด) เพื่อให้จำนวนที่ยังไม่อ่านบนปุ่มตรงกับในแผงเสมอ
 * แผง render ผ่าน portal ที่ body — หัวหน้ามี animation transform ซึ่งจะทำให้ position: fixed เพี้ยน
 */
export function BoardActivity({
  items,
  unread: initialUnread,
  failed = false,
}: {
  items: Notification[];
  unread: number;
  failed?: boolean;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={panelId}
        className={secondaryButtonClass}
      >
        <HistoryIcon className="h-4 w-4" />
        ความเคลื่อนไหว
        {unread > 0 ? (
          <span className="rounded-full bg-primary-container px-2 py-0.5 text-label-sm tabular-nums text-on-primary">
            {unread} ใหม่
          </span>
        ) : null}
      </button>

      {mounted
        ? createPortal(
            <div className={open ? 'fixed inset-0 z-40' : 'hidden'}>
              <button
                type="button"
                tabIndex={-1}
                aria-label="ปิดแผงความเคลื่อนไหว"
                className="absolute inset-0 cursor-default bg-black/30"
                onClick={close}
              />
              <aside
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-labelledby="activity-title"
                className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface-container-lowest shadow-xl"
              >
                <div className="flex justify-end border-b border-outline-variant/40 px-2 py-1">
                  <button
                    ref={closeButton}
                    type="button"
                    onClick={close}
                    aria-label="ปิดแผงความเคลื่อนไหว"
                    className={iconRoundButtonClass}
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {failed ? (
                    <>
                      <h2 id="activity-title" className="px-4 py-4 text-label-md text-on-surface">
                        ความเคลื่อนไหวล่าสุด
                      </h2>
                      <p role="alert" className="px-4 py-8 text-center text-body-md text-on-surface-variant">
                        โหลดความเคลื่อนไหวไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง
                      </p>
                    </>
                  ) : (
                    <ActivityFeed items={items} unread={initialUnread} onUnreadChange={setUnread} />
                  )}
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

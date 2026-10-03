'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';
import { iconRoundButtonClass } from './ui';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal ตามสเปคข้อ 7.2.1 / 8.3 — role="dialog" + aria-modal + aria-labelledby · ปิดด้วย Esc / คลิก scrim
 * เพิ่มสิ่งที่สเปคระบุว่ายังขาด: กัก focus ไว้ในกล่อง และคืน focus กลับจุดเดิมเมื่อปิด
 * วาดผ่าน portal ที่ document.body — ถ้าวางในการ์ดที่มี transform (เช่น .fade-slide-up) หรือ overflow-hidden
 * กล่องที่เป็น fixed จะยึดกับการ์ดแทนหน้าจอ แล้วถูกตัด/ซ้อนกับเนื้อหา
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  size = 'md',
  dismissible = true,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  dismissible?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const first =
      node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onCloseRef.current();
      }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, dismissible]);

  if (!open || typeof document === 'undefined') return null;
  const width = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="ปิดหน้าต่าง"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`fade-slide-up relative max-h-[calc(100dvh-32px)] w-full ${width} overflow-y-auto rounded-xl bg-surface-container-lowest p-6 shadow-xl`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-headline-md text-on-surface">
            {title}
          </h2>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className={`${iconRoundButtonClass} -mr-2 -mt-2`}
            >
              <CloseIcon className="h-6 w-6" />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

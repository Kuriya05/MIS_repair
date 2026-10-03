'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useTransition } from 'react';
import { RefreshIcon, secondaryButtonClass } from '@/csmju';
import { formatTime } from '@/lib/format';

/**
 * โหลดข้อมูลหน้าใหม่ทุก ๆ intervalMs ด้วย router.refresh() (Server Component ดึงข้อมูลรอบใหม่ ไม่ reload ทั้งหน้า)
 * หยุดนับเมื่อแท็บถูกซ่อน และรีเฟรชทันทีเมื่อกลับมาถ้าข้อมูลเก่ากว่ารอบที่กำหนด
 * renderedAt มาจากเซิร์ฟเวอร์ — เวลาที่แสดงจึงเป็นเวลาที่ดึงข้อมูลจริง
 */
export function AutoRefresh({
  renderedAt,
  intervalMs = 60_000,
}: {
  renderedAt: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const last = useRef(new Date(renderedAt).getTime());

  useEffect(() => {
    last.current = new Date(renderedAt).getTime();
  }, [renderedAt]);

  const refresh = useCallback(() => {
    last.current = Date.now();
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(refresh, intervalMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        window.clearInterval(timer);
        timer = undefined;
        return;
      }
      if (Date.now() - last.current >= intervalMs) refresh();
      start();
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, intervalMs]);

  return (
    <div className="flex items-center gap-3">
      <p className="text-caption text-on-surface-variant" aria-live="polite">
        {pending ? (
          'กำลังอัปเดต…'
        ) : (
          <>
            อัปเดตล่าสุดเมื่อ <time dateTime={renderedAt}>{formatTime(renderedAt)}</time>
          </>
        )}
        <span className="block text-caption">รีเฟรชเองทุก {Math.round(intervalMs / 1000)} วินาที</span>
      </p>
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        aria-busy={pending || undefined}
        className={secondaryButtonClass}
      >
        <RefreshIcon className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
        รีเฟรช
      </button>
    </div>
  );
}

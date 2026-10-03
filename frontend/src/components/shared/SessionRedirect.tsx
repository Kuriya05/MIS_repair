'use client';

import { useEffect, useState } from 'react';
import { CsmjuLogo, primaryButtonClass } from '@/csmju';
import { DISPLAY_NAME, loginHref } from '@/lib/config';
import { currentPath, startReSso } from '@/lib/sso';

/**
 * ยังไม่มี session / token หมดอายุ (401): ไม่แสดง error — พาไป /auth/login?next=<หน้านี้> ทันที
 * (auth-contract.md 1.2 ข้อ 5, 7) แล้ว Core Hub ส่งกลับมาหน้าเดิมเอง
 * ถ้าเพิ่งกลับมาไม่ถึง 30 วินาทีแล้วยัง 401 อีก หยุดให้ผู้ใช้กดปุ่มเอง (กันวน)
 */
export function SessionRedirect() {
  const [stopped, setStopped] = useState(false);
  const [href, setHref] = useState(loginHref());

  useEffect(() => {
    setHref(loginHref(currentPath()));
    if (!startReSso()) setStopped(true);
  }, []);

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="fade-slide-up w-full max-w-md space-y-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <CsmjuLogo />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-headline-md text-on-surface">{DISPLAY_NAME}</h1>
          <p className="text-body-md text-on-surface-variant" aria-live="polite">
            {stopped
              ? 'ยังเข้าสู่ระบบไม่สำเร็จ กรุณากดเข้าสู่ระบบอีกครั้ง'
              : 'กำลังพาไปเข้าสู่ระบบที่ CSMJU Portal…'}
          </p>
        </div>
        <a href={href} className={`${primaryButtonClass} w-full py-3`}>
          เข้าสู่ระบบอีกครั้ง
        </a>
      </div>
    </main>
  );
}

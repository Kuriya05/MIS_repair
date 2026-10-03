import { CsmjuLogo, primaryButtonClass } from '@/csmju';
import { DISPLAY_NAME, loginHref } from '@/lib/config';

/**
 * ยังไม่เคยเข้าสู่ระบบ (ไม่มีคุกกี้ session) — หน้าต้อนรับพร้อมลิงก์เข้าสู่ระบบ ไม่ redirect เอง
 * (แบบเดียวกับ reference implementation · auth-contract.md ข้อ 5: ทุกการเข้าสู่ระบบเริ่มที่ /auth/login)
 */
export function SignedOut() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="fade-slide-up w-full max-w-md space-y-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <CsmjuLogo />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-headline-md text-on-surface">{DISPLAY_NAME}</h1>
          <p className="text-body-md text-on-surface-variant">
            แจ้งซ่อมคอมพิวเตอร์ อุปกรณ์ และห้องเรียนของสาขาวิทยาการคอมพิวเตอร์ เลือกห้อง เลือกเครื่อง
            แล้วติดตามสถานะได้ทันที
          </p>
        </div>
        <a href={loginHref()} className={`${primaryButtonClass} w-full py-3`}>
          เข้าสู่ระบบผ่าน CSMJU Portal
        </a>
      </div>
    </main>
  );
}

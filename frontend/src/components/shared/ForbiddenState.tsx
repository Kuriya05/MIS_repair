import { LockIcon, secondaryButtonClass, tonalButtonClass } from '@/csmju';
import { coreHubHomeUrl } from '@/lib/config';

/** 403 FORBIDDEN (ข้อ 9.3): การ์ด "ไม่มีสิทธิ์" + ปุ่มกลับหน้าหลัก + ลิงก์ขอสิทธิ์เข้าใช้งาน */
export function ForbiddenState({
  message = 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบย่อยนี้',
  backHref = '/',
}: {
  message?: string;
  backHref?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-6 py-16 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary-container">
        <LockIcon className="h-6 w-6" />
      </span>
      <div className="max-w-md space-y-1">
        <h2 className="text-label-md text-on-surface">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-body-md text-on-surface-variant">{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <a href={backHref} className={secondaryButtonClass}>
          กลับหน้าหลัก
        </a>
        <a href={coreHubHomeUrl() ?? '/'} className={tonalButtonClass}>
          ขอสิทธิ์เข้าใช้งาน
        </a>
      </div>
    </div>
  );
}

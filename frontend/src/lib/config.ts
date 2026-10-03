/** ค่าที่หน้าเว็บเปิดเผยได้ (NEXT_PUBLIC_*) — ห้ามใส่ความลับหรือ token (ui-design-system.md ข้อ 16.1.1) */
export const SUBSYSTEM_ID = process.env.NEXT_PUBLIC_SUBSYSTEM_ID ?? 'csmju-maintenance-request';
export const DISPLAY_NAME = 'ระบบแจ้งซ่อม';
/** เว็บของ Core Hub (portal) — ใช้กับปุ่ม "กลับหน้าหลัก" เท่านั้น · การเข้า/ออกจากระบบผ่าน /auth/* ของระบบนี้ */
export const CORE_HUB_URL = (process.env.NEXT_PUBLIC_CORE_HUB_URL ?? '').replace(/\/+$/, '');

/** คุกกี้ session ของระบบนี้ = <ชื่อระบบ แทน - ด้วย _>_access_token (auth-contract.md 1.2 ข้อ 5.1) */
export const SESSION_COOKIE = `${SUBSYSTEM_ID.replace(/-/g, '_')}_access_token`;

/**
 * เข้าสู่ระบบ/ต่ออายุ: ทุกครั้งเริ่มที่ GET /auth/login ของระบบนี้ (backend สร้าง state แล้วส่งไปเว็บ Core Hub)
 * ต้องเปิดแบบ top-level navigation เท่านั้น ห้าม fetch (auth-contract.md ข้อ 5, 7)
 */
export function loginHref(next?: string) {
  return next && next !== '/' ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login';
}

/** ออกจากระบบทั้งระบบ: POST /auth/logout → backend ลบคุกกี้แล้วพาไปหน้า /logout ของ Core Hub */
export const LOGOUT_ACTION = '/auth/logout';

/** "กลับหน้าหลัก" = Dashboard ของ Core Hub (ปุ่มเดียวกันทุกระบบย่อย) */
export function coreHubHomeUrl() {
  return CORE_HUB_URL ? `${CORE_HUB_URL}/` : '/';
}

/** title ของแท็บ: <ชื่อหน้า> · <ชื่อระบบย่อย> · CSMJU (ui-design-system.md ข้อ 11.4) */
export const pageTitle = (page: string) => `${page} · ${DISPLAY_NAME} · CSMJU`;

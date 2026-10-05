/** ค่าที่หน้าเว็บเปิดเผยได้ (NEXT_PUBLIC_*) — ห้ามใส่ความลับหรือ token (ui-design-system.md ข้อ 16.1.1) */
export const SUBSYSTEM_ID = process.env.NEXT_PUBLIC_SUBSYSTEM_ID ?? 'csmju-maintenance-request';
export const DISPLAY_NAME = 'ระบบแจ้งซ่อม';
/** เว็บของ Core Hub (portal) แบบที่หน้าเว็บอ่านได้ — สำรองของ CORE_HUB_WEB_URL · การเข้า/ออกจากระบบผ่าน /auth/* ของระบบนี้ */
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

/**
 * ปุ่ม "กลับ CSMJU Portal" (ui-design-system.md 1.3.2 ข้อ 5.1) = เว็บของ Core Hub จาก env CORE_HUB_WEB_URL
 * (อ่านฝั่ง server · ห้าม hardcode) · ไม่ตั้ง = ใช้ NEXT_PUBLIC_CORE_HUB_URL เดิม · ไม่มีทั้งคู่ = ไม่แสดงปุ่ม
 */
export function coreHubHomeUrl(): string | null {
  const url = (process.env.CORE_HUB_WEB_URL ?? '').replace(/\/+$/, '') || CORE_HUB_URL;
  return url ? `${url}/` : null;
}

/** title ของแท็บ: <ชื่อหน้า> · <ชื่อระบบย่อย> · CSMJU (ui-design-system.md ข้อ 11.4) */
export const pageTitle = (page: string) => `${page} · ${DISPLAY_NAME} · CSMJU`;

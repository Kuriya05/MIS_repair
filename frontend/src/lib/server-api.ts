import { cookies } from 'next/headers';
import { SESSION_COOKIE } from './config';
import type { ErrorCode, PageMeta } from './types';

const backend = () => (process.env.BACKEND_URL ?? 'http://127.0.0.1:4221').replace(/\/+$/, '');

export type ServerResult<T> =
  | { ok: true; data: T; meta?: PageMeta }
  | { ok: false; status: number; code: ErrorCode | 'NETWORK_ERROR'; message: string };

/**
 * เรียก backend จาก Server Component โดยส่งต่อคุกกี้ session ของผู้ใช้คนนั้น (ไม่ cache ข้อมูลส่วนบุคคล)
 * คืนผลแบบ union ให้หน้าเลือกแสดงสถานะ 401/403/404 ตามตาราง error mapping เอง
 */
export async function serverApi<T>(path: string): Promise<ServerResult<T>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'ยังไม่ได้เข้าสู่ระบบ' };

  let response: Response;
  try {
    response = await fetch(`${backend()}${path}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return {
      ok: false,
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง',
    };
  }
  const payload = await response.json().catch(() => null);
  if (payload?.success === true) return { ok: true, data: payload.data as T, meta: payload.meta };
  return {
    ok: false,
    status: response.status,
    code: payload?.error?.code ?? 'INTERNAL_ERROR',
    message: payload?.error?.message ?? 'ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง',
  };
}

/** แปลง searchParams ของหน้าเป็น query string ที่ส่งต่อให้ backend ได้ (เฉพาะคีย์ที่อนุญาต) */
export function forwardQuery(
  params: Record<string, string | string[] | undefined>,
  allowed: readonly string[],
  defaults: Record<string, string> = {},
) {
  const search = new URLSearchParams(defaults);
  for (const key of allowed) {
    const value = params[key];
    const single = Array.isArray(value) ? value[0] : value;
    if (single) search.set(key, single);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

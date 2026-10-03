'use client';

import { useEffect } from 'react';
import { loginHref } from './config';

/**
 * Silent re-SSO ฝั่งหน้าเว็บ (auth-contract.md 1.2 ข้อ 7)
 *  - พาทั้งหน้าไป /auth/login?next=<หน้าปัจจุบัน> ด้วย window.location (ห้าม fetch)
 *  - กันวน: เพิ่งออกไปต่ออายุไม่ถึง 30 วินาทีแล้วยังได้ 401 อีก → ไม่ redirect ซ้ำ ให้แสดงปุ่มแทน
 *  - หน้าที่มีฟอร์มกรอกค้างห้าม redirect ทับ — ฟอร์มลงทะเบียนด้วย useUnsavedForm()
 */
const STARTED_AT_KEY = 'csmju-sso-renewed-at'; // ชื่อเดียวกับ reference (ReSignIn.tsx)
const LOOP_WINDOW_MS = 30_000;

export const currentPath = () =>
  typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`;

/** เพิ่งออกไปต่ออายุแล้วกลับมาไม่ถึง 30 วินาที */
export function reSsoJustFailed(): boolean {
  try {
    const startedAt = Number(sessionStorage.getItem(STARTED_AT_KEY) ?? 0);
    return Date.now() - startedAt < LOOP_WINDOW_MS;
  } catch {
    return false;
  }
}

/** เริ่ม re-SSO · คืน false ถ้าไม่ควร redirect (กันวน) ให้ผู้เรียกแสดงปุ่ม "เข้าสู่ระบบอีกครั้ง" */
export function startReSso(next = currentPath()): boolean {
  if (reSsoJustFailed()) return false;
  try {
    sessionStorage.setItem(STARTED_AT_KEY, String(Date.now()));
  } catch {
    // sessionStorage ใช้ไม่ได้ (private mode บางเบราว์เซอร์) — ยังพาไปได้ แต่กันวนไม่ได้
  }
  window.location.assign(loginHref(next));
  return true;
}

const dirtyForms = new Set<symbol>();

/** มีฟอร์มที่ผู้ใช้กรอกค้างอยู่ในหน้านี้ไหม */
export const hasUnsavedForm = () => dirtyForms.size > 0;

/** ฟอร์มที่กรอกค้าง (dirty = true) จะไม่ถูก redirect ทับตอน session หมด — AppShell ขึ้นแถบให้ต่ออายุในแท็บใหม่แทน */
export function useUnsavedForm(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const key = Symbol('form');
    dirtyForms.add(key);
    return () => {
      dirtyForms.delete(key);
    };
  }, [dirty]);
}

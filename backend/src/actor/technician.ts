import { SubsystemRole } from '../auth/core-hub-identity';

/** role ของระบบนี้ทั้งหมด (สำหรับ DTO/ตัวกรอง) */
export const SUBSYSTEM_ROLES = [SubsystemRole.USER, SubsystemRole.TECHNICIAN, SubsystemRole.ADMIN] as const;

/** core role 6 ค่า (standards/contracts/vocabulary.json 1.1) */
export const CORE_ROLES = ['student', 'alumni', 'staff', 'lecturer', 'guest', 'admin'] as const;

/** ช่าง = บุคลากรสายสนับสนุน (core role staff) ที่ผู้ดูแลระบบแจ้งซ่อมแต่งตั้ง */
export const TECHNICIAN_ELIGIBLE_CORE_ROLE = 'staff';

/** แยกค่า ADMIN_ACCOUNTS (อีเมลคั่นด้วย , หรือเว้นวรรค) เป็นชุดอีเมลตัวพิมพ์เล็ก */
export function parseAdminAccounts(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[\s,]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * role ที่ใช้จริง = role mapping (USER/ADMIN) + การแต่งตั้งช่างที่เก็บในระบบนี้ (Layer 2)
 * + ผู้ดูแลที่ประกาศใน ADMIN_ACCOUNTS (ทางชั่วคราวจนกว่า Core Hub จะใส่ role ของสิทธิ์พิเศษรายบุคคลใน token —
 *   subsystem-registry.md ข้อ 7 · REPORT ข้อสมมติ) — ใช้ได้เฉพาะ core role staff/lecturer ที่ระบบรับอยู่แล้ว
 * mapped = null คือ core role ที่ระบบนี้ไม่รับ
 */
export function effectiveRole(
  mapped: SubsystemRole | null,
  coreRole: string,
  isTechnician: boolean,
  isDeclaredAdmin = false,
): SubsystemRole | null {
  if (mapped === SubsystemRole.USER && isDeclaredAdmin && (coreRole === 'staff' || coreRole === 'lecturer')) {
    return SubsystemRole.ADMIN;
  }
  if (mapped === SubsystemRole.USER && isTechnician && coreRole === TECHNICIAN_ELIGIBLE_CORE_ROLE) {
    return SubsystemRole.TECHNICIAN;
  }
  return mapped;
}

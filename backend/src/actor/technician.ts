import { SubsystemRole } from '../auth/core-hub-identity';

/** role ของระบบนี้ทั้งหมด (สำหรับ DTO/ตัวกรอง) */
export const SUBSYSTEM_ROLES = [SubsystemRole.USER, SubsystemRole.TECHNICIAN, SubsystemRole.ADMIN] as const;

/** core role 6 ค่า (standards/contracts/vocabulary.json 1.1) */
export const CORE_ROLES = ['student', 'alumni', 'staff', 'lecturer', 'guest', 'admin'] as const;

/** ช่าง = บุคลากรสายสนับสนุน (core role staff) ที่ผู้ดูแลระบบแจ้งซ่อมแต่งตั้ง */
export const TECHNICIAN_ELIGIBLE_CORE_ROLE = 'staff';

/**
 * role ที่ใช้จริง = role mapping (USER/ADMIN) + การแต่งตั้งช่างที่เก็บในระบบนี้ (Layer 2)
 * mapped = null คือ core role ที่ระบบนี้ไม่รับ
 */
export function effectiveRole(
  mapped: SubsystemRole | null,
  coreRole: string,
  isTechnician: boolean,
): SubsystemRole | null {
  if (mapped === SubsystemRole.USER && isTechnician && coreRole === TECHNICIAN_ELIGIBLE_CORE_ROLE) {
    return SubsystemRole.TECHNICIAN;
  }
  return mapped;
}

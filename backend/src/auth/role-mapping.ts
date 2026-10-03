import { SubsystemRole } from './core-hub-identity';

/**
 * Core Hub role -> Subsystem role (spec §14).
 *
 *   Core Hub Role      Subsystem Role
 *   ---------------------------------
 *   student            USER     (แจ้งซ่อม)
 *   staff              USER     (ผู้ดูแลระบบแจ้งซ่อมแต่งตั้งเป็น TECHNICIAN ได้)
 *   lecturer           USER
 *   admin              ADMIN
 *   alumni · guest     —        (ไม่รับ → 403)
 *
 * ต้องตรงกับ default_role_mapping ใน subsystem.yaml และทะเบียนของ Core Hub
 */
export const CORE_ROLE_TO_SUBSYSTEM_ROLE: Readonly<Record<string, SubsystemRole>> = Object.freeze({
  student: SubsystemRole.USER,
  staff: SubsystemRole.USER,
  lecturer: SubsystemRole.USER,
  admin: SubsystemRole.ADMIN,
});

/**
 * Returns the subsystem role for a Core Hub role, or `null` when the Core Hub
 * role has no meaning in this subsystem (authenticated, but not authorized).
 */
export function mapCoreRoleToSubsystemRole(coreRole: string | undefined): SubsystemRole | null {
  if (typeof coreRole !== 'string') {
    return null;
  }
  return CORE_ROLE_TO_SUBSYSTEM_ROLE[coreRole.trim().toLowerCase()] ?? null;
}

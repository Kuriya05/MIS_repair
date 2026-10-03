/**
 * ตัวช่วยสำหรับ unit test ของโดเมนเท่านั้น (ไม่ถูก build)
 * ชั้นกลาง (auth · core-hub) ใช้ตัวช่วยของ reference ใน test/helpers/
 */
import type { RepairActor } from '../actor/repair-actor';
import { SubsystemRole } from '../auth/core-hub-identity';
import { ROLE_PERMISSIONS } from '../auth/permissions';

/** ผู้เรียกในมุมของโดเมนตาม role ที่ใช้จริง */
export function identity(role: `${SubsystemRole}`, coreUserId = `user-${role.toLowerCase()}`): RepairActor {
  const subsystemRole = role as SubsystemRole;
  return {
    coreUserId,
    personCode: coreUserId,
    email: `${coreUserId}@core.local`,
    coreRole: subsystemRole === SubsystemRole.ADMIN ? 'admin' : 'staff',
    subsystemRole,
    permissions: new Set(ROLE_PERMISSIONS[subsystemRole]),
    tokenExpiresAt: Math.floor(Date.now() / 1000) + 900,
  };
}

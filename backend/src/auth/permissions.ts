import { SubsystemRole } from './core-hub-identity';

/**
 * Subsystem permissions (spec §16) — สิทธิ์ของโดเมนแจ้งซ่อม รูปแบบ <resource>:<action>[:own|:any]
 *
 *   Core JWT -> Core Role -> Subsystem Role -> Permission -> Business Operation
 *
 * `:own` variants are scope hints: the guard lets the request through and the
 * service performs the ownership check against business data
 * (ใบแจ้งซ่อม: record.core_user_id === token.sub · งานซ่อม: assignee_core_user_id)
 */
export enum Permission {
  REPAIR_REQUEST_CREATE = 'repair-request:create',
  REPAIR_REQUEST_READ_OWN = 'repair-request:read:own',
  REPAIR_REQUEST_READ_ANY = 'repair-request:read:any',
  REPAIR_REQUEST_CANCEL_OWN = 'repair-request:cancel:own',
  REPAIR_REQUEST_RATE_OWN = 'repair-request:rate:own',
  REPAIR_REQUEST_COMMENT_OWN = 'repair-request:comment:own',
  REPAIR_REQUEST_COMMENT_ANY = 'repair-request:comment:any',
  /** "ฉันก็เจอ" — ติดตามใบแจ้งซ่อมของคนอื่นที่ยังเปิดอยู่แทนการแจ้งซ้ำ */
  REPAIR_REQUEST_FOLLOW = 'repair-request:follow',
  REPAIR_JOB_ACCEPT = 'repair-job:accept',
  REPAIR_JOB_UPDATE_OWN = 'repair-job:update:own',
  REPAIR_JOB_UPDATE_ANY = 'repair-job:update:any',
  REPAIR_JOB_ASSIGN = 'repair-job:assign',
  STATISTICS_READ = 'statistics:read',
  /** อาคาร (Core Hub) · ห้องและเครื่องที่ผู้ดูแลระบบนี้บันทึก — ทุกคนดูได้ */
  BUILDING_READ = 'building:read',
  /** เพิ่ม/แก้/ลบ ห้องและเครื่องในห้อง (รวมสติกเกอร์ QR ของแต่ละห้อง/เครื่อง) */
  ROOM_MANAGE = 'room:manage',
  CATEGORY_READ = 'category:read',
  CATEGORY_CREATE = 'category:create',
  CATEGORY_UPDATE = 'category:update',
  CATEGORY_DELETE = 'category:delete',
  /** รายชื่อบุคคลจาก Core Hub + จำนวนการแจ้งซ่อมของแต่ละคน */
  PROFILE_READ_ANY = 'profile:read:any',
  PROFILE_UPDATE_OWN = 'profile:update:own',
  /** แต่งตั้ง/ถอดถอนช่าง */
  PROFILE_UPDATE_ANY = 'profile:update:any',
  NOTIFICATION_READ_OWN = 'notification:read:own',
  NOTIFICATION_UPDATE_OWN = 'notification:update:own',
}

const P = Permission;

/** ผู้แจ้งซ่อม (นักศึกษา / บุคลากร / อาจารย์) */
const USER_PERMISSIONS: Permission[] = [
  P.REPAIR_REQUEST_CREATE,
  P.REPAIR_REQUEST_READ_OWN,
  P.REPAIR_REQUEST_CANCEL_OWN,
  P.REPAIR_REQUEST_RATE_OWN,
  P.REPAIR_REQUEST_COMMENT_OWN,
  P.REPAIR_REQUEST_FOLLOW,
  P.BUILDING_READ,
  P.CATEGORY_READ,
  P.PROFILE_UPDATE_OWN,
  P.NOTIFICATION_READ_OWN,
  P.NOTIFICATION_UPDATE_OWN,
];

/** ช่างซ่อมบำรุง — ยังแจ้งซ่อมได้ + เห็นคิวงานทั้งหมด รับงาน และอัปเดตงานที่ตัวเองรับผิดชอบ */
const TECHNICIAN_PERMISSIONS: Permission[] = [
  ...USER_PERMISSIONS,
  P.REPAIR_REQUEST_READ_ANY,
  P.REPAIR_REQUEST_COMMENT_ANY,
  P.REPAIR_JOB_ACCEPT,
  P.REPAIR_JOB_UPDATE_OWN,
  P.STATISTICS_READ,
];

/** ผู้ดูแลระบบแจ้งซ่อม — จัดการงานและข้อมูลหลัก · ไม่ได้เป็นผู้แจ้งซ่อม (ไม่มี create/follow/cancel/rate) */
const ADMIN_PERMISSIONS: Permission[] = [
  P.REPAIR_REQUEST_READ_ANY,
  P.REPAIR_REQUEST_COMMENT_ANY,
  P.REPAIR_JOB_ACCEPT,
  P.REPAIR_JOB_UPDATE_ANY,
  P.REPAIR_JOB_ASSIGN,
  P.STATISTICS_READ,
  P.BUILDING_READ,
  P.ROOM_MANAGE,
  P.CATEGORY_READ,
  P.CATEGORY_CREATE,
  P.CATEGORY_UPDATE,
  P.CATEGORY_DELETE,
  P.PROFILE_READ_ANY,
  P.PROFILE_UPDATE_OWN,
  P.PROFILE_UPDATE_ANY,
  P.NOTIFICATION_READ_OWN,
  P.NOTIFICATION_UPDATE_OWN,
];

export const ROLE_PERMISSIONS: Readonly<Record<SubsystemRole, readonly Permission[]>> = Object.freeze({
  [SubsystemRole.USER]: Object.freeze(USER_PERMISSIONS),
  [SubsystemRole.TECHNICIAN]: Object.freeze(TECHNICIAN_PERMISSIONS),
  [SubsystemRole.ADMIN]: Object.freeze(ADMIN_PERMISSIONS),
});

/** Does this subsystem role hold the given permission? */
export function can(role: SubsystemRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Does this subsystem role hold at least one of the given permissions? */
export function canAny(role: SubsystemRole, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

import type { Request } from 'express';
import type { SubsystemRole } from '../auth/core-hub-identity';
import type { Permission } from '../auth/permissions';

/**
 * ผู้เรียกในมุมของโดเมนแจ้งซ่อม — สร้างจาก CoreHubIdentity ที่ชั้นกลางตรวจแล้ว (request.user)
 * + ข้อมูล Layer 2 ของระบบนี้ (การแต่งตั้งช่าง · person_code) โดย RepairActorGuard
 */
export type RepairActor = {
  /** claim `sub` */
  coreUserId: string;
  /** รหัสบุคคลจาก GET /people/me (null = บัญชียังไม่ผูกกับทะเบียนบุคคล) */
  personCode: string | null;
  /** จาก token — แสดงผลเท่านั้น ไม่ใช่กุญแจ และไม่เก็บลงฐาน */
  email: string;
  coreRole: string;
  /** role ที่ใช้จริง: USER/ADMIN จาก role mapping หรือ TECHNICIAN เมื่อผู้ดูแลแต่งตั้ง */
  subsystemRole: SubsystemRole;
  permissions: ReadonlySet<Permission>;
  /** exp ของ token (epoch seconds) */
  tokenExpiresAt: number;
};

export type RequestWithActor = Request & { repairActor?: RepairActor };

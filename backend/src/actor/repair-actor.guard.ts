import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import '../core-hub/express-request';
import { ROLE_PERMISSIONS } from '../auth/permissions';
import { ProfilesService } from '../profiles/profiles.service';
import type { RequestWithActor } from './repair-actor';
import { effectiveRole } from './technician';

/**
 * Layer 2 ของโดเมนแจ้งซ่อม — วางระหว่าง CoreHubJwtGuard กับ PermissionsGuard ของชั้นกลาง (app.module.ts)
 *  1. บันทึก/อัปเดตโปรไฟล์ของผู้ใช้ (core_user_id · core_role · person_code จาก /people/me ครั้งแรก)
 *  2. ถ้าผู้ดูแลแต่งตั้งบุคลากรคนนี้เป็นช่าง ยก request.user.subsystemRole เป็น TECHNICIAN
 *     แล้ว PermissionsGuard ของชั้นกลางจึงตรวจสิทธิ์ตาม role ที่ใช้จริง
 *  3. แนบ request.repairActor ให้ service ใช้ (@CurrentActor)
 * ไม่ตรวจ token เอง — ทำงานต่อจาก identity ที่ชั้นกลางตรวจแล้วเท่านั้น
 */
@Injectable()
export class RepairActorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly profiles: ProfilesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<RequestWithActor & { user?: CoreHubIdentity }>();
    const user = request.user;
    if (isPublic || !user || !request.coreHubAccessToken) return true;

    const profile = await this.profiles.touch(user, request.coreHubAccessToken);
    const role = effectiveRole(user.subsystemRole, user.coreRole, profile.isTechnician) ?? user.subsystemRole;
    user.subsystemRole = role;

    request.repairActor = {
      coreUserId: user.id,
      personCode: profile.personCode,
      email: user.email,
      coreRole: user.coreRole,
      subsystemRole: role,
      permissions: new Set(ROLE_PERMISSIONS[role]),
      tokenExpiresAt: user.exp ?? Math.floor(Date.now() / 1000),
    };
    return true;
  }
}

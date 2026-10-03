import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { unauthorized } from '../shared/errors';
import type { RepairActor, RequestWithActor } from './repair-actor';

/** ผู้เรียกในมุมของโดเมน (RepairActorGuard แนบไว้) — ไม่มี = ยังไม่ได้ยืนยันตัวตน → 401 */
export const CurrentActor = createParamDecorator((_: unknown, context: ExecutionContext): RepairActor => {
  const actor = context.switchToHttp().getRequest<RequestWithActor>().repairActor;
  if (!actor) throw unauthorized();
  return actor;
});

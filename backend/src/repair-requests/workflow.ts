import type { RequestStatus } from '../../generated/prisma/enums';
import type { RepairActor } from '../actor/repair-actor';
import { Permission } from '../auth/permissions';
import { conflict, forbidden } from '../shared/errors';
import { isOpen } from './sla';

/**
 * กฎธุรกิจของใบแจ้งซ่อม — ใครทำอะไรได้ (403) และสถานะไหนทำอะไรได้ (409)
 * เป็นฟังก์ชันล้วน ไม่แตะฐานข้อมูล จึงทดสอบได้ครบใน unit test
 *
 *   PENDING ──accept/assign──► ACCEPTED ──start──► IN_PROGRESS ──complete──► COMPLETED ──rate
 *      │                          │  └──complete (ซ่อมเสร็จทันที)            │  ▲
 *      │                          │                                  hold ▼  │ start
 *      ├──cancel (ผู้แจ้ง)◄────────┘                                   ON_HOLD
 *      └──reject (ช่าง/ผู้ดูแล) — ได้จากทุกสถานะที่ยังเปิดอยู่
 */
export const REQUEST_ACTIONS = [
  'comment',
  'cancel',
  'accept',
  'assign',
  'edit',
  'start',
  'hold',
  'complete',
  'reject',
  'rate',
] as const;
export type RequestAction = (typeof REQUEST_ACTIONS)[number];

/** สถานะปลายทางที่ POST /repair-requests/:id/status รับ */
export const STATUS_TARGETS = ['IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'REJECTED'] as const;
export type StatusTarget = (typeof STATUS_TARGETS)[number];

export const ACTION_FOR_STATUS: Record<StatusTarget, RequestAction> = {
  IN_PROGRESS: 'start',
  ON_HOLD: 'hold',
  COMPLETED: 'complete',
  REJECTED: 'reject',
};

/** สถานะต้นทางที่เปลี่ยนไปยังสถานะปลายทางได้ */
const TRANSITIONS: Record<StatusTarget, readonly RequestStatus[]> = {
  IN_PROGRESS: ['ACCEPTED', 'ON_HOLD'],
  ON_HOLD: ['IN_PROGRESS'],
  COMPLETED: ['ACCEPTED', 'IN_PROGRESS'],
  REJECTED: ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'],
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: 'รอรับเรื่อง',
  ACCEPTED: 'รับเรื่องแล้ว',
  IN_PROGRESS: 'กำลังดำเนินการ',
  ON_HOLD: 'รออะไหล่/พักงาน',
  COMPLETED: 'ซ่อมเสร็จ',
  REJECTED: 'ไม่สามารถดำเนินการได้',
  CANCELLED: 'ยกเลิกแล้ว',
};

export type WorkflowSubject = {
  status: RequestStatus;
  coreUserId: string;
  assigneeCoreUserId: string | null;
  rating: number | null;
};

type Actor = Pick<RepairActor, 'coreUserId' | 'permissions'>;

const has = (actor: Actor, permission: Permission) => actor.permissions.has(permission);
const isOwner = (actor: Actor, request: WorkflowSubject) => request.coreUserId === actor.coreUserId;
const isAssignee = (actor: Actor, request: WorkflowSubject) =>
  request.assigneeCoreUserId === actor.coreUserId;
const updatesJob = (actor: Actor, request: WorkflowSubject) =>
  has(actor, Permission.REPAIR_JOB_UPDATE_ANY) ||
  (isAssignee(actor, request) && has(actor, Permission.REPAIR_JOB_UPDATE_OWN));

/** อ่านใบแจ้งซ่อมนี้ได้ไหม (:own = ผู้แจ้งเอง) */
export function canRead(actor: Actor, request: WorkflowSubject) {
  return (
    has(actor, Permission.REPAIR_REQUEST_READ_ANY) ||
    (has(actor, Permission.REPAIR_REQUEST_READ_OWN) && isOwner(actor, request))
  );
}

/**
 * "ฉันก็เจอ" ได้ไหม — ไม่ใช่ผู้แจ้งเอง · ใบยังเปิดอยู่ · ยังไม่ได้กด
 * (ผู้ติดตามอ่านใบนั้นได้และได้รับการแจ้งเตือนเหมือนผู้แจ้ง แต่ทำ action ของผู้แจ้งไม่ได้)
 */
export function canFollow(
  actor: Actor,
  request: Pick<WorkflowSubject, 'status' | 'coreUserId'>,
  alreadyFollowing: boolean,
) {
  return (
    has(actor, Permission.REPAIR_REQUEST_FOLLOW) &&
    request.coreUserId !== actor.coreUserId &&
    isOpen(request.status) &&
    !alreadyFollowing
  );
}

/** มีสิทธิ์ทำ action นี้กับใบนี้ไหม โดยยังไม่ดูสถานะ — false = 403 */
export function mayAct(actor: Actor, request: WorkflowSubject, action: RequestAction): boolean {
  switch (action) {
    case 'comment':
      return isOwner(actor, request)
        ? has(actor, Permission.REPAIR_REQUEST_COMMENT_OWN)
        : has(actor, Permission.REPAIR_REQUEST_COMMENT_ANY);
    case 'cancel':
      return isOwner(actor, request) && has(actor, Permission.REPAIR_REQUEST_CANCEL_OWN);
    case 'accept':
      return has(actor, Permission.REPAIR_JOB_ACCEPT);
    case 'assign':
      return has(actor, Permission.REPAIR_JOB_ASSIGN);
    case 'edit':
    case 'start':
    case 'hold':
    case 'complete':
      return updatesJob(actor, request);
    case 'reject':
      // งานที่ยังไม่มีใครรับ ช่างคนใดก็ปฏิเสธได้ (เช่น แจ้งซ้ำ / ไม่ใช่งานซ่อม)
      return (
        updatesJob(actor, request) ||
        (request.status === 'PENDING' && has(actor, Permission.REPAIR_JOB_ACCEPT))
      );
    case 'rate':
      return isOwner(actor, request) && has(actor, Permission.REPAIR_REQUEST_RATE_OWN);
  }
}

/** สถานะตอนนี้ทำ action นี้ได้ไหม — false = 409 */
export function stateAllows(request: WorkflowSubject, action: RequestAction): boolean {
  switch (action) {
    case 'comment':
      return request.status !== 'CANCELLED';
    case 'cancel':
      return request.status === 'PENDING' || request.status === 'ACCEPTED';
    case 'accept':
      return request.status === 'PENDING';
    case 'assign':
    case 'edit':
      return isOpen(request.status);
    case 'start':
      return TRANSITIONS.IN_PROGRESS.includes(request.status);
    case 'hold':
      return TRANSITIONS.ON_HOLD.includes(request.status);
    case 'complete':
      return TRANSITIONS.COMPLETED.includes(request.status);
    case 'reject':
      return TRANSITIONS.REJECTED.includes(request.status);
    case 'rate':
      return request.status === 'COMPLETED' && request.rating === null;
  }
}

/** action ที่ผู้ใช้คนนี้ทำได้ตอนนี้ — frontend ใช้เลือกปุ่มที่จะแสดง */
export function allowedActions(actor: Actor, request: WorkflowSubject): RequestAction[] {
  if (!canRead(actor, request)) return [];
  return REQUEST_ACTIONS.filter((action) => mayAct(actor, request, action) && stateAllows(request, action));
}

const FORBIDDEN_MESSAGE: Record<RequestAction, string> = {
  comment: 'คุณไม่มีสิทธิ์แสดงความคิดเห็นในใบแจ้งซ่อมนี้',
  cancel: 'ยกเลิกได้เฉพาะผู้แจ้งซ่อมเท่านั้น',
  accept: 'รับงานได้เฉพาะช่างซ่อมบำรุง',
  assign: 'มอบหมายงานได้เฉพาะผู้ดูแลระบบแจ้งซ่อม',
  edit: 'แก้ไขงานได้เฉพาะช่างผู้รับผิดชอบหรือผู้ดูแลระบบ',
  start: 'อัปเดตงานได้เฉพาะช่างผู้รับผิดชอบหรือผู้ดูแลระบบ',
  hold: 'อัปเดตงานได้เฉพาะช่างผู้รับผิดชอบหรือผู้ดูแลระบบ',
  complete: 'ปิดงานได้เฉพาะช่างผู้รับผิดชอบหรือผู้ดูแลระบบ',
  reject: 'ปฏิเสธงานได้เฉพาะช่างผู้รับผิดชอบหรือผู้ดูแลระบบ',
  rate: 'ให้คะแนนได้เฉพาะผู้แจ้งซ่อมเท่านั้น',
};

const CONFLICT_MESSAGE: Record<RequestAction, (status: string, request: WorkflowSubject) => string> = {
  comment: () => 'ใบแจ้งซ่อมนี้ถูกยกเลิกแล้ว จึงแสดงความคิดเห็นเพิ่มไม่ได้',
  cancel: (status) =>
    `ใบแจ้งซ่อมอยู่ในสถานะ “${status}” แล้ว จึงยกเลิกไม่ได้ หากมีปัญหาให้แสดงความคิดเห็นถึงช่าง`,
  accept: (status) => `งานนี้อยู่ในสถานะ “${status}” แล้ว — อาจมีช่างคนอื่นรับไปก่อนหน้านี้`,
  assign: (status) => `งานที่อยู่ในสถานะ “${status}” มอบหมายใหม่ไม่ได้`,
  edit: (status) => `งานที่อยู่ในสถานะ “${status}” แก้ไขไม่ได้แล้ว`,
  start: (status) => `เริ่มหรือกลับมาดำเนินการจากสถานะ “${status}” ไม่ได้`,
  hold: (status) => `พักงานได้เฉพาะงานที่กำลังดำเนินการ (ตอนนี้: “${status}”)`,
  complete: (status) => `ปิดงานจากสถานะ “${status}” ไม่ได้ — ต้องรับงานก่อน`,
  reject: (status) => `งานที่อยู่ในสถานะ “${status}” ปฏิเสธไม่ได้แล้ว`,
  rate: (status, request) =>
    request.rating !== null
      ? 'คุณให้คะแนนงานนี้ไปแล้ว'
      : `ให้คะแนนได้เมื่อซ่อมเสร็จแล้ว (ตอนนี้: “${status}”)`,
};

/** ตรวจสิทธิ์ก่อน (403) แล้วจึงตรวจสถานะ (409) — authorization.md ข้อ 8 */
export function assertCan(actor: Actor, request: WorkflowSubject, action: RequestAction) {
  if (!mayAct(actor, request, action)) throw forbidden(FORBIDDEN_MESSAGE[action]);
  if (!stateAllows(request, action)) {
    throw conflict(CONFLICT_MESSAGE[action](STATUS_LABEL[request.status], request));
  }
}

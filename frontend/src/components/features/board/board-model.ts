import type { ComponentType } from 'react';
import {
  AssignmentIcon,
  BuildIcon,
  CheckCircleIcon,
  InboxIcon,
  PauseIcon,
  PlayIcon,
  type IconProps,
} from '@/csmju';
import { floorLabel } from '@/lib/format';
import type { RepairRequestSummary, RequestAction, RequestStatus } from '@/lib/types';

/** สถานะที่แสดงบนบอร์ด (เรียงตาม workflow) */
export type BoardStatus = 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';

export type Move = { card: RepairRequestSummary; to: RequestStatus; action: RequestAction };
export type BuildingOption = { code: string; name: string };
export type BoardView = 'list' | 'columns';

/** ลิงก์ของบอร์ดที่คง ?mine และ ?view ไว้ด้วยกัน (มุมมองแบบหัวข้อเป็นค่าเริ่มต้น จึงไม่ใส่ใน URL) */
export function boardHref({ mine, view }: { mine: boolean; view: BoardView }) {
  const params = new URLSearchParams();
  if (view === 'columns') params.set('view', 'columns');
  if (mine) params.set('mine', '1');
  const query = params.toString();
  return query ? `/board?${query}` : '/board';
}

/**
 * ข้อมูลแสดงผลของแต่ละสถานะบนบอร์ด — ป้ายสั้น + ไอคอน + สีเน้น (มีข้อความ/ไอคอนกำกับเสมอ ไม่สื่อด้วยสีอย่างเดียว)
 * action = การกระทำของ workflow ที่ย้ายงานเข้าสถานะนี้ (backend ตรวจสิทธิ์/สถานะซ้ำเสมอ)
 * accent = แถบสีด้านข้าง/ด้านบน · soft = พื้นอ่อนของไอคอน · ink = สีตัวอักษรบนพื้นอ่อน
 */
export const BOARD_STATUSES: {
  status: BoardStatus;
  label: string;
  hint: string;
  icon: ComponentType<IconProps>;
  action: RequestAction | null;
  drop: string;
  empty: string;
  accent: string;
  soft: string;
  ink: string;
}[] = [
  {
    status: 'PENDING',
    label: 'รอรับเรื่อง',
    hint: 'งานใหม่ที่ยังไม่มีช่างรับ',
    icon: InboxIcon,
    action: null,
    drop: '',
    empty: 'ไม่มีงานรอรับเรื่อง',
    accent: 'bg-amber-500',
    soft: 'bg-amber-100',
    ink: 'text-amber-800',
  },
  {
    status: 'ACCEPTED',
    label: 'รับเรื่องแล้ว',
    hint: 'มีช่างรับแล้ว ยังไม่เริ่มซ่อม',
    icon: AssignmentIcon,
    action: 'accept',
    drop: 'วางที่นี่ = รับเรื่อง',
    empty: 'ลากงานที่รอรับมาไว้ที่นี่',
    accent: 'bg-chart-2',
    soft: 'bg-chart-2/15',
    ink: 'text-sky-800',
  },
  {
    status: 'IN_PROGRESS',
    label: 'กำลังซ่อม',
    hint: 'ช่างกำลังดำเนินการ',
    icon: BuildIcon,
    action: 'start',
    drop: 'วางที่นี่ = เริ่ม/ซ่อมต่อ',
    empty: 'ยังไม่มีงานที่กำลังซ่อม',
    accent: 'bg-primary-container',
    soft: 'bg-primary-container/10',
    ink: 'text-primary-container',
  },
  {
    status: 'ON_HOLD',
    label: 'รออะไหล่',
    hint: 'พักงานไว้ชั่วคราว',
    icon: PauseIcon,
    action: 'hold',
    drop: 'วางที่นี่ = รออะไหล่/พักงาน',
    empty: 'ไม่มีงานที่พักไว้',
    accent: 'bg-chart-4',
    soft: 'bg-chart-4/15',
    ink: 'text-violet-800',
  },
  {
    status: 'COMPLETED',
    label: 'ซ่อมเสร็จ',
    hint: 'งานที่ปิดล่าสุด',
    icon: CheckCircleIcon,
    action: 'complete',
    drop: 'วางที่นี่ = ปิดงาน',
    empty: 'ยังไม่มีงานที่ปิดล่าสุด',
    accent: 'bg-success',
    soft: 'bg-success/10',
    ink: 'text-emerald-700',
  },
];

export const metaOf = (status: RequestStatus) => BOARD_STATUSES.find((s) => s.status === status);

/** "ซ่อมเสร็จ" แสดงเฉพาะงานที่ปิดล่าสุด กดดูทั้งหมดได้ */
export const DONE_PREVIEW = 5;

/** สถานะที่การ์ดย้ายไปได้ตาม allowedActions ของผู้ใช้ (ไม่รวมสถานะปัจจุบัน) */
export const targetsOf = (card: RepairRequestSummary) =>
  BOARD_STATUSES.filter(
    (column) => column.action && card.allowedActions.includes(column.action) && column.status !== card.status,
  );

/** ปุ่มขั้นถัดไปบนแถวงาน — เรียงตามสิ่งที่ควรทำก่อน ปุ่มแรกคือปุ่มหลัก */
const NEXT_STEP_ORDER: RequestAction[] = ['accept', 'start', 'complete', 'hold'];

export type NextStep = {
  action: RequestAction;
  to: BoardStatus;
  label: string;
  icon: ComponentType<IconProps>;
};

export function nextStepsOf(card: RepairRequestSummary): NextStep[] {
  const steps: NextStep[] = [];
  for (const action of NEXT_STEP_ORDER) {
    const column = BOARD_STATUSES.find((c) => c.action === action);
    if (!column || !card.allowedActions.includes(action) || card.status === column.status) continue;
    const label =
      action === 'accept'
        ? 'รับเรื่อง'
        : action === 'start'
          ? card.status === 'ON_HOLD'
            ? 'ซ่อมต่อ'
            : 'เริ่มซ่อม'
          : action === 'hold'
            ? 'รออะไหล่'
            : 'ปิดงาน';
    const icon =
      action === 'accept'
        ? AssignmentIcon
        : action === 'start'
          ? PlayIcon
          : action === 'hold'
            ? PauseIcon
            : CheckCircleIcon;
    steps.push({ action, to: column.status, label, icon });
  }
  return steps;
}

/** ชื่อหลักของงาน — "PC-05 · Dell OptiPlex" ถ้าผูกกับเครื่อง ไม่งั้นเป็นสิ่งที่ผู้แจ้งพิมพ์ */
export const titleOf = (card: RepairRequestSummary) =>
  card.item ? `${card.item.label} · ${card.item.name}` : card.equipment;

/** บรรทัดสถานที่ — "LAB1 ห้องปฏิบัติการคอมพิวเตอร์ 1 · ชั้น 6 · อาคาร…" */
export const roomLineOf = (card: RepairRequestSummary) =>
  [
    card.room ? `${card.room.code} ${card.room.name}` : card.location,
    floorLabel(card.floor),
    card.building.name,
  ]
    .filter(Boolean)
    .join(' · ');

/** บรรทัดอาการที่แจ้ง (ย่อจาก backend) · ว่างจึงใช้หมวดหมู่แทน */
export function symptomOf(card: RepairRequestSummary) {
  return card.descriptionExcerpt.trim() || card.category.name;
}

/** ข้อความที่ใช้ค้นหาในเครื่อง */
export const searchText = (card: RepairRequestSummary) =>
  [
    card.code,
    card.equipment,
    card.descriptionExcerpt,
    card.location,
    card.building.name,
    card.building.code,
    card.room?.code,
    card.room?.name,
    card.item?.label,
    card.item?.name,
    card.category.name,
    card.assignee?.displayName,
    card.reporter.displayName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

/** งานที่ปิดแล้วเรียงจากปิดล่าสุด */
export const byLatestDone = (a: RepairRequestSummary, b: RepairRequestSummary) =>
  new Date(b.completedAt ?? b.updatedAt).getTime() - new Date(a.completedAt ?? a.updatedAt).getTime();

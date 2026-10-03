/** คำเรียกภาษาไทยของค่าที่มาจาก API (ค่าจริงยังเป็นภาษาอังกฤษตาม OpenAPI) */
import type {
  CategoryIcon as CategoryIconName,
  EquipmentState,
  Priority,
  RequestAction,
  RequestStatus,
  RoomType,
  SlaState,
  SubsystemRole,
} from './types';

export type Tone = 'success' | 'info' | 'warning' | 'error' | 'neutral';

export const STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: 'รอรับเรื่อง',
  ACCEPTED: 'รับเรื่องแล้ว',
  IN_PROGRESS: 'กำลังดำเนินการ',
  ON_HOLD: 'รออะไหล่/พักงาน',
  COMPLETED: 'ซ่อมเสร็จ',
  REJECTED: 'ดำเนินการไม่ได้',
  CANCELLED: 'ยกเลิกแล้ว',
};

export const STATUS_TONE: Record<RequestStatus, Tone> = {
  PENDING: 'warning',
  ACCEPTED: 'info',
  IN_PROGRESS: 'info',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  REJECTED: 'error',
  CANCELLED: 'neutral',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: 'ด่วนมาก',
  HIGH: 'ด่วน',
  MEDIUM: 'ปกติ',
  LOW: 'ไม่เร่งด่วน',
};

export const PRIORITY_HINT: Record<Priority, string> = {
  URGENT: 'อันตราย/กระทบการเรียนการสอนทันที — เป้าหมาย 4 ชั่วโมง',
  HIGH: 'ใช้งานไม่ได้และไม่มีของทดแทน — เป้าหมาย 1 วัน',
  MEDIUM: 'ใช้งานได้บางส่วน — เป้าหมาย 3 วัน',
  LOW: 'ปรับปรุงเล็กน้อย — เป้าหมาย 7 วัน',
};

/** สีเฉพาะระดับที่ต้องรีบ — ปกติ/ไม่เร่งด่วนเป็นสีเทา (ตรงกับ PriorityTag) */
export const PRIORITY_TONE: Record<Priority, Tone> = {
  URGENT: 'error',
  HIGH: 'warning',
  MEDIUM: 'neutral',
  LOW: 'neutral',
};

export const PRIORITIES: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
export const STATUSES: RequestStatus[] = [
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

export const SLA_LABEL: Record<SlaState, string> = {
  ON_TRACK: 'ทันกำหนด',
  AT_RISK: 'ใกล้ครบกำหนด',
  OVERDUE: 'เกินกำหนด',
  MET: 'เสร็จทันกำหนด',
  MISSED: 'เสร็จช้ากว่ากำหนด',
  CLOSED: 'ปิดงานแล้ว',
};

/** คำเรียก core role มาตรฐาน (ui-design-system.md ข้อ 10.3 — ห้ามแปลเอง) */
export const CORE_ROLE_LABEL: Record<string, string> = {
  student: 'นักศึกษา',
  alumni: 'ศิษย์เก่า',
  staff: 'บุคลากร/อาจารย์',
  admin: 'ผู้ดูแลระบบ',
};

export const SUBSYSTEM_ROLE_LABEL: Record<SubsystemRole, string> = {
  USER: 'ผู้แจ้งซ่อม',
  TECHNICIAN: 'ช่างซ่อมบำรุง',
  ADMIN: 'ผู้ดูแลระบบแจ้งซ่อม',
};

export const ACTION_LABEL: Record<RequestAction, string> = {
  comment: 'แสดงความคิดเห็น',
  cancel: 'ยกเลิกใบแจ้งซ่อม',
  accept: 'รับงานนี้',
  assign: 'มอบหมายช่าง',
  edit: 'แก้ไขความเร่งด่วน/หมวดหมู่',
  start: 'เริ่มดำเนินการ',
  hold: 'พักงาน/รออะไหล่',
  complete: 'ปิดงาน (ซ่อมเสร็จ)',
  reject: 'แจ้งว่าดำเนินการไม่ได้',
  rate: 'ให้คะแนนความพึงพอใจ',
};

/* ----------------------------------------------------- ห้องและเครื่อง --- */

/** สถานะของเครื่องในห้อง (คำนวณจากใบแจ้งซ่อมที่ยังไม่ปิดของเครื่องนั้น) */
export const EQUIPMENT_STATE_LABEL: Record<EquipmentState, string> = {
  OK: 'ใช้งานได้',
  REPORTED: 'แจ้งแล้ว รอช่าง',
  IN_PROGRESS: 'กำลังซ่อม',
  ON_HOLD: 'รออะไหล่',
};

export const EQUIPMENT_STATE_TONE: Record<EquipmentState, Tone> = {
  OK: 'success',
  REPORTED: 'warning',
  IN_PROGRESS: 'info',
  ON_HOLD: 'warning',
};

export const EQUIPMENT_STATES: EquipmentState[] = ['OK', 'REPORTED', 'IN_PROGRESS', 'ON_HOLD'];

/** ชื่อเรียกของไอคอนประเภทอุปกรณ์ */
export const CATEGORY_ICON_LABEL: Record<CategoryIconName, string> = {
  computer: 'คอมพิวเตอร์',
  monitor: 'จอภาพ',
  projector: 'โปรเจกเตอร์',
  aircon: 'เครื่องปรับอากาศ',
  fan: 'พัดลม',
  light: 'ไฟฟ้า/แสงสว่าง',
  network: 'เครือข่าย',
  audio: 'เครื่องเสียง',
  furniture: 'เฟอร์นิเจอร์',
  other: 'อื่น ๆ',
};

/* ---------------------------------------------------------- ประเภทห้อง --- */

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  LAB: 'ห้องปฏิบัติการคอมพิวเตอร์',
  LECTURE: 'ห้องบรรยายคอมพิวเตอร์',
  NETWORK_LAB: 'ห้องปฏิบัติการเครือข่าย',
  MEETING: 'ห้องประชุม',
  OFFICE: 'ห้องพัก/สำนักงาน',
  OTHER: 'อื่นๆ',
};

/** ป้ายสั้นบนการ์ดห้อง (แบบหน้า Facilities ของสาขา) */
export const ROOM_TYPE_SHORT: Record<RoomType, string> = {
  LAB: 'ห้องปฏิบัติการ',
  LECTURE: 'ห้องบรรยาย',
  NETWORK_LAB: 'ห้องปฏิบัติการ',
  MEETING: 'ห้องประชุม',
  OFFICE: 'สำนักงาน',
  OTHER: 'อื่นๆ',
};

/** ลำดับหัวข้อของหน้าอาคาร (ห้องเรียน/แล็บก่อน ห้องอื่นไว้ท้าย) */
export const ROOM_TYPE_ORDER: RoomType[] = ['LAB', 'NETWORK_LAB', 'LECTURE', 'MEETING', 'OFFICE', 'OTHER'];

/**
 * สีของประเภทห้อง — pill = ป้ายประเภทบนการ์ด · panel = พื้นแทนรูปเมื่อห้องยังไม่มีรูป
 * ป้ายมีข้อความกำกับเสมอ สีเป็นแค่ตัวช่วยแยกกลุ่ม
 */
export const ROOM_TYPE_TONE: Record<RoomType, { pill: string; panel: string }> = {
  LAB: {
    pill: 'bg-primary-container/10 text-primary-container',
    panel: 'bg-primary-fixed text-primary-container',
  },
  NETWORK_LAB: { pill: 'bg-chart-4/15 text-violet-800', panel: 'bg-chart-4/15 text-violet-800' },
  LECTURE: { pill: 'bg-chart-3/15 text-teal-800', panel: 'bg-chart-3/15 text-teal-800' },
  MEETING: { pill: 'bg-amber-100 text-amber-800', panel: 'bg-amber-100 text-amber-800' },
  OFFICE: { pill: 'bg-chart-2/15 text-sky-800', panel: 'bg-chart-2/15 text-sky-800' },
  OTHER: {
    pill: 'bg-surface-variant text-on-surface-variant',
    panel: 'bg-surface-container text-on-surface-variant',
  },
};

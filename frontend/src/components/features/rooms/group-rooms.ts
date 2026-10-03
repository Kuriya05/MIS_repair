import { ROOM_TYPE_ORDER } from '@/lib/labels';
import type { Room } from '@/lib/types';

/** จัดห้องเป็นหัวข้อตามประเภทห้อง (ตาม ROOM_TYPE_ORDER ข้ามประเภทที่ไม่มีห้อง) แล้วเรียงชั้น → รหัสห้อง */
export function groupRoomsByType(rooms: Room[]) {
  const byFloorThenCode = (a: Room, b: Room) =>
    (a.floor ?? Number.MAX_SAFE_INTEGER) - (b.floor ?? Number.MAX_SAFE_INTEGER) ||
    a.code.localeCompare(b.code, 'th', { numeric: true });
  return ROOM_TYPE_ORDER.map((type) => ({
    type,
    rooms: rooms.filter((room) => room.roomType === type).sort(byFloorThenCode),
  })).filter((group) => group.rooms.length > 0);
}

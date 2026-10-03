/**
 * ข้อมูลตั้งต้นของระบบแจ้งซ่อม: หมวดหมู่งานซ่อม = ประเภทอุปกรณ์ของสาขาวิทยาการคอมพิวเตอร์ (รันซ้ำได้)
 *
 *   pnpm --filter backend db:seed
 *
 * - หมวดที่อยู่ในรายการ: สร้างใหม่หรืออัปเดตอาการ/ไอคอน/ลำดับ · หมวดเดิมที่ไม่อยู่ในรายการถูกปิดใช้งาน (ไม่ลบ)
 * - ห้องของสาขา 8 ห้อง (สร้างเฉพาะที่ยังไม่มี) · อุปกรณ์ในห้องผู้ดูแลระบบเพิ่มเองในหน้าห้อง · อาคารมาจาก Core Hub
 * - ไม่มีบัญชีผู้ใช้และไม่มีข้อมูลจำลอง — ผู้ใช้มาจาก Core Hub และถูกสร้างโปรไฟล์ตอนเข้าใช้งานครั้งแรก
 */
import { randomInt } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../generated/prisma/client';

config({ path: ['.env', '../.env'] });

type Seed = { name: string; icon: string; symptoms: string[] };

export const CATEGORIES: Seed[] = [
  {
    name: 'คอมพิวเตอร์',
    icon: 'computer',
    symptoms: [
      'เปิดไม่ติด',
      'จอไม่แสดงภาพ',
      'ช้า / ค้างบ่อย',
      'เข้าอินเทอร์เน็ตไม่ได้',
      'คีย์บอร์ด / เมาส์ไม่ทำงาน',
      'โปรแกรมที่ใช้เรียนเปิดไม่ได้',
      'มีเสียงดังผิดปกติ',
    ],
  },
  {
    name: 'จอภาพ',
    icon: 'monitor',
    symptoms: ['ไม่มีภาพ', 'ภาพกระพริบ', 'มีเส้น / จุดบนจอ', 'สีเพี้ยน', 'สายจอหลวม / หาย'],
  },
  {
    name: 'โปรเจกเตอร์',
    icon: 'projector',
    symptoms: ['เปิดไม่ติด', 'ภาพไม่ขึ้น', 'ภาพมัว / สีเพี้ยน', 'ต่อสาย HDMI แล้วไม่ขึ้น', 'รีโมทใช้ไม่ได้'],
  },
  {
    name: 'เครื่องปรับอากาศ',
    icon: 'aircon',
    symptoms: ['ไม่เย็น', 'มีน้ำหยด', 'มีเสียงดัง', 'เปิดไม่ติด', 'รีโมทหาย / ใช้ไม่ได้'],
  },
  { name: 'พัดลม', icon: 'fan', symptoms: ['ไม่หมุน', 'หมุนช้า', 'มีเสียงดัง', 'ส่ายไม่ได้'] },
  {
    name: 'ไฟฟ้า / แสงสว่าง',
    icon: 'light',
    symptoms: ['หลอดไฟดับ', 'ไฟกระพริบ', 'ปลั๊กไฟใช้ไม่ได้', 'สวิตช์เสีย', 'มีกลิ่นไหม้ / ประกายไฟ'],
  },
  {
    name: 'เครือข่าย / Wi-Fi',
    icon: 'network',
    symptoms: ['Wi-Fi ต่อไม่ได้', 'สาย LAN ใช้ไม่ได้', 'อินเทอร์เน็ตช้ามาก'],
  },
  {
    name: 'เครื่องเสียง / ไมโครโฟน',
    icon: 'audio',
    symptoms: ['ไม่มีเสียง', 'เสียงหอน', 'ไมโครโฟนไม่มีเสียง', 'ถ่านไมค์หมด'],
  },
  { name: 'โต๊ะ / เก้าอี้', icon: 'furniture', symptoms: ['ชำรุด / หัก', 'โยก / ไม่มั่นคง', 'ล้อเสีย'] },
  { name: 'อื่นๆ', icon: 'other', symptoms: [] },
];

type RoomSeed = { code: string; name: string; floor: number; capacity: number; roomType: 'LAB' | 'LECTURE' };

/** ห้องของสาขา (ตามหน้า Facilities ของสาขา) — อุปกรณ์ในห้องผู้ดูแลเพิ่มเองในหน้าห้อง */
export const ROOMS: RoomSeed[] = [
  { code: 'LAB1', name: 'ห้องปฏิบัติการคอมพิวเตอร์ 1 (Lab 1)', floor: 6, capacity: 35, roomType: 'LAB' },
  { code: 'LAB2', name: 'ห้องปฏิบัติการคอมพิวเตอร์ 2 (Lab 2)', floor: 6, capacity: 54, roomType: 'LAB' },
  { code: 'LAB3', name: 'ห้องปฏิบัติการคอมพิวเตอร์ 3 (Lab 3)', floor: 6, capacity: 60, roomType: 'LAB' },
  { code: 'LAB4', name: 'ห้องปฏิบัติการคอมพิวเตอร์ 4 (Lab 4)', floor: 6, capacity: 60, roomType: 'LAB' },
  { code: 'LAB5', name: 'ห้องปฏิบัติการคอมพิวเตอร์ 5 (Labcom 5)', floor: 6, capacity: 50, roomType: 'LAB' },
  {
    code: 'LAB-NET',
    name: 'ปฏิบัติการเครือข่ายคอมพิวเตอร์ (Lab Network)',
    floor: 6,
    capacity: 70,
    roomType: 'LAB',
  },
  { code: 'LECT6', name: 'ห้องบรรยายคอมพิวเตอร์ 6 (Lect 6)', floor: 2, capacity: 60, roomType: 'LECTURE' },
  { code: 'LECT8', name: 'ห้องบรรยายคอมพิวเตอร์ 8 (Lect 8)', floor: 2, capacity: 70, roomType: 'LECTURE' },
];

const QR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const qrCode = () => Array.from({ length: 8 }, () => QR_ALPHABET[randomInt(QR_ALPHABET.length)]).join('');

/** สร้างเฉพาะห้องที่ยังไม่มี — ห้องที่ผู้ดูแลแก้ไขแล้วไม่ถูกเขียนทับ · อาคารตั้งด้วย SEED_ROOM_BUILDING_CODE (ค่าเริ่มต้น CS) */
export async function seedRooms(prisma: PrismaClient) {
  const buildingCode = (process.env.SEED_ROOM_BUILDING_CODE ?? 'CS').trim().toUpperCase();
  const existing = new Set(
    (
      await prisma.room.findMany({
        where: { code: { in: ROOMS.map((room) => room.code) } },
        select: { code: true },
      })
    ).map((room) => room.code),
  );
  let created = 0;
  for (const room of ROOMS) {
    if (existing.has(room.code)) continue;
    await prisma.room.create({ data: { ...room, buildingCode, qrCode: qrCode() } });
    created += 1;
  }
  return created;
}

export function createSeedClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('ต้องตั้งค่า DATABASE_URL ก่อน (ดู .env.example)');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export async function seedCatalog(prisma: PrismaClient) {
  for (const [sortOrder, item] of CATEGORIES.entries()) {
    const data = { icon: item.icon, symptoms: item.symptoms, sortOrder, isActive: true };
    await prisma.category.upsert({
      where: { name: item.name },
      update: data,
      create: { name: item.name, ...data },
    });
  }
  const { count } = await prisma.category.updateMany({
    where: { name: { notIn: CATEGORIES.map((item) => item.name) }, isActive: true },
    data: { isActive: false },
  });
  return count;
}

async function main() {
  const prisma = createSeedClient();
  try {
    const retired = await seedCatalog(prisma);
    console.log(`seed: หมวดหมู่ ${CATEGORIES.length} หมวด · ปิดใช้งานหมวดเดิม ${retired} หมวด`);
    const rooms = await seedRooms(prisma);
    console.log(`seed: ห้อง ${ROOMS.length} ห้อง · สร้างใหม่ ${rooms} ห้อง`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

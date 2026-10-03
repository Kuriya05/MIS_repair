/**
 * แนะนำหมวดหมู่และความเร่งด่วนจากคำที่ผู้แจ้งพิมพ์ (สิ่งที่ชำรุด + อาการ) — กฎคำสำคัญในเครื่องล้วน ๆ
 * ไม่ส่งข้อความไปบริการภายนอก · เป็นแค่คำแนะนำ ผู้ใช้ต้องกดรับเอง และช่าง/ผู้ดูแลปรับได้ภายหลัง
 */
import type { Priority } from './types';

type Rule = { pattern: RegExp; label: string };

/** หมวดหมู่ของระบบเป็นข้อมูลที่ผู้ดูแลตั้งชื่อเอง — จับคู่ด้วยคำในชื่อหมวด (เช่น "ไฟฟ้า / แสงสว่าง") */
const CATEGORY_RULES: { categoryHint: RegExp; words: RegExp }[] = [
  {
    categoryHint: /แอร์|ปรับอากาศ/,
    words: /แอร์|เครื่องปรับอากาศ|ไม่เย็น|คอมเพรสเซอร์|น้ำแอร์|แอร์หยด|รีโมทแอร์/,
  },
  {
    categoryHint: /ไฟฟ้า|แสงสว่าง/,
    words: /ไฟ(?!ล์)|หลอด|ปลั๊ก|เต้ารับ|สวิตช์|เบรกเกอร์|ช็อต|ช๊อต|ไฟดับ|ไฟกระพริบ|ไฟรั่ว|สายไฟ|โคม/,
  },
  {
    categoryHint: /ประปา|สุขภัณฑ์/,
    words: /น้ำ(?!แอร์)|ก๊อก|ท่อ|ชักโครก|โถส้วม|สุขภัณฑ์|อ่างล้าง|ส้วม|ห้องน้ำ|ตัน|รั่วซึม/,
  },
  {
    categoryHint: /คอมพิวเตอร์|เครือข่าย/,
    words:
      /คอม|computer|pc|โน้ตบุ๊ก|จอ(?!ด)|เมาส์|คีย์บอร์ด|wifi|wi-fi|ไวไฟ|เน็ต|อินเทอร์เน็ต|lan|แลน|เครื่องพิมพ์|ปริ้นเตอร์|printer/i,
  },
  {
    categoryHint: /โสต/,
    words:
      /โปรเจกเตอร์|โปรเจคเตอร์|projector|ไมค์|ไมโครโฟน|ลำโพง|เครื่องเสียง|จอรับภาพ|hdmi|vga|สมาร์ททีวี|ทีวี/i,
  },
  {
    categoryHint: /เฟอร์นิเจอร์/,
    words: /โต๊ะ|เก้าอี้|ตู้|ชั้นวาง|ลิ้นชัก|กระดาน|ไวท์บอร์ด|บานพับ/,
  },
  {
    categoryHint: /อาคาร|โครงสร้าง/,
    words:
      /ประตู|หน้าต่าง|กระจก|เพดาน|ผนัง|พื้น|กระเบื้อง|หลังคา|รั่วจากหลังคา|ลิฟต์|บันได|ราวบันได|กุญแจ|ลูกบิด/,
  },
];

/** อันตรายต่อคน/ทรัพย์สิน หรือกระทบทั้งห้อง → เร่งด่วนขึ้น (ตรวจจากระดับสูงลงต่ำ) */
const PRIORITY_RULES: { priority: Priority; reasons: Rule[] }[] = [
  {
    priority: 'URGENT',
    reasons: [
      { pattern: /ช็อต|ช๊อต|ไฟรั่ว|ไฟดูด|ประกายไฟ/, label: 'มีไฟฟ้ารั่วหรือช็อต' },
      { pattern: /ควัน|ไหม้|กลิ่นไหม้|ไฟลุก/, label: 'มีควันหรือกลิ่นไหม้' },
      { pattern: /น้ำท่วม|ท่อแตก|น้ำทะลัก|น้ำพุ่ง/, label: 'น้ำท่วมหรือท่อแตก' },
      { pattern: /แก๊ส|แก็ส|กลิ่นแก๊ส/, label: 'อาจมีแก๊สรั่ว' },
      { pattern: /ลิฟต์ค้าง|ติดในลิฟต์|ติดลิฟต์/, label: 'มีคนติดลิฟต์' },
      { pattern: /เพดานถล่ม|ถล่ม|ร่วงลงมา|หล่นใส่/, label: 'มีของพังหล่นลงมา' },
    ],
  },
  {
    priority: 'HIGH',
    reasons: [
      { pattern: /ทั้งห้อง|ทั้งชั้น|ทั้งตึก|ทั้งอาคาร|หลายเครื่อง/, label: 'กระทบหลายจุด' },
      { pattern: /สอบ|มีเรียน|เรียนไม่ได้|สอนไม่ได้|ใช้สอน/, label: 'กระทบการเรียนการสอน' },
      { pattern: /ใช้งานไม่ได้|เปิดไม่ติด|ไม่ทำงาน|ดับสนิท|เสียหมด/, label: 'ใช้งานไม่ได้เลย' },
      { pattern: /ล็อกไม่ได้|ล็อคไม่ได้|ปิดไม่ได้|กระจกแตก/, label: 'เรื่องความปลอดภัยของห้อง' },
      { pattern: /รั่ว|หยด/, label: 'มีน้ำรั่ว/หยด' },
    ],
  },
  {
    priority: 'LOW',
    reasons: [
      { pattern: /เล็กน้อย|ไม่รีบ|ไม่ด่วน|ว่างเมื่อไหร่|สะดวกเมื่อไร/, label: 'ผู้แจ้งบอกว่าไม่รีบ' },
      { pattern: /สีลอก|รอยขีด|รอยเปื้อน|ฝุ่น|ความสวยงาม/, label: 'เป็นเรื่องความสวยงาม' },
    ],
  },
];

export type CategoryOption = { value: string; label: string };
export type TriageSuggestion = {
  category: CategoryOption | null;
  priority: Priority | null;
  /** เหตุผลสั้น ๆ ที่แสดงให้ผู้ใช้เห็นว่าทำไมระบบแนะนำแบบนี้ */
  reasons: string[];
};

/** ข้อความสั้นเกินไปยังไม่แนะนำ — กันคำแนะนำกระโดดไปมาตอนเพิ่งพิมพ์ */
const MIN_TEXT = 4;

export function suggestTriage(text: string, categories: CategoryOption[]): TriageSuggestion {
  const input = text.trim();
  if (input.length < MIN_TEXT) return { category: null, priority: null, reasons: [] };

  let category: CategoryOption | null = null;
  for (const rule of CATEGORY_RULES) {
    if (!rule.words.test(input)) continue;
    category = categories.find((option) => rule.categoryHint.test(option.label)) ?? null;
    if (category) break;
  }

  for (const level of PRIORITY_RULES) {
    const matched = level.reasons
      .filter((reason) => reason.pattern.test(input))
      .map((reason) => reason.label);
    if (matched.length > 0) return { category, priority: level.priority, reasons: matched };
  }
  return { category, priority: null, reasons: [] };
}

import { describe, expect, it } from 'vitest';
import { suggestTriage } from './triage';

const categories = [
  'ไฟฟ้า / แสงสว่าง',
  'ประปา / สุขภัณฑ์',
  'เครื่องปรับอากาศ',
  'คอมพิวเตอร์ / เครือข่าย',
  'โสตทัศนูปกรณ์',
  'เฟอร์นิเจอร์',
  'อาคาร / โครงสร้าง',
  'อื่นๆ',
].map((label, index) => ({ value: `id-${index}`, label }));

const categoryOf = (text: string) => suggestTriage(text, categories).category?.label ?? null;

describe('suggestTriage', () => {
  it('does nothing until there is enough text', () => {
    expect(suggestTriage('แอ', categories)).toEqual({ category: null, priority: null, reasons: [] });
  });

  it('maps common Thai wording to the matching category', () => {
    expect(categoryOf('แอร์ไม่เย็น มีแต่ลม')).toBe('เครื่องปรับอากาศ');
    expect(categoryOf('หลอดไฟกระพริบตลอด')).toBe('ไฟฟ้า / แสงสว่าง');
    expect(categoryOf('ชักโครกกดไม่ลง')).toBe('ประปา / สุขภัณฑ์');
    expect(categoryOf('wifi ในห้องหลุดบ่อย')).toBe('คอมพิวเตอร์ / เครือข่าย');
    expect(categoryOf('โปรเจคเตอร์ไม่ขึ้นภาพ')).toBe('โสตทัศนูปกรณ์');
    expect(categoryOf('เก้าอี้ขาหัก')).toBe('เฟอร์นิเจอร์');
    expect(categoryOf('ประตูปิดไม่สนิท')).toBe('อาคาร / โครงสร้าง');
  });

  it('does not confuse "ไฟล์" (file) with electricity, nor air-con drip with plumbing', () => {
    expect(categoryOf('เปิดไฟล์ในคอมไม่ได้')).toBe('คอมพิวเตอร์ / เครือข่าย');
    expect(categoryOf('น้ำแอร์หยดใส่โต๊ะ')).toBe('เครื่องปรับอากาศ');
  });

  it('flags danger as URGENT with a reason', () => {
    const result = suggestTriage('ปลั๊กไฟมีควัน มีกลิ่นไหม้', categories);
    expect(result.priority).toBe('URGENT');
    expect(result.reasons).toContain('มีควันหรือกลิ่นไหม้');
    expect(result.category?.label).toBe('ไฟฟ้า / แสงสว่าง');
  });

  it('suggests HIGH when teaching is affected, LOW when the reporter is not in a hurry', () => {
    expect(suggestTriage('โปรเจคเตอร์เปิดไม่ติด พรุ่งนี้มีสอบ', categories).priority).toBe('HIGH');
    expect(suggestTriage('เก้าอี้สีลอกนิดหน่อย ไม่รีบ', categories).priority).toBe('LOW');
  });

  it('leaves priority alone when nothing in the text says how urgent it is', () => {
    expect(suggestTriage('เก้าอี้โยก', categories).priority).toBeNull();
  });

  it('suggests no category when the admin has no matching category', () => {
    expect(suggestTriage('แอร์ไม่เย็น', [{ value: 'x', label: 'อื่นๆ' }]).category).toBeNull();
  });
});

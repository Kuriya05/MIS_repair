import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { validationError } from './errors';

/** ข้อความสำรองเมื่อ decorator ไม่ได้ระบุข้อความไทยเอง (ห้ามส่งข้อความ default ภาษาอังกฤษของ class-validator) */
const THAI_FALLBACK: Record<string, string> = {
  whitelistValidation: 'ไม่มีช่องนี้ในแบบฟอร์ม',
  isString: 'ต้องเป็นข้อความ',
  isInt: 'ต้องเป็นจำนวนเต็ม',
  isBoolean: 'ต้องเป็น true หรือ false',
  isUuid: 'รหัสอ้างอิงไม่ถูกต้อง',
  isIn: 'ค่าที่เลือกไม่ถูกต้อง',
  isEnum: 'ค่าที่เลือกไม่ถูกต้อง',
  isNotEmpty: 'ต้องไม่เว้นว่าง',
  maxLength: 'ยาวเกินกำหนด',
  minLength: 'สั้นเกินไป',
  isLength: 'ความยาวไม่อยู่ในช่วงที่กำหนด',
  min: 'ค่าน้อยกว่าที่กำหนด',
  max: 'ค่ามากกว่าที่กำหนด',
  matches: 'รูปแบบไม่ถูกต้อง',
};
const THAI = /[฀-๿]/;

function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([constraint, message]) => {
      const text = THAI.test(message) ? message : (THAI_FALLBACK[constraint] ?? 'ข้อมูลไม่ถูกต้อง');
      return `${field}: ${text}`;
    });
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/**
 * body/query ผิด → 400 VALIDATION_ERROR (ไม่ใช่ 422) · details เป็น array ของข้อความ
 * รูปแบบ "<field>: <ข้อความภาษาไทย>" เพื่อให้หน้าจอแสดง error ใต้ช่องที่ผิดได้
 */
export function createValidationPipe() {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
    exceptionFactory: (errors) => validationError(flatten(errors)),
  });
}

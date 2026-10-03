import { HttpStatus } from '@nestjs/common';
import { AppException, type ErrorCodeValue } from '../common/errors';

/**
 * ข้อผิดพลาดของโดเมนแจ้งซ่อม — สร้างบน AppException ของชั้นกลาง (common/errors.ts จาก reference)
 * AllExceptionsFilter จึงแสดงเป็น { success:false, error:{ code, message, details? } } และใส่ Retry-After ให้ 429/503
 * ข้อความเป็นภาษาไทยที่หน้าเว็บแสดงได้ทันที
 */
export type ErrorCode = ErrorCodeValue;

export const HTTP_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

/** AppException ที่ HTTP status มาจาก code เสมอ · details เป็น "field: ข้อความ" สำหรับ VALIDATION_ERROR */
export class ApiError extends AppException {
  declare readonly details?: string[];

  constructor(code: ErrorCode, message: string, details?: string[], retryAfterSec?: number) {
    super(code, message, HTTP_STATUS[code], details, retryAfterSec);
  }
}

export const notFound = (message = 'ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง') =>
  new ApiError('NOT_FOUND', message);
export const forbidden = (
  message = 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบย่อยนี้',
) => new ApiError('FORBIDDEN', message);
export const conflict = (message: string) => new ApiError('CONFLICT', message);
export const unauthorized = (message = 'กรุณาเข้าสู่ระบบผ่าน CSMJU Portal') =>
  new ApiError('UNAUTHORIZED', message);
export const validationError = (details: string[], message = 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง') =>
  new ApiError('VALIDATION_ERROR', message, details);
export const badRequest = (message: string) => new ApiError('BAD_REQUEST', message);

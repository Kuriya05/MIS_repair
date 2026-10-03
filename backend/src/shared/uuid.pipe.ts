import { ParseUUIDPipe } from '@nestjs/common';
import { ApiError } from './errors';

/** path parameter ต้องเป็น UUID v4 — ไม่ใช่ → 400 (api-conventions.md ข้อ 1) */
export const UuidParam = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new ApiError('BAD_REQUEST', 'รหัสอ้างอิงไม่ถูกต้อง'),
});

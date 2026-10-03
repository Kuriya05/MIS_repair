import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { HTTP_STATUS, type ErrorCode } from './errors';

/**
 * เอกสาร OpenAPI ของ envelope มาตรฐาน — frontend สร้าง type จาก openapi.json (tech-stack.md ข้อ 3)
 * จึงต้องบอก schema ของ { success, data, meta } และ { success: false, error } ให้ครบทุก endpoint
 */
export class PageMetaDto {
  @ApiProperty({ example: 42 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
  @ApiProperty({ example: 3 }) totalPages: number;
}

const ERROR_CODES = Object.keys(HTTP_STATUS) as ErrorCode[];

export class ErrorBodyDto {
  @ApiProperty({ enum: ERROR_CODES, enumName: 'ErrorCode' }) code: ErrorCode;
  @ApiProperty({ description: 'ข้อความภาษาไทยที่แสดงให้ผู้ใช้ได้ทันที' }) message: string;
  @ApiPropertyOptional({ type: [String] }) details?: string[];
}

export class ErrorEnvelopeDto {
  @ApiProperty({ enum: [false] }) success: false;
  @ApiProperty({ type: ErrorBodyDto }) error: ErrorBodyDto;
}

export class DeletedDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: [true] }) deleted: true;
}

type EnvelopeOptions = { status?: number; description?: string; isArray?: boolean };

/** { success: true, data: <model> } */
/** { success: true, data: <model> } หรือ data เป็น array เมื่อ isArray (รายการไม่แบ่งหน้า ไม่มี meta) */
export function ApiEnvelope(
  model: Type<unknown>,
  { status = 200, description, isArray = false }: EnvelopeOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: isArray
            ? { type: 'array', items: { $ref: getSchemaPath(model) } }
            : { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
}

/** { success: true, data: <model>[], meta } */
export function ApiPageEnvelope(model: Type<unknown>, { description }: EnvelopeOptions = {}) {
  return applyDecorators(
    ApiExtraModels(model, PageMetaDto),
    ApiResponse({
      status: 200,
      description,
      schema: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PageMetaDto) },
        },
      },
    }),
  );
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'BAD_REQUEST / VALIDATION_ERROR',
  401: 'UNAUTHORIZED — ไม่มี token หรือ token ใช้ไม่ได้',
  403: 'FORBIDDEN — สิทธิ์ไม่พอ',
  404: 'NOT_FOUND',
  409: 'CONFLICT — ชนกฎธุรกิจ',
  503: 'SERVICE_UNAVAILABLE — ติดต่อ Core Hub ไม่ได้ชั่วคราว (มี header Retry-After)',
};

/** error envelope ของ status ที่ endpoint นั้นตอบได้ (401 ใส่ให้ทุก endpoint ที่ต้องมี token) */
export function ApiErrors(...statuses: (400 | 403 | 404 | 409 | 503)[]) {
  return applyDecorators(
    ApiExtraModels(ErrorEnvelopeDto),
    ...[401, ...statuses].map((status) =>
      ApiResponse({
        status,
        description: ERROR_DESCRIPTIONS[status],
        schema: { $ref: getSchemaPath(ErrorEnvelopeDto) },
      }),
    ),
  );
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** ?page=1&limit=20 · limit สูงสุด 100 (api-conventions.md ข้อ 5) */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page ต้องเป็นจำนวนเต็ม' })
  @Min(1, { message: 'page ต้องไม่น้อยกว่า 1' })
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit ต้องเป็นจำนวนเต็ม' })
  @Min(1, { message: 'limit ต้องไม่น้อยกว่า 1' })
  @Max(100, { message: 'limit ต้องไม่เกิน 100' })
  limit: number = 20;
}

export function pageArgs(query: PaginationQueryDto) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

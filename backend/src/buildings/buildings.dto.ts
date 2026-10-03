import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../shared/pagination.dto';
import { toBoolean, trim } from '../shared/transforms';

/** อาคารจาก Core Hub (reference-data.md ข้อ 4.3) + จำนวนข้อมูลของระบบนี้ในอาคาร */
export class BuildingDto {
  @ApiProperty({ example: 'CS', description: 'code ของอาคารใน Core Hub — ใช้อ้างอิงในห้องและใบแจ้งซ่อม' })
  code: string;
  @ApiProperty({ example: 'อาคารวิทยาการคอมพิวเตอร์' }) name: string;
  @ApiProperty({ type: String, nullable: true }) nameEn: string | null;
  @ApiProperty({ description: 'false = Core Hub ปิดใช้งานแล้ว' }) isActive: boolean;
  @ApiProperty({ description: 'ห้องที่ผู้ดูแลระบบแจ้งซ่อมเพิ่มไว้' }) roomCount: number;
  @ApiProperty({ description: 'เครื่องในห้องต่าง ๆ ของอาคาร' }) equipmentCount: number;
  @ApiProperty({ description: 'ใบแจ้งซ่อมทั้งหมดของอาคาร' }) requestCount: number;
  @ApiProperty({ description: 'ใบที่ยังไม่ปิดงาน' }) openRequestCount: number;
}

export class ListBuildingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100, description: 'ค้นจากชื่อหรือ code' })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'คำค้นต้องเป็นข้อความ' })
  @MaxLength(100, { message: 'คำค้นยาวได้ไม่เกิน 100 ตัวอักษร' })
  q?: string;

  @ApiPropertyOptional({
    description: 'ใส่ได้เพื่อความเข้ากันได้ — รายการแสดงเฉพาะอาคารที่ Core Hub เปิดใช้งานเสมอ',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isActive ต้องเป็น true หรือ false' })
  isActive?: boolean;
}

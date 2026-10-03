import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../shared/pagination.dto';
import { toBoolean, trim } from '../shared/transforms';

/** ไอคอนของประเภทอุปกรณ์ที่หน้าเว็บมี — ต้องตรงกับ CHECK categories_icon_check */
export const CATEGORY_ICONS = [
  'computer',
  'monitor',
  'projector',
  'aircon',
  'fan',
  'light',
  'network',
  'audio',
  'furniture',
  'other',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

/** ตัดช่องว่าง · ทิ้งค่าว่าง · ไม่ซ้ำ */
const cleanSymptoms = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [...new Set(value.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(Boolean))]
    : value;

/** หมวดหมู่งานซ่อม = ประเภทอุปกรณ์ของสาขา พร้อมอาการที่พบบ่อย */
export class CategoryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'คอมพิวเตอร์' }) name: string;
  @ApiProperty({
    type: [String],
    example: ['เปิดไม่ติด', 'จอไม่แสดงภาพ'],
    description: 'ปุ่มอาการในหน้าแจ้งซ่อม',
  })
  symptoms: string[];
  @ApiProperty({ enum: CATEGORY_ICONS, enumName: 'CategoryIcon' }) icon: CategoryIcon;
  @ApiProperty() sortOrder: number;
  @ApiProperty({ description: 'false = ไม่แสดงในฟอร์มแจ้งซ่อม แต่ข้อมูลเดิมยังอ้างถึงได้' })
  isActive: boolean;
  @ApiProperty({ description: 'จำนวนใบแจ้งซ่อมจริงในหมวดนี้' }) requestCount: number;
  @ApiProperty({ description: 'ใบที่ยังไม่ปิดงาน' }) openRequestCount: number;
  @ApiProperty({ description: 'จำนวนเครื่องในห้องต่าง ๆ ที่เป็นประเภทนี้' }) equipmentCount: number;
}

export class ListCategoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'คำค้นต้องเป็นข้อความ' })
  @MaxLength(100, { message: 'คำค้นยาวได้ไม่เกิน 100 ตัวอักษร' })
  q?: string;

  @ApiPropertyOptional({ description: 'true = เฉพาะที่เปิดใช้งาน (ใช้ในฟอร์มแจ้งซ่อม)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isActive ต้องเป็น true หรือ false' })
  isActive?: boolean;
}

export class CreateCategoryDto {
  @ApiProperty({ minLength: 2, maxLength: 100, example: 'คอมพิวเตอร์' })
  @Transform(trim)
  @IsString({ message: 'ชื่อหมวดหมู่ต้องเป็นข้อความ' })
  @Length(2, 100, { message: 'ชื่อหมวดหมู่ต้องยาว 2–100 ตัวอักษร' })
  name: string;

  @ApiPropertyOptional({ type: [String], maxItems: 12 })
  @IsOptional()
  @Transform(cleanSymptoms)
  @IsArray({ message: 'อาการต้องเป็นรายการ' })
  @ArrayMaxSize(12, { message: 'ใส่อาการที่พบบ่อยได้ไม่เกิน 12 อาการ' })
  @IsString({ each: true, message: 'อาการต้องเป็นข้อความ' })
  @Length(2, 100, { each: true, message: 'แต่ละอาการต้องยาว 2–100 ตัวอักษร' })
  symptoms?: string[];

  @ApiPropertyOptional({ enum: CATEGORY_ICONS, enumName: 'CategoryIcon' })
  @IsOptional()
  @IsIn(CATEGORY_ICONS, { message: 'ไอคอนไม่ถูกต้อง' })
  icon?: CategoryIcon;

  @ApiPropertyOptional({ minimum: 0, maximum: 999 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ลำดับต้องเป็นจำนวนเต็ม' })
  @Min(0, { message: 'ลำดับต้องไม่ติดลบ' })
  @Max(999, { message: 'ลำดับต้องไม่เกิน 999' })
  sortOrder?: number;
}

export class UpdateCategoryDto extends CreateCategoryDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'ชื่อหมวดหมู่ต้องเป็นข้อความ' })
  @Length(2, 100, { message: 'ชื่อหมวดหมู่ต้องยาว 2–100 ตัวอักษร' })
  declare name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'isActive ต้องเป็น true หรือ false' })
  isActive?: boolean;
}

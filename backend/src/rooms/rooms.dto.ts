import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { RequestStatus, RoomType } from '../../generated/prisma/enums';
import { CATEGORY_ICONS, type CategoryIcon } from '../categories/categories.dto';
import { BuildingRefDto } from '../repair-requests/repair-requests.dto';
import { toBoolean, toInt, trim, trimToUndefined } from '../shared/transforms';

const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/**
 * สถานะของเครื่อง/ห้องจากใบแจ้งซ่อมที่ยังไม่ปิด (ใบล่าสุด)
 * OK = ไม่มีใบค้าง · REPORTED = แจ้งแล้ว รอช่างรับ · IN_PROGRESS = ช่างรับ/กำลังซ่อม · ON_HOLD = รออะไหล่
 */
export const EQUIPMENT_STATES = ['OK', 'REPORTED', 'IN_PROGRESS', 'ON_HOLD'] as const;
export type EquipmentState = (typeof EQUIPMENT_STATES)[number];

const STATUSES = Object.values(RequestStatus);

/** ประเภทห้อง (ค่าเริ่มต้น LAB) */
export const ROOM_TYPES = Object.values(RoomType);
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  LAB: 'ห้องปฏิบัติการคอมพิวเตอร์',
  LECTURE: 'ห้องบรรยาย',
  NETWORK_LAB: 'ห้องปฏิบัติการเครือข่าย',
  MEETING: 'ห้องประชุม',
  OFFICE: 'ห้องพัก/สำนักงาน',
  OTHER: 'อื่นๆ',
};
const ROOM_TYPE_DESCRIPTION =
  'ประเภทห้อง: ' + ROOM_TYPES.map((type) => `${type} = ${ROOM_TYPE_LABELS[type]}`).join(' · ');
const ROOM_TYPE_MESSAGE = `ประเภทห้องต้องเป็น ${ROOM_TYPES.join(', ')}`;
const CAPACITY_MESSAGE = 'จำนวนที่นั่งต้องเป็นจำนวนเต็ม 0–1000';

export class OpenRequestRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'RP-6910-0012' }) code: string;
  @ApiProperty({ enum: STATUSES, enumName: 'RequestStatus' }) status: RequestStatus;
  @ApiProperty() equipment: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ description: 'ผู้แจ้ง + คนที่กด "ฉันก็เจอ"' }) affectedCount: number;
}

export class EquipmentCategoryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: CATEGORY_ICONS, enumName: 'CategoryIcon' }) icon: CategoryIcon;
  @ApiProperty({ type: [String] }) symptoms: string[];
}

export class EquipmentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) roomId: string;
  @ApiProperty({ example: 'PC-01' }) label: string;
  @ApiProperty({ example: 'Dell OptiPlex 7090' }) name: string;
  @ApiProperty({ type: String, nullable: true }) assetNumber: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'รายละเอียดเครื่องหลายบรรทัด' }) specs:
    string | null;
  @ApiProperty({ type: String, nullable: true, example: 'แถว 2 ที่ 3' }) position: string | null;
  @ApiProperty({ example: 'K7QM4TZP', description: 'รหัสใน QR ของเครื่อง (/q/<qrCode>)' }) qrCode: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '/api/v1/equipment/0d6f…/photo?v=1759480000000',
    description: 'URL รูปเครื่อง (?v= เปลี่ยนเมื่อแก้ไข) · null = ยังไม่มีรูป',
  })
  photoUrl: string | null;
  @ApiProperty({ type: () => EquipmentCategoryDto }) category: EquipmentCategoryDto;
  @ApiProperty({ enum: EQUIPMENT_STATES, enumName: 'EquipmentState' }) state: EquipmentState;
  @ApiProperty({
    type: () => OpenRequestRefDto,
    nullable: true,
    description: 'ใบที่ยังไม่ปิดล่าสุดของเครื่องนี้',
  })
  openRequest: OpenRequestRefDto | null;
}

export class RoomStateSummaryDto {
  @ApiProperty() total: number;
  @ApiProperty() ok: number;
  @ApiProperty() reported: number;
  @ApiProperty() inProgress: number;
  @ApiProperty() onHold: number;
}

export class RoomDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'CS' }) buildingCode: string;
  @ApiProperty({ type: () => BuildingRefDto }) building: BuildingRefDto;
  @ApiProperty({ example: 'CS-201' }) code: string;
  @ApiProperty({ example: 'ห้องปฏิบัติการคอมพิวเตอร์ 1' }) name: string;
  @ApiProperty({ type: Number, nullable: true }) floor: number | null;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ enum: ROOM_TYPES, enumName: 'RoomType', description: ROOM_TYPE_DESCRIPTION })
  roomType: RoomType;
  @ApiProperty({ type: Number, nullable: true, description: 'จำนวนที่นั่ง' }) capacity: number | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '/api/v1/rooms/0d6f…/photo?v=1759480000000',
    description: 'URL รูปห้อง (?v= เปลี่ยนเมื่อแก้ไข) · null = ยังไม่มีรูป',
  })
  photoUrl: string | null;
  @ApiProperty({ description: 'รหัสใน QR ของห้อง (/q/<qrCode>)' }) qrCode: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ type: () => RoomStateSummaryDto, description: 'สถานะเครื่องทั้งหมดในห้อง' })
  equipmentStates: RoomStateSummaryDto;
  @ApiProperty({ description: 'ใบแจ้งซ่อมของห้องนี้ที่ยังไม่ปิด (รวมที่ไม่ได้ผูกเครื่อง)' })
  openRequestCount: number;
}

export class RoomDetailDto extends RoomDto {
  @ApiProperty({ type: () => [EquipmentDto] }) equipment: EquipmentDto[];
  @ApiProperty({
    type: () => [OpenRequestRefDto],
    description: 'ใบที่ยังไม่ปิดของห้องที่ไม่ได้ผูกกับเครื่อง',
  })
  roomRequests: OpenRequestRefDto[];
}

export class RoomRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: Number, nullable: true }) floor: number | null;
  @ApiProperty({ type: () => BuildingRefDto }) building: BuildingRefDto;
}

export class EquipmentHistoryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() code: string;
  @ApiProperty({ enum: STATUSES, enumName: 'RequestStatus' }) status: RequestStatus;
  @ApiProperty() description: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) completedAt: string | null;
}

export class EquipmentDetailDto extends EquipmentDto {
  @ApiProperty({ type: () => RoomRefDto }) room: RoomRefDto;
  @ApiProperty({ type: () => [EquipmentHistoryDto], description: 'ประวัติการแจ้งซ่อมล่าสุด 20 ใบ' })
  history: EquipmentHistoryDto[];
}

export class InventoryRoomRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'CS-201' }) code: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: Number, nullable: true }) floor: number | null;
  @ApiProperty({ example: 'CS' }) buildingCode: string;
  @ApiProperty({ enum: ROOM_TYPES, enumName: 'RoomType' }) roomType: RoomType;
}

/** แถวในทะเบียนครุภัณฑ์ (GET /v1/equipment) = เครื่อง + ห้องที่อยู่ */
export class EquipmentInventoryDto extends EquipmentDto {
  @ApiProperty({ type: () => InventoryRoomRefDto }) room: InventoryRoomRefDto;
}

export class QrTargetDto {
  @ApiProperty({ enum: ['room', 'equipment'] }) kind: 'room' | 'equipment';
  @ApiProperty({ format: 'uuid' }) id: string;
}

// ------------------------------------------------------------------ input --

export class ListRoomsQueryDto {
  @ApiPropertyOptional({ example: 'CS' })
  @IsOptional()
  @Matches(/^[A-Z0-9-]{1,50}$/, { message: 'buildingCode ไม่ถูกต้อง' })
  buildingCode?: string;

  @ApiPropertyOptional({ maxLength: 100, description: 'ค้นจากรหัสหรือชื่อห้อง' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100, { message: 'คำค้นยาวได้ไม่เกิน 100 ตัวอักษร' })
  q?: string;

  @ApiPropertyOptional({ enum: ROOM_TYPES, enumName: 'RoomType', description: ROOM_TYPE_DESCRIPTION })
  @IsOptional()
  @IsIn(ROOM_TYPES, { message: ROOM_TYPE_MESSAGE })
  roomType?: RoomType;

  @ApiPropertyOptional({ description: 'true = เฉพาะห้องที่เปิดใช้งาน' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isActive ต้องเป็น true หรือ false' })
  isActive?: boolean;
}

export class CreateRoomDto {
  @ApiProperty({ example: 'CS', description: 'code ของอาคารใน Core Hub' })
  @IsString({ message: 'กรุณาเลือกอาคาร' })
  @Matches(/^[A-Z0-9-]{1,50}$/, { message: 'กรุณาเลือกอาคาร' })
  buildingCode: string;

  @ApiProperty({ example: 'CS-201', description: 'A–Z ตัวเลข และ - เท่านั้น' })
  @Transform(upperTrim)
  @IsString({ message: 'รหัสห้องต้องเป็นข้อความ' })
  @Matches(/^[A-Z0-9-]{1,30}$/, {
    message: 'รหัสห้องใช้ได้เฉพาะ A–Z ตัวเลข และ - ไม่เกิน 30 ตัว เช่น CS-201',
  })
  code: string;

  @ApiProperty({ minLength: 2, maxLength: 150, example: 'ห้องปฏิบัติการคอมพิวเตอร์ 1' })
  @Transform(trim)
  @IsString({ message: 'ชื่อห้องต้องเป็นข้อความ' })
  @Length(2, 150, { message: 'ชื่อห้องต้องยาว 2–150 ตัวอักษร' })
  name: string;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: -5, maximum: 99 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(toInt)
  @IsInt({ message: 'ชั้นต้องเป็นจำนวนเต็ม' })
  @Min(-5, { message: 'ชั้นต้องอยู่ระหว่าง B5 ถึง 99' })
  @Max(99, { message: 'ชั้นต้องอยู่ระหว่าง B5 ถึง 99' })
  floor?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(500, { message: 'รายละเอียดยาวได้ไม่เกิน 500 ตัวอักษร' })
  description?: string | null;

  @ApiPropertyOptional({ enum: ROOM_TYPES, enumName: 'RoomType', description: ROOM_TYPE_DESCRIPTION })
  @IsOptional()
  @IsIn(ROOM_TYPES, { message: ROOM_TYPE_MESSAGE })
  roomType?: RoomType;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1000,
    description: 'จำนวนที่นั่ง',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(toInt)
  @IsInt({ message: CAPACITY_MESSAGE })
  @Min(0, { message: CAPACITY_MESSAGE })
  @Max(1000, { message: CAPACITY_MESSAGE })
  capacity?: number | null;
}

export class UpdateRoomDto {
  @ApiPropertyOptional({ example: 'CS' })
  @IsOptional()
  @Matches(/^[A-Z0-9-]{1,50}$/, { message: 'buildingCode ไม่ถูกต้อง' })
  buildingCode?: string;

  @ApiPropertyOptional({ example: 'CS-201' })
  @IsOptional()
  @Transform(upperTrim)
  @Matches(/^[A-Z0-9-]{1,30}$/, { message: 'รหัสห้องใช้ได้เฉพาะ A–Z ตัวเลข และ - ไม่เกิน 30 ตัว' })
  code?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 150 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 150, { message: 'ชื่อห้องต้องยาว 2–150 ตัวอักษร' })
  name?: string;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: -5, maximum: 99 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(toInt)
  @IsInt({ message: 'ชั้นต้องเป็นจำนวนเต็ม' })
  @Min(-5, { message: 'ชั้นต้องอยู่ระหว่าง B5 ถึง 99' })
  @Max(99, { message: 'ชั้นต้องอยู่ระหว่าง B5 ถึง 99' })
  floor?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500, { message: 'รายละเอียดยาวได้ไม่เกิน 500 ตัวอักษร' })
  description?: string | null;

  @ApiPropertyOptional({ enum: ROOM_TYPES, enumName: 'RoomType', description: ROOM_TYPE_DESCRIPTION })
  @IsOptional()
  @IsIn(ROOM_TYPES, { message: ROOM_TYPE_MESSAGE })
  roomType?: RoomType;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1000,
    description: 'จำนวนที่นั่ง',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(toInt)
  @IsInt({ message: CAPACITY_MESSAGE })
  @Min(0, { message: CAPACITY_MESSAGE })
  @Max(1000, { message: CAPACITY_MESSAGE })
  capacity?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'isActive ต้องเป็น true หรือ false' })
  isActive?: boolean;
}

export class CreateEquipmentDto {
  @ApiProperty({ format: 'uuid', description: 'ประเภทอุปกรณ์ (หมวดหมู่งานซ่อม)' })
  @IsUUID('4', { message: 'กรุณาเลือกประเภทอุปกรณ์' })
  categoryId: string;

  @ApiProperty({ example: 'PC-01', description: 'ป้ายบนเครื่อง ไม่ซ้ำในห้องเดียวกัน' })
  @Transform(upperTrim)
  @IsString({ message: 'ป้ายเครื่องต้องเป็นข้อความ' })
  @Length(1, 30, { message: 'ป้ายเครื่องต้องยาว 1–30 ตัวอักษร' })
  label: string;

  @ApiProperty({ example: 'Dell OptiPlex 7090' })
  @Transform(trim)
  @IsString({ message: 'ชื่อ/รุ่นต้องเป็นข้อความ' })
  @Length(2, 150, { message: 'ชื่อ/รุ่นต้องยาว 2–150 ตัวอักษร' })
  name: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(50, { message: 'เลขครุภัณฑ์ยาวได้ไม่เกิน 50 ตัวอักษร' })
  assetNumber?: string;

  @ApiPropertyOptional({ maxLength: 1000, example: 'Intel Core i5-11500 · RAM 16 GB · SSD 512 GB' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(1000, { message: 'รายละเอียดเครื่องยาวได้ไม่เกิน 1000 ตัวอักษร' })
  specs?: string;

  @ApiPropertyOptional({ maxLength: 50, example: 'แถว 2 ที่ 3' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(50, { message: 'ตำแหน่งยาวได้ไม่เกิน 50 ตัวอักษร' })
  position?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    description: 'เพิ่มหลายเครื่องพร้อมกัน — ป้ายจะเป็น <label>-01, -02, … (เช่น PC → PC-01 ถึง PC-30)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'จำนวนต้องเป็นจำนวนเต็ม' })
  @Min(1, { message: 'จำนวนต้องอย่างน้อย 1' })
  @Max(100, { message: 'เพิ่มได้ครั้งละไม่เกิน 100 เครื่อง' })
  count?: number;
}

export class UpdateEquipmentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'ประเภทอุปกรณ์ไม่ถูกต้อง' })
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(upperTrim)
  @IsString()
  @Length(1, 30, { message: 'ป้ายเครื่องต้องยาว 1–30 ตัวอักษร' })
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 150, { message: 'ชื่อ/รุ่นต้องยาว 2–150 ตัวอักษร' })
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(50, { message: 'เลขครุภัณฑ์ยาวได้ไม่เกิน 50 ตัวอักษร' })
  assetNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000, { message: 'รายละเอียดเครื่องยาวได้ไม่เกิน 1000 ตัวอักษร' })
  specs?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(50, { message: 'ตำแหน่งยาวได้ไม่เกิน 50 ตัวอักษร' })
  position?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'isActive ต้องเป็น true หรือ false' })
  isActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'ย้ายไปห้องอื่น' })
  @IsOptional()
  @IsUUID('4', { message: 'ห้องไม่ถูกต้อง' })
  roomId?: string;
}

export const QR_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export class ListEquipmentQueryDto {
  @ApiPropertyOptional({ example: 'CS' })
  @IsOptional()
  @Matches(/^[A-Z0-9-]{1,50}$/, { message: 'buildingCode ไม่ถูกต้อง' })
  buildingCode?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'roomId ไม่ถูกต้อง' })
  roomId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'ประเภทอุปกรณ์ (หมวดหมู่งานซ่อม)' })
  @IsOptional()
  @IsUUID('4', { message: 'categoryId ไม่ถูกต้อง' })
  categoryId?: string;

  @ApiPropertyOptional({ maxLength: 100, description: 'ค้นจากป้าย ชื่อ/รุ่น หรือเลขครุภัณฑ์' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100, { message: 'คำค้นยาวได้ไม่เกิน 100 ตัวอักษร' })
  q?: string;

  @ApiPropertyOptional({ description: 'true = เฉพาะเครื่องที่เปิดใช้งาน' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isActive ต้องเป็น true หรือ false' })
  isActive?: boolean;
}

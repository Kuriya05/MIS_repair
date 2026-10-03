import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import { Priority, RequestStatus } from '../../generated/prisma/enums';
import { CATEGORY_ICONS, type CategoryIcon } from '../categories/categories.dto';
import { PersonDto } from '../repair-requests/repair-requests.dto';

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class StatisticsQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'ตั้งแต่วันที่ (YYYY-MM-DD เวลาไทย) · ค่าเริ่มต้น 30 วันล่าสุด',
  })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'from ต้องเป็นวันที่รูปแบบ YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'ถึงวันที่ (รวมวันนั้น) · ค่าเริ่มต้นวันนี้' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'to ต้องเป็นวันที่รูปแบบ YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'เฉพาะใบแจ้งซ่อมของห้องนี้ (ทุกสถิติ)' })
  @IsOptional()
  @IsUUID('4', { message: 'roomId ไม่ถูกต้อง' })
  roomId?: string;
}

export class StatisticsRangeDto {
  @ApiProperty({ example: '2026-08-26' }) from: string;
  @ApiProperty({ example: '2026-09-24' }) to: string;
  @ApiProperty({ enum: ['day', 'month'], description: 'หน่วยของ trend (เกิน 62 วันเป็นรายเดือน)' })
  granularity: 'day' | 'month';
}

export class SnapshotDto {
  @ApiProperty({ description: 'งานที่ยังไม่ปิดตอนนี้ทั้งหมด' }) open: number;
  @ApiProperty({ description: 'รอรับเรื่อง (ยังไม่มีช่าง)' }) pending: number;
  @ApiProperty({ description: 'รับเรื่องแล้ว + กำลังดำเนินการ' }) inProgress: number;
  @ApiProperty({ description: 'รออะไหล่/พักงาน' }) onHold: number;
  @ApiProperty({ description: 'ยังไม่ปิดและเลยกำหนด SLA แล้ว' }) overdue: number;
}

export class ResolutionDto {
  @ApiProperty({ description: 'ปิดงานสำเร็จในช่วงนี้' }) completed: number;
  @ApiProperty({ description: 'ในจำนวนนั้น เสร็จทันกำหนด SLA' }) onTime: number;
  @ApiProperty({ type: Number, nullable: true, description: 'ร้อยละที่ทันกำหนด (0–100)' }) onTimeRate:
    number | null;
  @ApiProperty({ type: Number, nullable: true, description: 'เวลาเฉลี่ยตั้งแต่แจ้งจนซ่อมเสร็จ (ชั่วโมง)' })
  avgResolutionHours: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'เวลาเฉลี่ยตั้งแต่แจ้งจนช่างรับเรื่อง (ชั่วโมง)',
  })
  avgFirstResponseHours: number | null;
}

export class RatingBucketDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) rating: number;
  @ApiProperty() count: number;
}

export class SatisfactionDto {
  @ApiProperty({ type: Number, nullable: true, description: 'คะแนนเฉลี่ย 1–5' }) average: number | null;
  @ApiProperty() count: number;
  @ApiProperty({ type: () => [RatingBucketDto] }) distribution: RatingBucketDto[];
}

export class StatusCountDto {
  @ApiProperty({ enum: Object.values(RequestStatus), enumName: 'RequestStatus' }) status: RequestStatus;
  @ApiProperty() count: number;
}

export class PriorityCountDto {
  @ApiProperty({ enum: Object.values(Priority), enumName: 'Priority' }) priority: Priority;
  @ApiProperty() count: number;
}

export class NamedCountDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() count: number;
}

export class BuildingCountDto {
  @ApiProperty({ example: 'CS', description: 'code ของอาคารใน Core Hub' }) code: string;
  @ApiProperty({ description: 'ชื่อจาก Core Hub · หาไม่ได้ = code' }) name: string;
  @ApiProperty() count: number;
}

export class HotSpotDto {
  @ApiProperty({ example: 'CS' }) buildingCode: string;
  @ApiProperty({ description: 'ชื่อจาก Core Hub · หาไม่ได้ = code' }) buildingName: string;
  @ApiProperty() location: string;
  @ApiProperty({ description: 'จำนวนครั้งที่แจ้งในช่วงนี้' }) count: number;
  @ApiProperty({ description: 'ที่ยังไม่ปิด' }) open: number;
}

export class TrendPointDto {
  @ApiProperty({ example: '2026-09-24', description: 'YYYY-MM-DD หรือ YYYY-MM ตาม granularity' })
  period: string;
  @ApiProperty({ description: 'จำนวนที่แจ้งเข้ามา' }) created: number;
  @ApiProperty({ description: 'จำนวนที่ซ่อมเสร็จ' }) completed: number;
}

export class TechnicianLoadDto {
  @ApiProperty({ type: () => PersonDto }) person: PersonDto;
  @ApiProperty({ description: 'งานที่ถืออยู่และยังไม่ปิด (ตอนนี้)' }) open: number;
  @ApiProperty({ description: 'ปิดงานในช่วงนี้' }) completed: number;
  @ApiProperty({ description: 'ปิดทันกำหนดในช่วงนี้' }) onTime: number;
  @ApiProperty({ type: Number, nullable: true }) avgRating: number | null;
}

export class StatRoomRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'CS-201' }) code: string;
  @ApiProperty() name: string;
  @ApiProperty({ example: 'CS' }) buildingCode: string;
}

export class RoomStatDto {
  @ApiProperty({ type: () => StatRoomRefDto }) room: StatRoomRefDto;
  @ApiProperty({ description: 'จำนวนที่แจ้งในช่วงนี้' }) total: number;
  @ApiProperty({ description: 'ในจำนวนนั้น ที่ยังไม่ปิด' }) open: number;
  @ApiProperty({ description: 'ในจำนวนนั้น ที่ซ่อมเสร็จแล้ว' }) completed: number;
  @ApiProperty({ description: 'เครื่องที่เปิดใช้งานในห้อง (ตอนนี้)' }) equipmentCount: number;
  @ApiProperty({ description: 'เครื่องที่มีใบแจ้งซ่อมยังไม่ปิด (ตอนนี้)' }) brokenNow: number;
}

export class StatEquipmentRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'PC-01' }) label: string;
  @ApiProperty() name: string;
}

export class StatEquipmentRoomRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'CS-201' }) code: string;
}

export class StatCategoryRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: CATEGORY_ICONS, enumName: 'CategoryIcon' }) icon: CategoryIcon;
}

export class TopEquipmentDto {
  @ApiProperty({ type: () => StatEquipmentRefDto }) equipment: StatEquipmentRefDto;
  @ApiProperty({ type: () => StatEquipmentRoomRefDto }) room: StatEquipmentRoomRefDto;
  @ApiProperty({ type: () => StatCategoryRefDto }) category: StatCategoryRefDto;
  @ApiProperty({ description: 'จำนวนที่แจ้งในช่วงนี้' }) total: number;
  @ApiProperty({ format: 'date-time', description: 'แจ้งครั้งล่าสุดในช่วงนี้' }) lastReportedAt: string;
}

export class StatisticsDto {
  @ApiProperty({ type: () => StatisticsRangeDto }) range: StatisticsRangeDto;
  @ApiProperty({ type: () => SnapshotDto, description: 'สถานะ ณ ตอนนี้ (ไม่ขึ้นกับช่วงวันที่)' })
  snapshot: SnapshotDto;
  @ApiProperty({ description: 'จำนวนที่แจ้งเข้ามาในช่วงนี้' }) created: number;
  @ApiProperty({ type: () => ResolutionDto, description: 'นับตามวันที่ปิดงานในช่วงนี้' })
  resolution: ResolutionDto;
  @ApiProperty({ type: () => SatisfactionDto, description: 'นับตามงานที่ปิดในช่วงนี้' })
  satisfaction: SatisfactionDto;
  @ApiProperty({ type: () => [StatusCountDto], description: 'ใบที่แจ้งในช่วงนี้ แยกตามสถานะปัจจุบัน' })
  byStatus: StatusCountDto[];
  @ApiProperty({ type: () => [PriorityCountDto] }) byPriority: PriorityCountDto[];
  @ApiProperty({ type: () => [NamedCountDto] }) byCategory: NamedCountDto[];
  @ApiProperty({ type: () => [BuildingCountDto] }) byBuilding: BuildingCountDto[];
  @ApiProperty({ type: () => [HotSpotDto], description: 'จุดที่แจ้งซ้ำบ่อย (≥ 2 ครั้ง) 5 อันดับแรก' })
  hotSpots: HotSpotDto[];
  @ApiProperty({ type: () => [TrendPointDto] }) trend: TrendPointDto[];
  @ApiProperty({ type: () => [TechnicianLoadDto] }) technicians: TechnicianLoadDto[];
  @ApiProperty({
    type: () => [RoomStatDto],
    description: 'ใบที่แจ้งในช่วงนี้แยกตามห้อง (เฉพาะใบที่ผูกห้อง) เรียงจากมากไปน้อย',
  })
  byRoom: RoomStatDto[];
  @ApiProperty({
    type: () => [TopEquipmentDto],
    description: 'เครื่องที่ถูกแจ้งบ่อยที่สุดในช่วงนี้ 10 อันดับ',
  })
  topEquipment: TopEquipmentDto[];
}

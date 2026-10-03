import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SubsystemRole } from '../auth/core-hub-identity';
import { CORE_ROLES, SUBSYSTEM_ROLES } from '../actor/technician';
import { PaginationQueryDto } from '../shared/pagination.dto';
import { trimToUndefined } from '../shared/transforms';

export const PERSON_CODE_DESCRIPTION =
  'รหัสนักศึกษา/บุคลากรจาก Core Hub (GET /people/me) · null = บัญชียังไม่ผูกกับบุคคลในทะเบียน';
export const AVATAR_URL_DESCRIPTION =
  'รูปโปรไฟล์ (GET ได้เมื่อเข้าสู่ระบบแล้ว) · null = ยังไม่มีรูป ให้แสดงอักษรย่อแทน';

/** ผู้ที่เคยเข้าระบบนี้ (ใช้เลือกช่างตอนมอบหมายงาน) */
export class ListProfilesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SUBSYSTEM_ROLES })
  @IsOptional()
  @IsIn(SUBSYSTEM_ROLES, { message: `role ต้องเป็นหนึ่งใน ${SUBSYSTEM_ROLES.join(', ')}` })
  role?: SubsystemRole;
}

export class ProfileDto {
  @ApiProperty({ format: 'uuid', description: 'id ของโปรไฟล์ในระบบนี้' }) id: string;
  @ApiProperty({ example: 'user-003', description: 'claim `sub` จาก Core Hub' }) coreUserId: string;
  @ApiProperty({ type: String, nullable: true, example: 'somsak.m', description: PERSON_CODE_DESCRIPTION })
  personCode: string | null;
  @ApiProperty({ enum: CORE_ROLES }) coreRole: string;
  @ApiProperty({
    enum: SUBSYSTEM_ROLES,
    nullable: true,
    description: 'null = core role นี้เข้าระบบไม่ได้แล้ว',
  })
  subsystemRole: SubsystemRole | null;
  @ApiProperty() isTechnician: boolean;
  @ApiProperty({
    example: 'somsak.m',
    description: 'รายการไม่หาชื่อจาก Core Hub ทีละแถว จึงเป็น personCode (reference-data.md ข้อ 7.2)',
  })
  displayName: string;
  @ApiProperty({ type: String, nullable: true, description: AVATAR_URL_DESCRIPTION }) avatarUrl:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastSeenAt: string | null;
}

/** รายชื่อบุคคลจาก Core Hub (หน้า "ผู้ใช้และช่าง" ของผู้ดูแล) */
export class ListPeopleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100, description: 'ค้นในรหัสและชื่อ (Core Hub)' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'คำค้นต้องเป็นข้อความ' })
  @MaxLength(100, { message: 'คำค้นยาวได้ไม่เกิน 100 ตัวอักษร' })
  q?: string;

  @ApiPropertyOptional({ enum: ['STUDENT', 'STAFF'], default: 'STUDENT' })
  @IsOptional()
  @IsIn(['STUDENT', 'STAFF'], { message: 'personType ต้องเป็น STUDENT หรือ STAFF' })
  personType: 'STUDENT' | 'STAFF' = 'STUDENT';
}

/**
 * บุคคลจาก Core Hub + สิ่งที่ระบบนี้เก็บเกี่ยวกับคนนั้น (ใบแจ้งซ่อม · การแต่งตั้งช่าง)
 * ชื่อแสดงตอนดูเท่านั้น ไม่เก็บลงฐาน
 */
export class PersonListItemDto {
  @ApiProperty({ example: '6504101234' }) personCode: string;
  @ApiProperty({ example: 'นางสาวกริญญา ทาเกร' }) fullName: string;
  @ApiProperty({ enum: ['STUDENT', 'STAFF'] }) personType: string;
  @ApiProperty({ type: String, nullable: true, description: 'ประเภทบุคลากร เช่น LECTURER' }) staffType:
    string | null;
  @ApiProperty({ example: 'ACTIVE' }) status: string;
  @ApiProperty({ type: String, nullable: true }) departmentName: string | null;
  @ApiProperty({ description: 'เคยเข้าระบบแจ้งซ่อมแล้ว' }) hasProfile: boolean;
  @ApiProperty() isTechnician: boolean;
  @ApiProperty({ description: 'แต่งตั้งเป็นช่างได้ (บุคลากรสายสนับสนุนที่มีบัญชีใน Core Hub)' })
  canBeTechnician: boolean;
  @ApiProperty({ description: 'ใบแจ้งซ่อมที่คนนี้แจ้งในระบบนี้' }) requestCount: number;
  @ApiProperty({ description: 'ที่ยังไม่ปิดงาน' }) openRequestCount: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastSeenAt: string | null;
}

export class SetTechnicianDto {
  @ApiProperty({ description: 'แต่งตั้ง (true) / ถอดถอน (false) ช่างซ่อมบำรุง' })
  @IsBoolean({ message: 'isTechnician ต้องเป็น true หรือ false' })
  isTechnician: boolean;
}

export class SessionDto {
  @ApiProperty({ format: 'date-time', description: 'token หมดอายุเมื่อไร — ต่ออายุล่วงหน้าผ่าน /auth/login' })
  expiresAt: string;
}

/**
 * ผู้เรียกในมุมของระบบแจ้งซ่อม — GET /api/v1/profiles/me
 * (GET /api/v1/me คงรูปแบบของ reference implementation สำหรับ conformance)
 */
export class MyProfileDto {
  @ApiProperty({ example: 'user-003', description: 'เท่ากับ claim `sub` ของ token' }) id: string;
  @ApiProperty({ enum: CORE_ROLES, description: 'เท่ากับ claim `role` ของ token' }) coreRole: string;
  @ApiProperty({ enum: SUBSYSTEM_ROLES, description: 'role ที่ใช้จริง (รวมการแต่งตั้งช่าง)' })
  subsystemRole: SubsystemRole;
  @ApiProperty({ type: [String], example: ['repair-request:create'] }) permissions: string[];
  @ApiProperty({ type: String, nullable: true, description: PERSON_CODE_DESCRIPTION }) personCode:
    string | null;
  @ApiProperty({
    example: 'นายสมชาย ใจดี',
    description: 'ชื่อจาก Core Hub (GET /people/me) · ดูไม่ได้ = รหัส',
  })
  displayName: string;
  @ApiProperty({ description: 'false = ชื่อด้านบนไม่ได้มาจาก Core Hub' }) nameFromCoreHub: boolean;
  @ApiProperty({ type: String, nullable: true, description: AVATAR_URL_DESCRIPTION }) avatarUrl:
    string | null;
  @ApiProperty({ type: () => SessionDto }) session: SessionDto;
}

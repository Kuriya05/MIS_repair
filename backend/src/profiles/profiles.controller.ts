import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentActor } from '../actor/current-actor.decorator';
import type { RepairActor } from '../actor/repair-actor';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { displayNameFrom, PeopleDirectory } from '../directory/people-directory';
import { MAX_IMAGE_BYTES, type UploadedImage } from '../repair-images/image-storage';
import { ApiEnvelope, ApiErrors, ApiPageEnvelope, DeletedDto } from '../shared/swagger';
import { UuidParam } from '../shared/uuid.pipe';
import { avatarUrlOf, toProfileView } from './profile.view';
import {
  ListPeopleQueryDto,
  ListProfilesQueryDto,
  MyProfileDto,
  PersonListItemDto,
  ProfileDto,
  SetTechnicianDto,
} from './profiles.dto';
import { ProfilesService } from './profiles.service';

/** โปรไฟล์ในระบบแจ้งซ่อม (รูปโปรไฟล์ · การแต่งตั้งช่าง) และรายชื่อบุคคลจาก Core Hub สำหรับผู้ดูแล */
@ApiTags('profiles')
@ApiBearerAuth()
@Controller('v1/profiles')
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly directory: PeopleDirectory,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'ผู้เรียกในมุมของระบบแจ้งซ่อม (ชื่อจาก Core Hub · role ที่ใช้จริง · สิทธิ์ · รูป)',
  })
  @ApiEnvelope(MyProfileDto)
  @ApiErrors()
  async me(@CurrentActor() actor: RepairActor, @CoreHubAccessToken() token: string): Promise<MyProfileDto> {
    const [profile, person] = await Promise.all([
      this.profiles.getByCoreUserId(actor.coreUserId),
      this.directory.meForDisplay(token),
    ]);
    return {
      id: actor.coreUserId,
      coreRole: actor.coreRole,
      subsystemRole: actor.subsystemRole,
      permissions: [...actor.permissions].sort(),
      personCode: profile.personCode,
      displayName: person
        ? displayNameFrom(person.personCode, person)
        : (profile.personCode ?? (actor.email.split('@')[0] || actor.coreUserId)),
      nameFromCoreHub: Boolean(person?.fullNameTh),
      avatarUrl: avatarUrlOf(profile),
      session: { expiresAt: new Date(actor.tokenExpiresAt * 1000).toISOString() },
    };
  }

  @Post('me/avatar')
  @RequirePermissions(Permission.PROFILE_UPDATE_OWN)
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 } }))
  @ApiOperation({ summary: 'เปลี่ยนรูปโปรไฟล์ของตัวเอง (JPG · PNG · WebP ไม่เกิน 2 MB ในช่อง avatar)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @ApiEnvelope(ProfileDto, { status: 201 })
  @ApiErrors(400, 403, 409)
  async uploadAvatar(@CurrentActor() actor: RepairActor, @UploadedFile() file: UploadedImage | undefined) {
    return toProfileView(await this.profiles.setAvatar(actor.coreUserId, file));
  }

  @Delete('me/avatar')
  @RequirePermissions(Permission.PROFILE_UPDATE_OWN)
  @ApiOperation({ summary: 'ลบรูปโปรไฟล์ของตัวเอง (กลับไปใช้อักษรย่อ)' })
  @ApiEnvelope(DeletedDto)
  @ApiErrors(403, 404, 409)
  removeAvatar(@CurrentActor() actor: RepairActor) {
    return this.profiles.removeAvatar(actor.coreUserId);
  }

  @Get()
  @RequirePermissions(Permission.PROFILE_READ_ANY, Permission.REPAIR_JOB_ASSIGN)
  @ApiOperation({ summary: 'ผู้ที่เคยเข้าระบบนี้ตาม role (ใช้เลือกช่างตอนมอบหมายงาน)' })
  @ApiPageEnvelope(ProfileDto)
  @ApiErrors(400, 403)
  list(@Query() query: ListProfilesQueryDto) {
    return this.profiles.list(query);
  }

  @Get('people')
  @RequirePermissions(Permission.PROFILE_READ_ANY)
  @ApiOperation({ summary: 'รายชื่อนักศึกษา/บุคลากรจาก Core Hub + จำนวนใบแจ้งซ่อมในระบบนี้' })
  @ApiPageEnvelope(PersonListItemDto)
  @ApiErrors(400, 403, 503)
  people(@Query() query: ListPeopleQueryDto, @CoreHubAccessToken() token: string) {
    return this.profiles.listPeople(query, token);
  }

  @Put('technicians/:personCode')
  @RequirePermissions(Permission.PROFILE_UPDATE_ANY)
  @ApiOperation({ summary: 'แต่งตั้ง/ถอดถอนช่างซ่อมบำรุง (บุคลากรสายสนับสนุนจาก Core Hub)' })
  @ApiErrors(400, 403, 404, 409, 503)
  setTechnician(
    @Param('personCode') personCode: string,
    @Body() dto: SetTechnicianDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.profiles.setTechnician(personCode, dto.isTechnician, token);
  }

  /**
   * ไฟล์รูปโปรไฟล์ (binary ไม่ห่อ envelope) · ผู้ใช้ที่เข้าระบบแล้วทุกคนเห็นได้
   * ส่งผ่าน @Res() เอง — ResponseInterceptor ของชั้นกลางห่อเฉพาะค่าที่ controller return
   */
  @Get(':id/avatar')
  @ApiOperation({ summary: 'รูปโปรไฟล์ (image/jpeg · image/png · image/webp)' })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiResponse({ status: 200, description: 'ไฟล์รูป', schema: { type: 'string', format: 'binary' } })
  @ApiErrors(400, 404)
  async avatar(@Param('id', UuidParam) id: string, @Res() res: Response) {
    const file = await this.profiles.openAvatar(id);
    // URL มี ?v= ที่เปลี่ยนตามรูป — cache ได้ยาวโดยไม่ค้างรูปเก่า
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', file.type);
    res.setHeader('Content-Length', String(file.size));
    file.stream.pipe(res);
  }
}

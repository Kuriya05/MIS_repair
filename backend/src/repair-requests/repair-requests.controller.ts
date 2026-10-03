import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { RepairActor } from '../actor/repair-actor';
import { CurrentActor } from '../actor/current-actor.decorator';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { ApiEnvelope, ApiErrors, ApiPageEnvelope } from '../shared/swagger';
import { UuidParam } from '../shared/uuid.pipe';
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_UPLOAD } from '../repair-images/image-storage';
import {
  AssignRepairRequestDto,
  CancelRepairRequestDto,
  ChangeStatusDto,
  CreateCommentDto,
  CreateRepairRequestDto,
  FollowStateDto,
  ListRepairRequestsQueryDto,
  RateRepairRequestDto,
  RepairRequestDetailDto,
  RepairRequestSummaryDto,
  RequestActivityDto,
  SimilarRepairRequestDto,
  SimilarRepairRequestsQueryDto,
  UpdateRepairRequestDto,
} from './repair-requests.dto';
import { RepairRequestsService } from './repair-requests.service';

/** รับรูปเข้าหน่วยความจำก่อน แล้ว ImageStorage ตรวจ magic bytes ก่อนเขียนลงดิสก์ */
const photos = () =>
  FilesInterceptor('photos', MAX_IMAGES_PER_UPLOAD, {
    limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES_PER_UPLOAD, fields: 20, fieldSize: 16 * 1024 },
  });

/** schema ของ multipart: ช่องข้อมูลของ DTO + ช่อง photos (ไฟล์ภาพสูงสุด 5 ไฟล์) */
const multipartBody = (dto: new () => unknown) =>
  ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(dto) },
        {
          type: 'object',
          properties: {
            photos: {
              type: 'array',
              maxItems: MAX_IMAGES_PER_UPLOAD,
              items: { type: 'string', format: 'binary' },
              description: 'JPG / PNG / WebP ไม่เกิน 8 MB ต่อไฟล์',
            },
          },
        },
      ],
    },
  });

@ApiTags('repair-requests')
@ApiBearerAuth()
@ApiExtraModels(CreateRepairRequestDto, ChangeStatusDto)
@Controller('v1/repair-requests')
export class RepairRequestsController {
  constructor(private readonly requests: RepairRequestsService) {}

  @Get()
  @RequirePermissions(Permission.REPAIR_REQUEST_READ_OWN, Permission.REPAIR_REQUEST_READ_ANY)
  @ApiOperation({ summary: 'รายการใบแจ้งซ่อม (ของฉัน / งานที่ฉันรับผิดชอบ / ทั้งหมด)' })
  @ApiPageEnvelope(RepairRequestSummaryDto)
  @ApiErrors(400, 403)
  list(
    @CurrentActor() user: RepairActor,
    @CoreHubAccessToken() token: string,
    @Query() query: ListRepairRequestsQueryDto,
  ) {
    return this.requests.list(user, token, query);
  }

  @Get('similar')
  @RequirePermissions(Permission.REPAIR_REQUEST_CREATE)
  @ApiOperation({ summary: 'ใบที่ยังเปิดอยู่และน่าจะเป็นเรื่องเดียวกัน (ใช้ตอนกรอกฟอร์มแจ้งซ่อม)' })
  @ApiEnvelope(SimilarRepairRequestDto, { isArray: true })
  @ApiErrors(400, 403)
  similar(@CurrentActor() user: RepairActor, @Query() query: SimilarRepairRequestsQueryDto) {
    return this.requests.similar(user, query);
  }

  @Post(':id/followers')
  @RequirePermissions(Permission.REPAIR_REQUEST_FOLLOW)
  @ApiOperation({ summary: '"ฉันก็เจอ" — ติดตามใบแจ้งซ่อมเดิมแทนการแจ้งซ้ำ' })
  @ApiEnvelope(FollowStateDto, { status: 201 })
  @ApiErrors(400, 403, 404, 409)
  follow(@CurrentActor() user: RepairActor, @Param('id', UuidParam) id: string) {
    return this.requests.follow(user, id);
  }

  @Delete(':id/followers/me')
  @RequirePermissions(Permission.REPAIR_REQUEST_FOLLOW)
  @ApiOperation({ summary: 'เลิกติดตามใบแจ้งซ่อมที่กด "ฉันก็เจอ" ไว้' })
  @ApiEnvelope(FollowStateDto)
  @ApiErrors(400, 403, 404)
  unfollow(@CurrentActor() user: RepairActor, @Param('id', UuidParam) id: string) {
    return this.requests.unfollow(user, id);
  }

  @Get(':id')
  @RequirePermissions(Permission.REPAIR_REQUEST_READ_OWN, Permission.REPAIR_REQUEST_READ_ANY)
  @ApiOperation({ summary: 'รายละเอียดใบแจ้งซ่อม พร้อมรูป ประวัติ และสิ่งที่ผู้เรียกทำได้' })
  @ApiEnvelope(RepairRequestDetailDto)
  @ApiErrors(400, 403, 404)
  get(
    @CurrentActor() user: RepairActor,
    @CoreHubAccessToken() token: string,
    @Param('id', UuidParam) id: string,
  ) {
    return this.requests.get(user, token, id);
  }

  @Post()
  @RequirePermissions(Permission.REPAIR_REQUEST_CREATE)
  @UseInterceptors(photos())
  @ApiOperation({ summary: 'แจ้งซ่อม (แนบรูปได้สูงสุด 5 รูปในช่อง photos)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @multipartBody(CreateRepairRequestDto)
  @ApiEnvelope(RepairRequestDetailDto, { status: 201 })
  @ApiErrors(400, 403)
  create(
    @CurrentActor() user: RepairActor,
    @CoreHubAccessToken() token: string,
    @Body() dto: CreateRepairRequestDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.requests.create(user, token, dto, files);
  }

  @Patch(':id')
  @RequirePermissions(Permission.REPAIR_JOB_UPDATE_OWN, Permission.REPAIR_JOB_UPDATE_ANY)
  @ApiOperation({ summary: 'เปลี่ยนความเร่งด่วน/หมวดหมู่ (ช่างผู้รับผิดชอบ · ผู้ดูแลระบบ)' })
  @ApiEnvelope(RepairRequestDetailDto)
  @ApiErrors(400, 403, 404, 409)
  update(
    @CurrentActor() user: RepairActor,
    @CoreHubAccessToken() token: string,
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateRepairRequestDto,
  ) {
    return this.requests.update(user, token, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.REPAIR_REQUEST_CANCEL_OWN)
  @ApiOperation({ summary: 'ผู้แจ้งยกเลิกใบแจ้งซ่อม (ก่อนช่างเริ่มงาน)' })
  @ApiEnvelope(RepairRequestDetailDto, { status: 201 })
  @ApiErrors(400, 403, 404, 409)
  cancel(
    @CurrentActor() user: RepairActor,
    @CoreHubAccessToken() token: string,
    @Param('id', UuidParam) id: string,
    @Body() dto: CancelRepairRequestDto,
  ) {
    return this.requests.cancel(user, token, id, dto);
  }

  @Post(':id/accept')
  @RequirePermissions(Permission.REPAIR_JOB_ACCEPT)
  @ApiOperation({ summary: 'ช่างรับงานที่ยังไม่มีผู้รับผิดชอบ' })
  @ApiEnvelope(RepairRequestDetailDto, { status: 201 })
  @ApiErrors(400, 403, 404, 409)
  accept(
    @CurrentActor() user: RepairActor,
    @CoreHubAccessToken() token: string,
    @Param('id', UuidParam) id: string,
  ) {
    return this.requests.accept(user, token, id);
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.REPAIR_JOB_ASSIGN)
  @ApiOperation({ summary: 'ผู้ดูแลระบบมอบหมาย/โอนงานให้ช่าง' })
  @ApiEnvelope(RepairRequestDetailDto, { status: 201 })
  @ApiErrors(400, 403, 404, 409)
  assign(
    @CurrentActor() user: RepairActor,
    @CoreHubAccessToken() token: string,
    @Param('id', UuidParam) id: string,
    @Body() dto: AssignRepairRequestDto,
  ) {
    return this.requests.assign(user, token, id, dto);
  }

  @Post(':id/status')
  @RequirePermissions(
    Permission.REPAIR_JOB_UPDATE_OWN,
    Permission.REPAIR_JOB_UPDATE_ANY,
    Permission.REPAIR_JOB_ACCEPT,
  )
  @UseInterceptors(photos())
  @ApiOperation({ summary: 'เริ่ม / พัก / ปิด / ปฏิเสธงาน (แนบรูปหลังซ่อมในช่อง photos ได้)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @multipartBody(ChangeStatusDto)
  @ApiEnvelope(RepairRequestDetailDto, { status: 201 })
  @ApiErrors(400, 403, 404, 409)
  changeStatus(
    @CurrentActor() user: RepairActor,
    @CoreHubAccessToken() token: string,
    @Param('id', UuidParam) id: string,
    @Body() dto: ChangeStatusDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.requests.changeStatus(user, token, id, dto, files);
  }

  @Post(':id/rating')
  @RequirePermissions(Permission.REPAIR_REQUEST_RATE_OWN)
  @ApiOperation({ summary: 'ผู้แจ้งให้คะแนนความพึงพอใจหลังซ่อมเสร็จ (ครั้งเดียว)' })
  @ApiEnvelope(RepairRequestDetailDto, { status: 201 })
  @ApiErrors(400, 403, 404, 409)
  rate(
    @CurrentActor() user: RepairActor,
    @CoreHubAccessToken() token: string,
    @Param('id', UuidParam) id: string,
    @Body() dto: RateRepairRequestDto,
  ) {
    return this.requests.rate(user, token, id, dto);
  }

  @Post(':id/comments')
  @RequirePermissions(Permission.REPAIR_REQUEST_COMMENT_OWN, Permission.REPAIR_REQUEST_COMMENT_ANY)
  @ApiOperation({ summary: 'แสดงความคิดเห็น/สอบถามในใบแจ้งซ่อม' })
  @ApiEnvelope(RequestActivityDto, { status: 201 })
  @ApiErrors(400, 403, 404, 409)
  comment(
    @CurrentActor() user: RepairActor,
    @CoreHubAccessToken() token: string,
    @Param('id', UuidParam) id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.requests.comment(user, token, id, dto);
  }
}

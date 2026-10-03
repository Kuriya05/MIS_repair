import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { MAX_IMAGE_BYTES, type UploadedImage } from '../repair-images/image-storage';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { badRequest } from '../shared/errors';
import { ApiEnvelope, ApiErrors, DeletedDto } from '../shared/swagger';
import { UuidParam } from '../shared/uuid.pipe';
import {
  CreateEquipmentDto,
  CreateRoomDto,
  EquipmentDetailDto,
  EquipmentInventoryDto,
  ListEquipmentQueryDto,
  ListRoomsQueryDto,
  QR_CODE_PATTERN,
  QrTargetDto,
  RoomDetailDto,
  RoomDto,
  UpdateEquipmentDto,
  UpdateRoomDto,
} from './rooms.dto';
import { RoomsService } from './rooms.service';

/** multipart ช่อง photo ไฟล์เดียว — multer ตัดที่ 8 MB (เหมือนรูปโปรไฟล์) · service ตรวจ 5 MB และตอบเป็นภาษาไทย */
const PhotoUpload = () =>
  UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 } }));

const PhotoBody = () =>
  ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  });

/** ส่งไฟล์รูปผ่าน @Res() เอง — ResponseInterceptor ของชั้นกลางห่อเฉพาะค่าที่ controller return */
function sendPhoto(res: Response, file: { stream: NodeJS.ReadableStream; size: number; type: string }) {
  // URL มี ?v= ที่เปลี่ยนเมื่อแก้ไข — cache ได้ยาวโดยไม่ค้างรูปเก่า
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', file.type);
  res.setHeader('Content-Length', String(file.size));
  res.setHeader('Content-Disposition', 'inline');
  file.stream.pipe(res);
}

/**
 * ห้อง → เครื่องในห้อง → แจ้งซ่อม · ทุกคนดูได้ (พร้อมสถานะของแต่ละเครื่อง)
 * เพิ่ม/แก้/ลบ ห้องและเครื่องเฉพาะผู้ดูแลระบบแจ้งซ่อม (room:manage)
 */
@ApiTags('rooms')
@ApiBearerAuth()
@Controller('v1')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('rooms')
  @RequirePermissions(Permission.BUILDING_READ)
  @ApiOperation({ summary: 'ห้องทั้งหมด (กรองตามอาคาร) พร้อมสรุปสถานะเครื่องในห้อง' })
  @ApiEnvelope(RoomDto, { isArray: true })
  @ApiErrors(400, 403)
  list(@Query() query: ListRoomsQueryDto, @CoreHubAccessToken() token: string) {
    return this.rooms.list(query, token);
  }

  @Get('rooms/:id')
  @RequirePermissions(Permission.BUILDING_READ)
  @ApiOperation({ summary: 'ห้อง + เครื่องทั้งหมดในห้องพร้อมสถานะ (แจ้งแล้ว / กำลังซ่อม / รออะไหล่)' })
  @ApiEnvelope(RoomDetailDto)
  @ApiErrors(400, 403, 404)
  get(@Param('id', UuidParam) id: string, @CoreHubAccessToken() token: string) {
    return this.rooms.get(id, token);
  }

  @Post('rooms')
  @RequirePermissions(Permission.ROOM_MANAGE)
  @ApiOperation({ summary: 'เพิ่มห้อง (ระบบสุ่มรหัส QR ของห้องให้)' })
  @ApiEnvelope(RoomDetailDto, { status: 201 })
  @ApiErrors(400, 403, 503)
  create(@Body() dto: CreateRoomDto, @CoreHubAccessToken() token: string) {
    return this.rooms.create(dto, token);
  }

  @Patch('rooms/:id')
  @RequirePermissions(Permission.ROOM_MANAGE)
  @ApiOperation({ summary: 'แก้ไขห้อง / เปิด-ปิดการใช้งาน' })
  @ApiEnvelope(RoomDetailDto)
  @ApiErrors(400, 403, 404, 503)
  update(
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateRoomDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.rooms.update(id, dto, token);
  }

  @Delete('rooms/:id')
  @RequirePermissions(Permission.ROOM_MANAGE)
  @ApiOperation({ summary: 'ลบห้องที่ยังไม่มีเครื่องและใบแจ้งซ่อม' })
  @ApiEnvelope(DeletedDto)
  @ApiErrors(400, 403, 404, 409)
  remove(@Param('id', UuidParam) id: string) {
    return this.rooms.remove(id);
  }

  @Post('rooms/:id/photo')
  @RequirePermissions(Permission.ROOM_MANAGE)
  @PhotoUpload()
  @ApiOperation({ summary: 'อัปโหลด/เปลี่ยนรูปห้อง (JPG · PNG · WebP ไม่เกิน 5 MB ในช่อง photo)' })
  @ApiConsumes('multipart/form-data')
  @PhotoBody()
  @ApiEnvelope(RoomDetailDto, { status: 201 })
  @ApiErrors(400, 403, 404, 409)
  uploadRoomPhoto(
    @Param('id', UuidParam) id: string,
    @UploadedFile() file: UploadedImage | undefined,
    @CoreHubAccessToken() token: string,
  ) {
    return this.rooms.setRoomPhoto(id, file, token);
  }

  @Delete('rooms/:id/photo')
  @RequirePermissions(Permission.ROOM_MANAGE)
  @ApiOperation({ summary: 'ลบรูปห้อง' })
  @ApiEnvelope(DeletedDto)
  @ApiErrors(400, 403, 404, 409)
  removeRoomPhoto(@Param('id', UuidParam) id: string) {
    return this.rooms.removeRoomPhoto(id);
  }

  @Get('rooms/:id/photo')
  @RequirePermissions(Permission.BUILDING_READ)
  @ApiOperation({ summary: 'ไฟล์รูปห้อง (image/jpeg · image/png · image/webp)' })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiResponse({ status: 200, description: 'ไฟล์รูป', schema: { type: 'string', format: 'binary' } })
  @ApiErrors(400, 403, 404)
  async roomPhoto(@Param('id', UuidParam) id: string, @Res() res: Response) {
    sendPhoto(res, await this.rooms.openRoomPhoto(id));
  }

  @Post('rooms/:id/equipment')
  @RequirePermissions(Permission.ROOM_MANAGE)
  @ApiOperation({ summary: 'เพิ่มเครื่องในห้อง (ใส่ count เพื่อเพิ่มหลายเครื่อง เช่น PC-01 ถึง PC-30)' })
  @ApiEnvelope(RoomDetailDto, { status: 201 })
  @ApiErrors(400, 403, 404)
  addEquipment(
    @Param('id', UuidParam) id: string,
    @Body() dto: CreateEquipmentDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.rooms.addEquipment(id, dto, token);
  }

  @Get('equipment')
  @RequirePermissions(Permission.BUILDING_READ)
  @ApiOperation({
    summary: 'ทะเบียนครุภัณฑ์ — เครื่องทุกห้อง (กรองตามอาคาร/ห้อง/ประเภท/คำค้น) ไม่แบ่งหน้า สูงสุด 2000 แถว',
  })
  @ApiEnvelope(EquipmentInventoryDto, { isArray: true })
  @ApiErrors(400, 403)
  inventory(@Query() query: ListEquipmentQueryDto) {
    return this.rooms.inventory(query);
  }

  @Get('equipment/:id')
  @RequirePermissions(Permission.BUILDING_READ)
  @ApiOperation({ summary: 'ข้อมูลเครื่อง + สถานะ + ประวัติการแจ้งซ่อม' })
  @ApiEnvelope(EquipmentDetailDto)
  @ApiErrors(400, 403, 404)
  getEquipment(@Param('id', UuidParam) id: string, @CoreHubAccessToken() token: string) {
    return this.rooms.getEquipment(id, token);
  }

  @Patch('equipment/:id')
  @RequirePermissions(Permission.ROOM_MANAGE)
  @ApiOperation({ summary: 'แก้ไขเครื่อง / ย้ายห้อง / เปิด-ปิดการใช้งาน' })
  @ApiEnvelope(EquipmentDetailDto)
  @ApiErrors(400, 403, 404)
  updateEquipment(
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateEquipmentDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.rooms.updateEquipment(id, dto, token);
  }

  @Delete('equipment/:id')
  @RequirePermissions(Permission.ROOM_MANAGE)
  @ApiOperation({ summary: 'ลบเครื่องที่ยังไม่เคยแจ้งซ่อม' })
  @ApiEnvelope(DeletedDto)
  @ApiErrors(400, 403, 404, 409)
  removeEquipment(@Param('id', UuidParam) id: string) {
    return this.rooms.removeEquipment(id);
  }

  @Post('equipment/:id/photo')
  @RequirePermissions(Permission.ROOM_MANAGE)
  @PhotoUpload()
  @ApiOperation({ summary: 'อัปโหลด/เปลี่ยนรูปเครื่อง (JPG · PNG · WebP ไม่เกิน 5 MB ในช่อง photo)' })
  @ApiConsumes('multipart/form-data')
  @PhotoBody()
  @ApiEnvelope(EquipmentDetailDto, { status: 201 })
  @ApiErrors(400, 403, 404, 409)
  uploadEquipmentPhoto(
    @Param('id', UuidParam) id: string,
    @UploadedFile() file: UploadedImage | undefined,
    @CoreHubAccessToken() token: string,
  ) {
    return this.rooms.setEquipmentPhoto(id, file, token);
  }

  @Delete('equipment/:id/photo')
  @RequirePermissions(Permission.ROOM_MANAGE)
  @ApiOperation({ summary: 'ลบรูปเครื่อง' })
  @ApiEnvelope(DeletedDto)
  @ApiErrors(400, 403, 404, 409)
  removeEquipmentPhoto(@Param('id', UuidParam) id: string) {
    return this.rooms.removeEquipmentPhoto(id);
  }

  @Get('equipment/:id/photo')
  @RequirePermissions(Permission.BUILDING_READ)
  @ApiOperation({ summary: 'ไฟล์รูปเครื่อง (image/jpeg · image/png · image/webp)' })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiResponse({ status: 200, description: 'ไฟล์รูป', schema: { type: 'string', format: 'binary' } })
  @ApiErrors(400, 403, 404)
  async equipmentPhoto(@Param('id', UuidParam) id: string, @Res() res: Response) {
    sendPhoto(res, await this.rooms.openEquipmentPhoto(id));
  }

  @Get('qr-codes/:code')
  @RequirePermissions(Permission.BUILDING_READ)
  @ApiOperation({ summary: 'สแกน QR — รหัสนี้เป็นของห้องหรือเครื่องไหน' })
  @ApiEnvelope(QrTargetDto)
  @ApiErrors(400, 403, 404)
  resolveQr(@Param('code') raw: string) {
    const code = raw.trim().toUpperCase();
    if (!QR_CODE_PATTERN.test(code)) throw badRequest('รหัส QR ต้องเป็นตัวอักษร/ตัวเลข 8 ตัว');
    return this.rooms.resolveQr(code);
  }
}

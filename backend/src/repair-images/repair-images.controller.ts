import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RepairActor } from '../actor/repair-actor';
import { CurrentActor } from '../actor/current-actor.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { forbidden, notFound } from '../shared/errors';
import { ApiErrors } from '../shared/swagger';
import { UuidParam } from '../shared/uuid.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { canRead } from '../repair-requests/workflow';
import { ImageStorage } from './image-storage';

/**
 * ไฟล์รูปงานซ่อม — ส่งเป็น binary (ไม่ห่อ envelope เพราะเป็นไฟล์ ไม่ใช่ JSON)
 * สิทธิ์เหมือนการอ่านใบแจ้งซ่อม: ผู้แจ้งเห็นรูปของใบตัวเอง ช่าง/ผู้ดูแลเห็นทุกใบ
 * error ยังเป็น error envelope ตามปกติ
 */
@ApiTags('repair-images')
@ApiBearerAuth()
@Controller('v1/repair-images')
export class RepairImagesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorage,
  ) {}

  @Get(':id/file')
  @RequirePermissions(Permission.REPAIR_REQUEST_READ_OWN, Permission.REPAIR_REQUEST_READ_ANY)
  @ApiOperation({ summary: 'ไฟล์รูปงานซ่อม (image/jpeg · image/png · image/webp)' })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiResponse({ status: 200, description: 'ไฟล์รูป', schema: { type: 'string', format: 'binary' } })
  @ApiErrors(400, 403, 404)
  async file(@Param('id', UuidParam) id: string, @CurrentActor() user: RepairActor, @Res() res: Response) {
    const image = await this.prisma.repairImage.findUnique({
      where: { id },
      include: {
        repairRequest: { select: { status: true, coreUserId: true, assigneeCoreUserId: true, rating: true } },
      },
    });
    if (!image) throw notFound('ไม่พบรูปนี้ อาจถูกลบไปแล้ว');
    if (!canRead(user, image.repairRequest)) throw forbidden('คุณไม่มีสิทธิ์ดูรูปของใบแจ้งซ่อมนี้');

    const file = await this.storage.open(image.filename);
    if (!file) throw notFound('ไฟล์รูปนี้ไม่อยู่ในที่เก็บแล้ว');

    // ส่งผ่าน @Res() เอง — ResponseInterceptor ของชั้นกลางห่อเฉพาะค่าที่ controller return
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', image.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('Content-Disposition', 'inline');
    file.stream.pipe(res);
  }
}

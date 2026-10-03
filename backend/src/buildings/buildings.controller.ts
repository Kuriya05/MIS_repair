import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { Permission } from '../auth/permissions';
import { ApiEnvelope, ApiErrors, ApiPageEnvelope } from '../shared/swagger';
import { BuildingDto, ListBuildingsQueryDto } from './buildings.dto';
import { BuildingsService } from './buildings.service';

/** อาคารจากข้อมูลกลางของ Core Hub — อ่านอย่างเดียว (เพิ่ม/แก้อาคารทำที่ backoffice ของ Core Hub) */
@ApiTags('buildings')
@ApiBearerAuth()
@Controller('v1/buildings')
export class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  @Get()
  @RequirePermissions(Permission.BUILDING_READ)
  @ApiOperation({ summary: 'รายการอาคาร (จาก Core Hub)' })
  @ApiPageEnvelope(BuildingDto)
  @ApiErrors(400, 403, 503)
  list(@Query() query: ListBuildingsQueryDto, @CoreHubAccessToken() token: string) {
    return this.buildings.list(query, token);
  }

  @Get(':code')
  @RequirePermissions(Permission.BUILDING_READ)
  @ApiOperation({ summary: 'ข้อมูลอาคารตาม code ของ Core Hub' })
  @ApiEnvelope(BuildingDto)
  @ApiErrors(400, 403, 404, 503)
  get(@Param('code') code: string, @CoreHubAccessToken() token: string) {
    return this.buildings.get(code, token);
  }
}

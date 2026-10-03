import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { Permission } from '../auth/permissions';
import { ApiEnvelope, ApiErrors } from '../shared/swagger';
import { StatisticsDto, StatisticsQueryDto } from './statistics.dto';
import { StatisticsService } from './statistics.service';

/** ภาพรวมงานซ่อมสำหรับแดชบอร์ด — ช่างและผู้ดูแลระบบ */
@ApiTags('statistics')
@ApiBearerAuth()
@Controller('v1/statistics')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get()
  @RequirePermissions(Permission.STATISTICS_READ)
  @ApiOperation({ summary: 'สถิติงานซ่อมในช่วงวันที่ (ค่าเริ่มต้น 30 วันล่าสุด)' })
  @ApiEnvelope(StatisticsDto)
  @ApiErrors(400, 403)
  summary(@Query() query: StatisticsQueryDto, @CoreHubAccessToken() token: string) {
    return this.statistics.summary(query, token);
  }
}

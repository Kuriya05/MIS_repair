import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { ApiEnvelope, ApiErrors, ApiPageEnvelope, DeletedDto } from '../shared/swagger';
import { UuidParam } from '../shared/uuid.pipe';
import { CategoryDto, CreateCategoryDto, ListCategoriesQueryDto, UpdateCategoryDto } from './categories.dto';
import { CategoriesService } from './categories.service';

/** หมวดหมู่งานซ่อม — ทุกคนอ่านได้ · เพิ่ม/แก้/ลบเฉพาะผู้ดูแลระบบแจ้งซ่อม */
@ApiTags('categories')
@ApiBearerAuth()
@Controller('v1/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions(Permission.CATEGORY_READ)
  @ApiOperation({ summary: 'รายการหมวดหมู่งานซ่อม' })
  @ApiPageEnvelope(CategoryDto)
  @ApiErrors(400, 403)
  list(@Query() query: ListCategoriesQueryDto) {
    return this.categories.list(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.CATEGORY_READ)
  @ApiOperation({ summary: 'ข้อมูลหมวดหมู่' })
  @ApiEnvelope(CategoryDto)
  @ApiErrors(400, 403, 404)
  get(@Param('id', UuidParam) id: string) {
    return this.categories.get(id);
  }

  @Post()
  @RequirePermissions(Permission.CATEGORY_CREATE)
  @ApiOperation({ summary: 'เพิ่มหมวดหมู่' })
  @ApiEnvelope(CategoryDto, { status: 201 })
  @ApiErrors(400, 403, 409)
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CATEGORY_UPDATE)
  @ApiOperation({ summary: 'แก้ไขหมวดหมู่ / เปิด-ปิดการใช้งาน' })
  @ApiEnvelope(CategoryDto)
  @ApiErrors(400, 403, 404, 409)
  update(@Param('id', UuidParam) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CATEGORY_DELETE)
  @ApiOperation({ summary: 'ลบหมวดหมู่ที่ยังไม่มีใบแจ้งซ่อม' })
  @ApiEnvelope(DeletedDto)
  @ApiErrors(400, 403, 404, 409)
  remove(@Param('id', UuidParam) id: string) {
    return this.categories.remove(id);
  }
}

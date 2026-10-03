import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * ฐานข้อมูลของระบบนี้เท่านั้น (repair_db — ไม่ใช่ฐานของ Core Hub) · Prisma 7 + driver adapter
 * เชื่อมต่อเมื่อมี query แรก ไม่ต่อฐานข้อมูลตอนบูต (สร้าง openapi.json ได้โดยไม่มีฐานข้อมูล)
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

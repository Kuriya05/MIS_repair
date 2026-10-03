/**
 * สร้าง backend/openapi.json จาก decorator ของ controller/DTO (tech-stack.md ข้อ 3 · CI กฎ API-01)
 *
 *   pnpm --filter backend generate:openapi
 *
 * ไม่ต้องมีฐานข้อมูลหรือ Core Hub: PrismaService ต่อฐานข้อมูลเมื่อมี query แรกเท่านั้น
 * ผลลัพธ์ต้องเหมือนเดิมทุกครั้งที่โค้ดไม่เปลี่ยน — ห้ามใส่เวลา/ค่า env ลงในเอกสาร
 */
process.env.DATABASE_URL ??= 'postgresql://openapi-generation/unused';

import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { configureApp, ROUTES_OUTSIDE_API_PREFIX } from '../src/app-setup';

const OUTPUT = resolve(__dirname, '..', 'openapi.json');

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  // ตรงกับ main.ts — /auth/* อยู่นอก prefix /api
  app.setGlobalPrefix('api', { exclude: ROUTES_OUTSIDE_API_PREFIX });
  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('csmju-maintenance-request API')
    .setDescription(
      'ระบบแจ้งซ่อม — ระบบย่อยของ CSMJU2030 · ทุก endpoint ใต้ /api/v1 ต้องมี Core Hub access token ' +
        '(Authorization: Bearer หรือคุกกี้ csmju_maintenance_request_access_token) · response ห่อด้วย envelope มาตรฐาน',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT (RS256 จาก Core Hub)' })
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`openapi: ${Object.keys(document.paths).length} paths → ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

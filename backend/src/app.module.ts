import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RepairActorGuard } from './actor/repair-actor.guard';
import { AuthModule } from './auth/auth.module';
import { CoreHubJwtGuard } from './auth/guards/core-hub-jwt.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { BuildingsModule } from './buildings/buildings.module';
import { CategoriesModule } from './categories/categories.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DirectoryModule } from './directory/directory.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RepairImagesModule } from './repair-images/repair-images.module';
import { RepairRequestsModule } from './repair-requests/repair-requests.module';
import { RoomsModule } from './rooms/rooms.module';
import { StatisticsModule } from './statistics/statistics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env', '../.env'],
    }),
    PrismaModule,
    AuthModule,
    DirectoryModule,
    HealthModule,
    ProfilesModule,
    BuildingsModule,
    RoomsModule,
    CategoriesModule,
    RepairRequestsModule,
    RepairImagesModule,
    NotificationsModule,
    StatisticsModule,
  ],
  providers: [
    // Every route is authenticated unless explicitly marked @Public().
    { provide: APP_GUARD, useClass: CoreHubJwtGuard },
    // Layer 2 ของโดเมน: บันทึกโปรไฟล์ + ยกช่างที่แต่งตั้งเป็น TECHNICIAN ก่อนตรวจสิทธิ์
    { provide: APP_GUARD, useClass: RepairActorGuard },
    // Authorization runs after authentication.
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

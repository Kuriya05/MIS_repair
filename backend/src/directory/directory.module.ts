import { Global, Module } from '@nestjs/common';
import { CoreHubModule } from '../core-hub/core-hub.module';
import { BuildingsDirectory } from './buildings-directory';
import { PeopleDirectory } from './people-directory';

/** ข้อมูลกลางที่โดเมนแจ้งซ่อมใช้ (อาคาร · บุคคล) — อยู่บน CoreHubModule ของชั้นกลาง */
@Global()
@Module({
  imports: [CoreHubModule],
  providers: [BuildingsDirectory, PeopleDirectory],
  exports: [BuildingsDirectory, PeopleDirectory, CoreHubModule],
})
export class DirectoryModule {}

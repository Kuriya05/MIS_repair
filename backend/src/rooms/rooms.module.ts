import { Module } from '@nestjs/common';
import { RepairImagesModule } from '../repair-images/repair-images.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [RepairImagesModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}

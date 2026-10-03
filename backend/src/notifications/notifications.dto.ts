import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../shared/pagination.dto';
import { toBoolean } from '../shared/transforms';

export class NotificationDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'ช่างรับเรื่องแล้ว' }) title: string;
  @ApiProperty({ example: 'สมชาย ใจดี รับงาน RP-6909-0012 แล้ว' }) message: string;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '/requests/2b8f…',
    description: 'path ภายในเว็บของระบบนี้',
  })
  link: string | null;
  @ApiProperty() isRead: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'false = เฉพาะที่ยังไม่อ่าน (meta.total คือจำนวนที่ยังไม่อ่าน)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isRead ต้องเป็น true หรือ false' })
  isRead?: boolean;
}

export class UpdateNotificationDto {
  @ApiProperty()
  @IsBoolean({ message: 'isRead ต้องเป็น true หรือ false' })
  isRead: boolean;
}

export class MarkAllNotificationsDto {
  @ApiProperty({ enum: [true], description: 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมด' })
  @IsIn([true], { message: 'isRead ต้องเป็น true' })
  isRead: true;
}

export class MarkAllResultDto {
  @ApiProperty({ description: 'จำนวนการแจ้งเตือนที่เปลี่ยนเป็นอ่านแล้ว' }) updated: number;
}

import { Injectable } from '@nestjs/common';
import type { Notification, Prisma } from '../../generated/prisma/client';
import { forbidden, notFound } from '../shared/errors';
import { Paginated } from '../shared/paginated';
import { pageArgs } from '../shared/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { ListNotificationsQueryDto, NotificationDto } from './notifications.dto';

export type NotificationDraft = { title: string; message: string; link?: string };

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function toNotificationDto(row: Notification): NotificationDto {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    link: row.link,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ส่งการแจ้งเตือนในระบบให้หลายคนพร้อมกัน — ข้ามผู้ที่เป็นคนทำรายการเอง
   * ใช้ client ใน transaction ได้ เพื่อให้การแจ้งเตือนเกิดพร้อมกับการเปลี่ยนสถานะเสมอ
   */
  async notify(
    recipients: (string | null | undefined)[],
    draft: NotificationDraft,
    options: { exclude?: string; db?: Prisma.TransactionClient } = {},
  ) {
    const unique = [
      ...new Set(recipients.filter((id): id is string => Boolean(id) && id !== options.exclude)),
    ];
    if (unique.length === 0) return;
    await (options.db ?? this.prisma).notification.createMany({
      data: unique.map((coreUserId) => ({
        coreUserId,
        title: clip(draft.title, 200),
        message: clip(draft.message, 2000),
        link: draft.link ?? null,
      })),
    });
  }

  async list(coreUserId: string, query: ListNotificationsQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      coreUserId,
      ...(query.isRead !== undefined && { isRead: query.isRead }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return Paginated.of(rows.map(toNotificationDto), total, query.page, query.limit);
  }

  /** :own — แก้ได้เฉพาะการแจ้งเตือนของตัวเอง (ของคนอื่น = 403 ไม่ใช่ 404) */
  async setRead(coreUserId: string, id: string, isRead: boolean) {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row) throw notFound('ไม่พบการแจ้งเตือนนี้');
    if (row.coreUserId !== coreUserId) throw forbidden('การแจ้งเตือนนี้ไม่ใช่ของคุณ');
    const updated = await this.prisma.notification.update({ where: { id }, data: { isRead } });
    return toNotificationDto(updated);
  }

  async markAllRead(coreUserId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { coreUserId, isRead: false },
      data: { isRead: true },
    });
    return { updated: count };
  }
}

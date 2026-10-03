import { Injectable } from '@nestjs/common';
import type { Prisma, Profile } from '../../generated/prisma/client';
import { AppException } from '../common/errors';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { SubsystemRole } from '../auth/core-hub-identity';
import { TECHNICIAN_ELIGIBLE_CORE_ROLE } from '../actor/technician';
import { PeopleService } from '../core-hub/people.service';
import { PeopleDirectory, type CorePerson } from '../directory/people-directory';
import { PrismaService } from '../prisma/prisma.service';
import { ImageStorage, type UploadedImage } from '../repair-images/image-storage';
import { OPEN_STATUSES } from '../repair-requests/sla';
import { conflict, notFound, validationError } from '../shared/errors';
import { Paginated } from '../shared/paginated';
import { pageArgs } from '../shared/pagination.dto';
import { toProfileView } from './profile.view';
import type { ListPeopleQueryDto, ListProfilesQueryDto, PersonListItemDto } from './profiles.dto';

const TOUCH_TTL_MS = 30_000;
/** บัญชีที่ /people/me ยังไม่มีบุคคล (เช่น บัญชีทดสอบ) ลองถามใหม่ไม่ถี่กว่านี้ */
const PERSON_CODE_RETRY_MS = 10 * 60_000;
const OPEN_JOB_STATUSES = ['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'] as const;
/** หน้าเว็บย่อรูปเป็นสี่เหลี่ยม 512px ก่อนส่ง (~50 KB) — เผื่อไว้ 2 MB สำหรับ client อื่น */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** เงื่อนไขค้นหาตาม role ที่ใช้จริง (ต้องสอดคล้องกับ actor/technician.ts) */
export function subsystemRoleWhere(role: SubsystemRole): Prisma.ProfileWhereInput {
  switch (role) {
    case SubsystemRole.ADMIN:
      return { coreRole: 'admin' };
    case SubsystemRole.TECHNICIAN:
      return { coreRole: TECHNICIAN_ELIGIBLE_CORE_ROLE, isTechnician: true };
    case SubsystemRole.USER:
      return {
        OR: [
          { coreRole: { in: ['student', 'lecturer'] } },
          { coreRole: TECHNICIAN_ELIGIBLE_CORE_ROLE, isTechnician: false },
        ],
      };
  }
}

/** บุคลากรสายสนับสนุนที่มีบัญชี Core Hub — แต่งตั้งเป็นช่างได้ */
const canBeTechnician = (person: CorePerson) =>
  person.personType === 'STAFF' && person.staffType !== 'LECTURER' && Boolean(person.coreUserId);

/**
 * ข้อมูล local ของผู้ใช้ในระบบนี้ (รูปโปรไฟล์ · การแต่งตั้งช่าง) — ไม่เก็บชื่อ อีเมล หรือข้อมูลติดต่อ
 * core_role เป็นสำเนาจาก token ที่ตรวจแล้ว (ใช้กรองช่าง) · person_code มาจาก GET /people/me
 * (reference-data.md ข้อ 8 · data-dictionary.md ข้อ 10)
 */
@Injectable()
export class ProfilesService {
  private readonly touched = new Map<string, { at: number; profile: Profile }>();
  private readonly personCodeAskedAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorage,
    private readonly people: PeopleService,
    private readonly directory: PeopleDirectory,
  ) {}

  /** สร้าง/อัปเดตสำเนาจาก token ไม่เกิน 1 ครั้งต่อ 30 วินาทีต่อคน · หา person_code ครั้งแรกด้วย token ของผู้ใช้ */
  async touch(user: CoreHubIdentity, token: string): Promise<Profile> {
    const cached = this.touched.get(user.id);
    if (cached && Date.now() - cached.at < TOUCH_TTL_MS && cached.profile.coreRole === user.coreRole) {
      return cached.profile;
    }

    let profile = await this.prisma.profile.upsert({
      where: { coreUserId: user.id },
      create: { coreUserId: user.id, coreRole: user.coreRole, lastSeenAt: new Date() },
      update: { coreRole: user.coreRole, lastSeenAt: new Date() },
    });
    if (!profile.personCode) profile = await this.linkPersonCode(profile, token);
    this.touched.set(user.id, { at: Date.now(), profile });
    return profile;
  }

  /**
   * person_code ของผู้ใช้จาก GET /people/me (PeopleService ของชั้นกลาง) — ได้ null (ยังไม่ผูก/guest)
   * หรือ Core Hub ล่ม ก็ใช้งานต่อได้ · ลองใหม่ไม่ถี่กว่า 10 นาทีต่อคน · 401 ส่งต่อให้หน้าเว็บพา SSO ใหม่
   */
  private async linkPersonCode(profile: Profile, token: string): Promise<Profile> {
    const askedAt = this.personCodeAskedAt.get(profile.coreUserId) ?? 0;
    if (Date.now() - askedAt < PERSON_CODE_RETRY_MS) return profile;
    this.personCodeAskedAt.set(profile.coreUserId, Date.now());
    let personCode: string | null = null;
    try {
      personCode = await this.people.myPersonCode(token);
    } catch (error) {
      if (error instanceof AppException && error.code === 'UNAUTHORIZED') throw error;
    }
    if (!personCode) return profile;
    return this.prisma.profile.update({ where: { coreUserId: profile.coreUserId }, data: { personCode } });
  }

  forget(coreUserId: string) {
    this.touched.delete(coreUserId);
  }

  async getByCoreUserId(coreUserId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { coreUserId } });
    if (!profile) throw notFound('ไม่พบข้อมูลผู้ใช้');
    return profile;
  }

  /**
   * เปลี่ยนรูปโปรไฟล์ของตัวเอง — ตรวจชนิดไฟล์จาก magic bytes (ImageStorage) แล้วจึงลบรูปเดิม
   * เปลี่ยนแบบมีเงื่อนไข: ถ้ามีการเปลี่ยนรูปพร้อมกันอีกคำขอ ให้ 409 แทนการทิ้งไฟล์ค้างไว้
   */
  async setAvatar(coreUserId: string, file: UploadedImage | undefined) {
    if (!file) throw validationError(['avatar: กรุณาเลือกรูปโปรไฟล์']);
    if (file.size > MAX_AVATAR_BYTES) throw validationError(['avatar: รูปโปรไฟล์ต้องไม่เกิน 2 MB']);
    const current = await this.getByCoreUserId(coreUserId);
    const [stored] = await this.storage.save([file]);
    const { count } = await this.prisma.profile.updateMany({
      where: { coreUserId, avatarFilename: current.avatarFilename },
      data: { avatarFilename: stored.filename },
    });
    if (count === 0) {
      await this.storage.remove([stored.filename]);
      throw conflict('มีการเปลี่ยนรูปโปรไฟล์พร้อมกันอีกหน้าหนึ่ง กรุณาลองอีกครั้ง');
    }
    if (current.avatarFilename) await this.storage.remove([current.avatarFilename]);
    this.forget(coreUserId);
    return this.getByCoreUserId(coreUserId);
  }

  /** ลบรูปโปรไฟล์ — กลับไปแสดงอักษรย่อ */
  async removeAvatar(coreUserId: string) {
    const current = await this.getByCoreUserId(coreUserId);
    if (!current.avatarFilename) throw notFound('ยังไม่มีรูปโปรไฟล์ให้ลบ');
    const { count } = await this.prisma.profile.updateMany({
      where: { coreUserId, avatarFilename: current.avatarFilename },
      data: { avatarFilename: null },
    });
    if (count === 0) throw conflict('มีการเปลี่ยนรูปโปรไฟล์พร้อมกันอีกหน้าหนึ่ง กรุณาลองอีกครั้ง');
    await this.storage.remove([current.avatarFilename]);
    this.forget(coreUserId);
    return { id: current.avatarFilename.split('.')[0], deleted: true as const };
  }

  /** เปิดไฟล์รูปโปรไฟล์ของใครก็ได้ในระบบนี้ (ต้องเข้าสู่ระบบแล้ว) */
  async openAvatar(id: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id }, select: { avatarFilename: true } });
    if (!profile?.avatarFilename) throw notFound('ผู้ใช้นี้ยังไม่มีรูปโปรไฟล์');
    const file = await this.storage.open(profile.avatarFilename);
    if (!file) throw notFound('ไฟล์รูปโปรไฟล์ไม่อยู่ในที่เก็บแล้ว');
    const extension = profile.avatarFilename.split('.').pop();
    const type = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    return { ...file, type };
  }

  /** ผู้ที่เคยเข้าระบบนี้ตาม role (ใช้เลือกช่างตอนมอบหมายงาน) */
  async list(query: ListProfilesQueryDto) {
    const where: Prisma.ProfileWhereInput = query.role ? subsystemRoleWhere(query.role) : {};
    const [rows, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        orderBy: [{ personCode: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.profile.count({ where }),
    ]);
    return Paginated.of(rows.map(toProfileView), total, query.page, query.limit);
  }

  /**
   * รายชื่อนักศึกษา/บุคลากรจาก Core Hub (GET /people ด้วย token ของผู้ดูแล) + สิ่งที่ระบบนี้เก็บเกี่ยวกับคนนั้น
   * ระบบนี้ไม่เก็บรายชื่อ — เก็บแค่ว่าใบแจ้งซ่อมไหนเป็นของใคร (core_user_id + person_code) และการแต่งตั้งช่าง
   */
  async listPeople(query: ListPeopleQueryDto, token: string) {
    const page = await this.directory.list(
      { q: query.q, personType: query.personType, page: query.page, limit: query.limit },
      token,
    );
    const codes = page.data.map((person) => person.personCode);
    const userIds = page.data.flatMap((person) => (person.coreUserId ? [person.coreUserId] : []));
    const [profiles, counts, openCounts] = await Promise.all([
      this.prisma.profile.findMany({
        where: { OR: [{ personCode: { in: codes } }, { coreUserId: { in: userIds } }] },
      }),
      this.prisma.repairRequest.groupBy({
        by: ['coreUserId'],
        where: { reporter: { OR: [{ personCode: { in: codes } }, { coreUserId: { in: userIds } }] } },
        _count: { _all: true },
      }),
      this.prisma.repairRequest.groupBy({
        by: ['coreUserId'],
        where: {
          status: { in: [...OPEN_STATUSES] },
          reporter: { OR: [{ personCode: { in: codes } }, { coreUserId: { in: userIds } }] },
        },
        _count: { _all: true },
      }),
    ]);
    const total = new Map(counts.map((row) => [row.coreUserId, row._count._all]));
    const open = new Map(openCounts.map((row) => [row.coreUserId, row._count._all]));

    const items: PersonListItemDto[] = page.data.map((person) => {
      const profile =
        profiles.find((p) => p.personCode === person.personCode) ??
        profiles.find((p) => person.coreUserId && p.coreUserId === person.coreUserId);
      return {
        personCode: person.personCode,
        fullName: [person.academicTitle, person.fullNameTh].filter(Boolean).join(' '),
        personType: person.personType,
        staffType: person.staffType ?? null,
        status: person.status,
        departmentName: person.department?.nameTh ?? null,
        hasProfile: Boolean(profile),
        isTechnician: profile?.isTechnician ?? false,
        canBeTechnician: canBeTechnician(person),
        requestCount: profile ? (total.get(profile.coreUserId) ?? 0) : 0,
        openRequestCount: profile ? (open.get(profile.coreUserId) ?? 0) : 0,
        lastSeenAt: profile?.lastSeenAt?.toISOString() ?? null,
      };
    });
    return Paginated.of(items, page.meta.total, page.meta.page, page.meta.limit);
  }

  /**
   * แต่งตั้ง/ถอดถอนช่างจากรายชื่อบุคลากรของ Core Hub — ตรวจกับ /people/:code ทุกครั้ง (ไม่เชื่อค่าจากหน้าเว็บ)
   * คนที่ยังไม่เคยเข้าระบบนี้จะได้โปรไฟล์ไว้ก่อน (core_user_id จาก Core Hub · core_role staff)
   */
  async setTechnician(personCode: string, isTechnician: boolean, token: string) {
    const [person] = [...(await this.directory.namesForDisplay([personCode], token)).values()];
    if (!person) throw notFound('ไม่พบบุคคลนี้ในข้อมูลกลางของ Core Hub');
    if (isTechnician && !canBeTechnician(person)) {
      throw conflict('แต่งตั้งเป็นช่างได้เฉพาะบุคลากรสายสนับสนุนที่มีบัญชีใน CSMJU Portal');
    }
    const existing = await this.prisma.profile.findFirst({
      where: { OR: [{ personCode }, ...(person.coreUserId ? [{ coreUserId: person.coreUserId }] : [])] },
    });
    if (!isTechnician && existing?.isTechnician) {
      const openJobs = await this.prisma.repairRequest.count({
        where: { assigneeCoreUserId: existing.coreUserId, status: { in: [...OPEN_JOB_STATUSES] } },
      });
      if (openJobs > 0) {
        throw conflict(`ช่างคนนี้ยังมีงานค้าง ${openJobs} งาน ให้มอบหมายให้ช่างคนอื่นก่อนถอดถอน`);
      }
    }
    if (!existing && !isTechnician) return { personCode, isTechnician: false };
    const profile = existing
      ? await this.prisma.profile.update({ where: { id: existing.id }, data: { isTechnician, personCode } })
      : await this.prisma.profile.create({
          data: {
            coreUserId: person.coreUserId!,
            personCode,
            coreRole: TECHNICIAN_ELIGIBLE_CORE_ROLE,
            isTechnician,
          },
        });
    this.forget(profile.coreUserId);
    return { personCode, isTechnician: profile.isTechnician };
  }

  /** ผู้ที่รับงานซ่อมได้ (ช่าง + ผู้ดูแลระบบ) — ใช้แจ้งเตือนงานใหม่และตรวจการมอบหมายงาน */
  technicians() {
    return this.prisma.profile.findMany({
      where: { OR: [subsystemRoleWhere(SubsystemRole.TECHNICIAN), subsystemRoleWhere(SubsystemRole.ADMIN)] },
      orderBy: [{ personCode: { sort: 'asc', nulls: 'last' } }, { coreUserId: 'asc' }],
    });
  }
}

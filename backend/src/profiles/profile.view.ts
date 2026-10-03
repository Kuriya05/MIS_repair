import type { Profile } from '../../generated/prisma/client';
import { mapCoreRoleToSubsystemRole } from '../auth/role-mapping';
import { effectiveRole } from '../actor/technician';
import { displayNameFrom, type CorePerson } from '../directory/people-directory';
import type { ProfileDto } from './profiles.dto';

/** ชื่อที่หาได้จาก Core Hub ในคำขอนี้ (key = person_code) — ไม่เก็บ ไม่ cache */
export type NameBook = ReadonlyMap<string, CorePerson>;
const NO_NAMES: NameBook = new Map();

/**
 * URL รูปโปรไฟล์ (origin เดียวกับหน้าเว็บ) — ?v= เปลี่ยนทุกครั้งที่เปลี่ยนรูป เบราว์เซอร์จึง cache ได้ยาว
 * null = ยังไม่มีรูป ให้หน้าเว็บแสดงอักษรย่อแทน
 */
export function avatarUrlOf(profile: Pick<Profile, 'id' | 'avatarFilename'>) {
  if (!profile.avatarFilename) return null;
  return `/api/v1/profiles/${profile.id}/avatar?v=${profile.avatarFilename.slice(0, 8)}`;
}

type PersonSource = Pick<Profile, 'id' | 'coreUserId' | 'personCode' | 'avatarFilename'>;

/**
 * ข้อมูลย่อของบุคคลที่แนบไปกับใบแจ้งซ่อม (ผู้แจ้ง / ช่าง / ผู้ทำรายการ)
 * ชื่อมาจาก Core Hub เฉพาะหน้าที่หาชื่อให้ (หน้ารายละเอียด) — รายการแสดง person_code (reference-data.md ข้อ 7.2)
 */
export function toPersonView(profile: PersonSource, names: NameBook = NO_NAMES) {
  const person = profile.personCode ? names.get(profile.personCode) : undefined;
  return {
    coreUserId: profile.coreUserId,
    personCode: profile.personCode,
    displayName: displayNameFrom(profile.personCode, person, profile.coreUserId),
    nameFromCoreHub: Boolean(person),
    avatarUrl: avatarUrlOf(profile),
  };
}

export function toProfileView(profile: Profile): ProfileDto {
  return {
    id: profile.id,
    coreUserId: profile.coreUserId,
    personCode: profile.personCode,
    coreRole: profile.coreRole,
    subsystemRole: effectiveRole(
      mapCoreRoleToSubsystemRole(profile.coreRole),
      profile.coreRole,
      profile.isTechnician,
    ),
    isTechnician: profile.isTechnician,
    displayName: displayNameFrom(profile.personCode, null, profile.coreUserId),
    avatarUrl: avatarUrlOf(profile),
    lastSeenAt: profile.lastSeenAt?.toISOString() ?? null,
  };
}

export type PersonView = ReturnType<typeof toPersonView>;

import type { Prisma } from '../../generated/prisma/client';
import type { RepairActor } from '../actor/repair-actor';
import { buildingRefOf, type BuildingRef } from '../directory/buildings-directory';
import { toPersonView, type NameBook } from '../profiles/profile.view';
import type {
  RepairImageDto,
  RepairRequestDetailDto,
  RepairRequestSummaryDto,
  RequestActivityDto,
} from './repair-requests.dto';
import { minutesLeft, SLA_HOURS, slaStateOf } from './sla';
import { allowedActions, canFollow } from './workflow';

export const personSelect = {
  id: true,
  coreUserId: true,
  personCode: true,
  avatarFilename: true,
} as const satisfies Prisma.ProfileSelect;

type Buildings = Map<string, BuildingRef>;
const NO_NAMES: NameBook = new Map();

const placeInclude = {
  room: { select: { id: true, code: true, name: true } },
  item: { select: { id: true, label: true, name: true } },
} as const;

export const summaryInclude = {
  category: { select: { id: true, name: true } },
  ...placeInclude,
  reporter: { select: personSelect },
  assignee: { select: personSelect },
  images: {
    where: { kind: 'BEFORE' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 1,
    select: { id: true },
  },
  _count: { select: { images: true, followers: true } },
} as const satisfies Prisma.RepairRequestInclude;

export const detailInclude = {
  category: { select: { id: true, name: true } },
  reporter: { select: personSelect },
  assignee: { select: personSelect },
  ...placeInclude,
  images: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { uploader: { select: personSelect } },
  },
  activities: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { actor: { select: personSelect } },
  },
  followers: { select: { coreUserId: true } },
} as const satisfies Prisma.RepairRequestInclude;

/** ผู้เรียกกด "ฉันก็เจอ" ใบไหนไว้บ้าง — include แบบกรองเฉพาะคนนี้ (ไม่ดึงรายชื่อผู้ติดตามทั้งหมด) */
export const followedBy = (coreUserId: string) => ({ where: { coreUserId }, select: { id: true } }) as const;

type SummaryRow = Prisma.RepairRequestGetPayload<{ include: typeof summaryInclude }>;
type DetailRow = Prisma.RepairRequestGetPayload<{ include: typeof detailInclude }>;
type BaseRow = Omit<SummaryRow, 'images' | '_count'>;
export type SummaryRowWithMe = SummaryRow & { followers: { id: string }[] };

export const imageUrl = (id: string) => `/api/v1/repair-images/${id}/file`;
const iso = (value: Date | null) => value?.toISOString() ?? null;

function baseView(row: BaseRow, buildings: Buildings, names: NameBook, now: Date) {
  return {
    id: row.id,
    code: row.code,
    equipment: row.equipment,
    location: row.location,
    floor: row.floor,
    building: buildingRefOf(row.buildingCode, buildings),
    category: row.category,
    room: row.room,
    item: row.item,
    priority: row.priority,
    status: row.status,
    reporter: toPersonView(row.reporter, names),
    assignee: row.assignee ? toPersonView(row.assignee, names) : null,
    sla: {
      state: slaStateOf(row, now),
      dueAt: row.dueAt.toISOString(),
      targetHours: SLA_HOURS[row.priority],
      minutesLeft: minutesLeft(row, now),
    },
    rating: row.rating,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    acceptedAt: iso(row.acceptedAt),
    completedAt: iso(row.completedAt),
  };
}

/** รายการ: ไม่มีชื่อบุคคล (person_code) — ห้ามเรียก Core Hub ทีละแถว (reference-data.md ข้อ 7.2) */
/** อาการบรรทัดแรก ๆ สำหรับรายการ/บอร์ด (ไม่เกิน 140 ตัวอักษร) */
export function excerpt(text: string, max = 140) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function toSummaryDto(
  row: SummaryRowWithMe,
  viewer: RepairActor,
  buildings: Buildings,
  now = new Date(),
): RepairRequestSummaryDto {
  return {
    ...baseView(row, buildings, NO_NAMES, now),
    descriptionExcerpt: excerpt(row.description),
    imageCount: row._count.images,
    coverImageUrl: row.images[0] ? imageUrl(row.images[0].id) : null,
    followerCount: row._count.followers,
    followedByMe: row.followers.length > 0,
    allowedActions: allowedActions(viewer, row),
  };
}

export function toImageDto(image: DetailRow['images'][number], names: NameBook = NO_NAMES): RepairImageDto {
  return {
    id: image.id,
    kind: image.kind,
    mimeType: image.mimeType,
    size: image.size,
    url: imageUrl(image.id),
    uploadedBy: toPersonView(image.uploader, names),
    createdAt: image.createdAt.toISOString(),
  };
}

export function toActivityDto(
  activity: DetailRow['activities'][number],
  names: NameBook = NO_NAMES,
): RequestActivityDto {
  return {
    id: activity.id,
    type: activity.type,
    fromStatus: activity.fromStatus,
    toStatus: activity.toStatus,
    message: activity.message,
    actor: toPersonView(activity.actor, names),
    createdAt: activity.createdAt.toISOString(),
  };
}

export function toDetailDto(
  row: DetailRow,
  viewer: RepairActor,
  names: NameBook,
  buildings: Buildings,
  now = new Date(),
): RepairRequestDetailDto {
  const cover = row.images.find((image) => image.kind === 'BEFORE');
  const followedByMe = row.followers.some((f) => f.coreUserId === viewer.coreUserId);
  return {
    ...baseView(row, buildings, names, now),
    followerCount: row.followers.length,
    followedByMe,
    canFollow: canFollow(viewer, row, followedByMe),
    imageCount: row.images.length,
    coverImageUrl: cover ? imageUrl(cover.id) : null,
    description: row.description,
    descriptionExcerpt: excerpt(row.description),
    assetNumber: row.assetNumber,
    feedback: row.feedback,
    images: row.images.map((image) => toImageDto(image, names)),
    activities: row.activities.map((activity) => toActivityDto(activity, names)),
    allowedActions: allowedActions(viewer, row),
  };
}

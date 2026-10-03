/**
 * ชื่อเรียกสั้นของ type ที่ generate จาก backend/openapi.json (tech-stack.md ข้อ 3)
 * ห้ามเขียน type ของ API response เอง — แก้ที่ DTO ฝั่ง backend แล้วรัน `pnpm --filter frontend generate:api-types`
 */
import type { components } from './api-schema';

type Schemas = components['schemas'];

/** ผู้เรียกในมุมของระบบแจ้งซ่อม (GET /api/v1/profiles/me) — /api/v1/me คงรูปแบบ reference สำหรับ conformance */
export type Me = Schemas['MyProfileDto'];
export type Profile = Schemas['ProfileDto'];
export type Building = Schemas['BuildingDto'];
export type Category = Schemas['CategoryDto'];
export type Room = Schemas['RoomDto'];
export type RoomDetail = Schemas['RoomDetailDto'];
export type Equipment = Schemas['EquipmentDto'];
export type EquipmentDetail = Schemas['EquipmentDetailDto'];
export type EquipmentState = Schemas['EquipmentState'];
export type CategoryIcon = Schemas['CategoryIcon'];
export type QrTarget = Schemas['QrTargetDto'];
export type PersonListItem = Schemas['PersonListItemDto'];
export type Notification = Schemas['NotificationDto'];
export type RepairRequestSummary = Schemas['RepairRequestSummaryDto'];
export type RepairRequestDetail = Schemas['RepairRequestDetailDto'];
export type RepairImage = Schemas['RepairImageDto'];
export type RequestActivity = Schemas['RequestActivityDto'];
export type Person = Schemas['PersonDto'];
export type SimilarRequest = Schemas['SimilarRepairRequestDto'];
export type FollowState = Schemas['FollowStateDto'];
export type Statistics = Schemas['StatisticsDto'];
export type PageMeta = Schemas['PageMetaDto'];

export type RequestStatus = Schemas['RequestStatus'];
export type Priority = Schemas['Priority'];
export type SlaState = Schemas['SlaState'];
export type RequestAction = Schemas['RequestAction'];
export type StatusTarget = Schemas['StatusTarget'];
export type ErrorCode = Schemas['ErrorBodyDto']['code'];
export type SubsystemRole = Me['subsystemRole'];

export type RoomType = Schemas['RoomType'];
export type EquipmentInventoryItem = Schemas['EquipmentInventoryDto'];
export type InventoryRoomRef = Schemas['InventoryRoomRefDto'];
export type RoomStatistics = Schemas['RoomStatDto'];
export type TopEquipment = Schemas['TopEquipmentDto'];

import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors';
import type { Building } from '../core-hub/reference-data.types';
import { ReferenceDataService } from '../core-hub/reference-data.service';

export type BuildingRef = { code: string; name: string; isActive: boolean | null };

/**
 * อาคารจากข้อมูลอ้างอิงของ Core Hub (ชุด `buildings` ใน core-hub/reference-datasets.ts)
 * ใช้ ReferenceDataService ของชั้นกลาง (cache 10 นาที · stale-on-error · Retry-After) — ระบบนี้เก็บแค่ code
 */
@Injectable()
export class BuildingsDirectory {
  constructor(private readonly reference: ReferenceDataService) {}

  /** อาคารที่เปิดใช้งาน · Core Hub ล่มและไม่มี cache → 503 */
  list(token: string): Promise<Building[]> {
    return this.reference.list<Building>('buildings', token);
  }

  /** รวมที่ปิดใช้งานแล้ว · ไม่พบ = null */
  get(code: string, token: string): Promise<Building | null> {
    return this.reference.get<Building>('buildings', code, token);
  }

  /**
   * ชื่ออาคารสำหรับแสดงผล — ใช้ cache ทั้งชุด (ไม่เรียก Core Hub ทีละแถว)
   * Core Hub ล่ม / ไม่มีสิทธิ์ → แสดง code แทน · 401 ยังส่งต่อให้หน้าเว็บพา SSO ใหม่
   */
  async refs(codes: Iterable<string>, token: string): Promise<Map<string, BuildingRef>> {
    const result = new Map<string, BuildingRef>();
    for (const code of new Set(codes)) {
      let row: Building | null = null;
      try {
        row = await this.get(code, token);
      } catch (error) {
        if (error instanceof AppException && error.code === 'UNAUTHORIZED') throw error;
      }
      result.set(code, { code, name: row?.nameTh ?? code, isActive: row ? row.isActive : null });
    }
    return result;
  }
}

/** อาคารที่หาไม่เจอยังแสดงได้เสมอ (reference-data.md ข้อ 8) */
export const buildingRefOf = (code: string, refs: Map<string, BuildingRef>): BuildingRef =>
  refs.get(code) ?? { code, name: code, isActive: null };

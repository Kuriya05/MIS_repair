import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors';
import { CoreHubCallError, coreHubFailure, getFromCoreHub } from '../core-hub/core-hub-http';

/**
 * บุคคลจาก Core Hub (reference-data.md ข้อ 5) สำหรับแสดงผล — **ห้ามเก็บลงฐานและห้าม cache**
 * PeopleService ของชั้นกลางมีแค่ myPersonCode() · ส่วนนี้คือการอ่านเพิ่มของโดเมน (ชื่อในหน้ารายละเอียด ·
 * รายชื่อนักศึกษา/บุคลากรในหน้าผู้ดูแล) ผ่านตัวเรียก Core Hub ตัวเดียวกัน (core-hub-http.ts)
 * /people และ /people/:code เรียกได้เฉพาะ staff · lecturer · admin
 */
export interface CorePerson {
  personCode: string;
  personType: 'STUDENT' | 'STAFF' | string;
  staffType?: string | null;
  academicTitle?: string | null;
  fullNameTh: string;
  fullNameEn?: string | null;
  entryYear?: number | null;
  status: string;
  coreUserId?: string | null;
  department?: { code: string; nameTh: string } | null;
}

export type PeoplePage = {
  data: CorePerson[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export type PeopleQuery = {
  q?: string;
  personType?: 'STUDENT' | 'STAFF';
  page: number;
  limit: number;
};

const PERSON_CODE = /^[A-Za-z0-9._-]{1,64}$/;
/** จำนวนคนสูงสุดที่หาชื่อต่อหนึ่งคำขอ (หน้ารายละเอียด) — รายการห้ามเรียกทีละแถว (ข้อ 7.2) */
export const MAX_NAME_LOOKUPS = 10;

const isSessionEnded = (error: unknown) =>
  (error instanceof CoreHubCallError && error.status === 401) ||
  (error instanceof AppException && error.code === 'UNAUTHORIZED');

@Injectable()
export class PeopleDirectory {
  constructor(private readonly config: ConfigService) {}

  private url(path: string) {
    const base = this.config.get<string>('coreHub.url', 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}/api/v1${path}`;
  }

  private get timeoutMs(): number {
    return this.config.get<number>('coreHub.dataRequestTimeoutMs', 5_000);
  }

  /** คำตอบทั้งก้อน { success, data, meta? } ของ Core Hub · 404 → NOT_FOUND · อื่น ๆ ตาม coreHubFailure */
  private async envelope<T>(path: string, token: string): Promise<{ data: T; meta?: PeoplePage['meta'] }> {
    let body: unknown;
    try {
      body = await getFromCoreHub(this.url(path), token, this.timeoutMs);
    } catch (error) {
      if (error instanceof CoreHubCallError && error.status === 404) {
        throw AppException.notFound('ไม่พบในข้อมูลกลาง');
      }
      throw coreHubFailure(error);
    }
    const envelope = (body ?? {}) as { success?: unknown; data?: T; meta?: PeoplePage['meta'] };
    if (envelope.success !== true) throw coreHubFailure(new Error('Core Hub answered without success'));
    return { data: envelope.data as T, meta: envelope.meta };
  }

  private async data<T>(path: string, token: string): Promise<T> {
    return (await this.envelope<T>(path, token)).data;
  }

  /** บุคคลของผู้เรียก (มีชื่อ) — ไม่ผูก/ไม่มีสิทธิ์/Core Hub ล่ม → null · 401 ส่งต่อ */
  async meForDisplay(token: string): Promise<CorePerson | null> {
    try {
      return (await this.data<CorePerson | null>('/people/me', token)) ?? null;
    } catch (error) {
      if (isSessionEnded(error)) throw error;
      return null;
    }
  }

  /** ชื่อของคนในหน้ารายละเอียด (ไม่เกิน 10 คน) — หาไม่ได้ก็ไม่มีในผลลัพธ์ ให้แสดง person_code */
  async namesForDisplay(personCodes: Iterable<string>, token: string): Promise<Map<string, CorePerson>> {
    const codes = [...new Set(personCodes)].filter((c) => PERSON_CODE.test(c)).slice(0, MAX_NAME_LOOKUPS);
    const found = new Map<string, CorePerson>();
    await Promise.all(
      codes.map(async (code) => {
        try {
          found.set(code, await this.data<CorePerson>(`/people/${encodeURIComponent(code)}`, token));
        } catch (error) {
          if (isSessionEnded(error)) throw error;
        }
      }),
    );
    return found;
  }

  /** รายชื่อบุคคลแบบแบ่งหน้า (หน้า "ผู้ใช้และช่าง") — ไม่มีสิทธิ์ = 403 · Core Hub ล่ม = 503 */
  async list(query: PeopleQuery, token: string): Promise<PeoplePage> {
    const search = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
    if (query.q) search.set('q', query.q);
    if (query.personType) search.set('personType', query.personType);
    const { data, meta } = await this.envelope<CorePerson[]>(`/people?${search.toString()}`, token);
    if (!Array.isArray(data) || !meta) throw coreHubFailure(new Error('malformed /people page'));
    return { data, meta };
  }
}

/** ชื่อที่แสดง: ชื่อไทยจาก Core Hub → person_code → รหัสบัญชี */
export function displayNameFrom(
  personCode: string | null,
  person?: CorePerson | null,
  coreUserId?: string,
): string {
  if (person?.fullNameTh) return [person.academicTitle, person.fullNameTh].filter(Boolean).join(' ');
  return personCode ?? (coreUserId ? `บัญชี ${coreUserId}` : 'ผู้ใช้ไม่มีรหัสบุคคล');
}

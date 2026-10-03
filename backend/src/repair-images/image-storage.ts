import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { validationError } from '../shared/errors';
import { ConfigService } from '@nestjs/config';

/** รูปต่อ 1 ไฟล์ไม่เกิน 8 MB · ครั้งละไม่เกิน 5 รูป · รวมต่อใบแจ้งซ่อมไม่เกิน 10 รูปต่อประเภท */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGES_PER_UPLOAD = 5;
export const MAX_IMAGES_PER_KIND = 10;

export const IMAGE_TYPES = [
  { mimeType: 'image/jpeg', ext: 'jpg' },
  { mimeType: 'image/png', ext: 'png' },
  { mimeType: 'image/webp', ext: 'webp' },
] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** ดูชนิดไฟล์จาก magic bytes — ไม่เชื่อนามสกุลหรือ Content-Type ที่ client ส่งมา */
export function sniffImage(buffer: Buffer): ImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return IMAGE_TYPES[0];
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return IMAGE_TYPES[1];
  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return IMAGE_TYPES[2];
  }
  return null;
}

export type UploadedImage = { buffer: Buffer; size: number; originalname?: string };
export type StoredImage = { filename: string; mimeType: ImageType['mimeType']; size: number };

/** เก็บรูปงานซ่อมในโฟลเดอร์ UPLOAD_DIR ของระบบนี้ ชื่อไฟล์สุ่มใหม่ทุกไฟล์ (UUID) */
@Injectable()
export class ImageStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('uploadDir', 'uploads'));
  }

  /** ตรวจทุกไฟล์ก่อน แล้วจึงเขียน — ถ้าเขียนไม่สำเร็จกลางทาง จะลบไฟล์ที่เขียนไปแล้วทิ้ง */
  async save(files: UploadedImage[]): Promise<StoredImage[]> {
    if (files.length > MAX_IMAGES_PER_UPLOAD) {
      throw validationError([`แนบรูปได้ครั้งละไม่เกิน ${MAX_IMAGES_PER_UPLOAD} รูป`]);
    }
    const checked = files.map((file, index) => {
      const label = file.originalname ? `รูป "${file.originalname}"` : `รูปที่ ${index + 1}`;
      if (file.size === 0) throw validationError([`${label} เป็นไฟล์ว่าง`]);
      if (file.size > MAX_IMAGE_BYTES) throw validationError([`${label} ใหญ่เกิน 8 MB`]);
      const type = sniffImage(file.buffer);
      if (!type) throw validationError([`${label} ไม่ใช่ไฟล์ภาพ JPG, PNG หรือ WebP`]);
      return { file, type, filename: `${randomUUID()}.${type.ext}` };
    });

    await mkdir(this.root, { recursive: true });
    const written: string[] = [];
    try {
      for (const item of checked) {
        await writeFile(this.pathOf(item.filename), item.file.buffer, { flag: 'wx' });
        written.push(item.filename);
      }
    } catch (error) {
      await this.remove(written);
      throw error;
    }
    return checked.map((item) => ({
      filename: item.filename,
      mimeType: item.type.mimeType,
      size: item.file.size,
    }));
  }

  async remove(filenames: string[]) {
    await Promise.all(filenames.map((filename) => rm(this.pathOf(filename), { force: true })));
  }

  /** เปิดไฟล์เพื่อส่งให้ผู้ใช้ — คืน null เมื่อไฟล์หายจากดิสก์ */
  async open(filename: string) {
    const path = this.pathOf(filename);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) return null;
    return { stream: createReadStream(path), size: info.size };
  }

  /** basename กัน path traversal แม้ชื่อไฟล์ในฐานข้อมูลถูกบังคับรูปแบบด้วย CHECK อยู่แล้ว */
  private pathOf(filename: string) {
    return resolve(this.root, basename(filename));
  }
}

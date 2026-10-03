-- ประเภทห้อง · จำนวนที่นั่ง · รูปห้อง/รูปเครื่อง (ไฟล์ใน UPLOAD_DIR เหมือนรูปโปรไฟล์)

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('LAB', 'LECTURE', 'NETWORK_LAB', 'MEETING', 'OFFICE', 'OTHER');

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "photo_filename" VARCHAR(100),
ADD COLUMN     "room_type" "RoomType" NOT NULL DEFAULT 'LAB';

-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "photo_filename" VARCHAR(100);

-- CHECK constraints (Prisma ไม่สร้างให้)
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_capacity_check" CHECK ("capacity" BETWEEN 0 AND 1000),
  ADD CONSTRAINT "rooms_photo_filename_check" CHECK ("photo_filename" ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$');
ALTER TABLE "equipment"
  ADD CONSTRAINT "equipment_photo_filename_check" CHECK ("photo_filename" ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$');

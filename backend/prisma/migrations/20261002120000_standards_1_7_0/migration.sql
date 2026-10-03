-- standards 1.7.0 (reference-data.md 1.3 ข้อ 8)
--  1. ไม่เก็บชื่อ/อีเมลของผู้ใช้ — profiles เก็บ person_code จาก GET /people/me แทน (ดูชื่อจาก Core Hub ตอนแสดงผล)
--  2. อาคารเป็นข้อมูลอ้างอิงของ Core Hub — เลิกตาราง buildings เก็บ building_code แทน building_id
--  3. core role 6 ค่า (vocabulary.json 1.1: เพิ่ม lecturer · guest)

-- 1. profiles ---------------------------------------------------------------
ALTER TABLE "profiles" ADD COLUMN "person_code" VARCHAR(64);

ALTER TABLE "profiles"
  DROP CONSTRAINT "profiles_email_check",
  DROP CONSTRAINT "profiles_display_name_check",
  DROP CONSTRAINT "profiles_core_role_check";

ALTER TABLE "profiles"
  DROP COLUMN "email",
  DROP COLUMN "display_name";

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_core_role_check"
    CHECK ("core_role" IN ('student', 'alumni', 'staff', 'lecturer', 'guest', 'admin')),
  ADD CONSTRAINT "profiles_person_code_check" CHECK ("person_code" ~ '^[A-Za-z0-9._-]{1,64}$');

CREATE INDEX "profiles_person_code_idx" ON "profiles"("person_code");

-- 2. buildings → building_code ----------------------------------------------
-- อาคารเดิมที่ไม่มี code ได้ code ชั่วคราว LEGACY-<8 ตัวแรกของ id> (ยังแสดงได้ แต่ไม่ตรงกับ Core Hub
-- ให้ผู้ดูแลระบบแก้ใบแจ้งซ่อม/สติกเกอร์ไปใช้อาคารจาก Core Hub)
UPDATE "buildings"
   SET "code" = 'LEGACY-' || upper(substr(replace("id"::text, '-', ''), 1, 8))
 WHERE "code" IS NULL;

ALTER TABLE "repair_requests" ADD COLUMN "building_code" VARCHAR(50);
ALTER TABLE "qr_tags" ADD COLUMN "building_code" VARCHAR(50);

UPDATE "repair_requests" r SET "building_code" = b."code" FROM "buildings" b WHERE b."id" = r."building_id";
UPDATE "qr_tags" q SET "building_code" = b."code" FROM "buildings" b WHERE b."id" = q."building_id";

ALTER TABLE "repair_requests" ALTER COLUMN "building_code" SET NOT NULL;
ALTER TABLE "qr_tags" ALTER COLUMN "building_code" SET NOT NULL;

ALTER TABLE "repair_requests" DROP CONSTRAINT "repair_requests_building_id_fkey";
ALTER TABLE "qr_tags" DROP CONSTRAINT "qr_tags_building_id_fkey";
ALTER TABLE "repair_requests" DROP COLUMN "building_id";
ALTER TABLE "qr_tags" DROP COLUMN "building_id";

DROP TABLE "buildings";

ALTER TABLE "repair_requests"
  ADD CONSTRAINT "repair_requests_building_code_check" CHECK ("building_code" ~ '^[A-Z0-9-]{1,50}$');
ALTER TABLE "qr_tags"
  ADD CONSTRAINT "qr_tags_building_code_check" CHECK ("building_code" ~ '^[A-Z0-9-]{1,50}$');

CREATE INDEX "repair_requests_building_code_idx" ON "repair_requests"("building_code");
CREATE INDEX "qr_tags_building_code_idx" ON "qr_tags"("building_code");

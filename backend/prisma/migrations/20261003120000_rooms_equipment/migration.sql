-- ห้องและเครื่องในห้อง (ผู้ดูแลระบบแจ้งซ่อมเพิ่มเอง) · QR รายห้อง/รายเครื่องแทนสติกเกอร์แบบเดิม
-- หมวดหมู่งานซ่อม = ประเภทอุปกรณ์พร้อมอาการที่พบบ่อย · โปรไฟล์ไม่เก็บข้อมูลติดต่อแล้ว

-- 1. profiles: เลิกเก็บเบอร์โทร/หน่วยงาน -----------------------------------------
ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "profiles_phone_check";
ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "profiles_work_unit_check";
ALTER TABLE "profiles" DROP COLUMN "phone", DROP COLUMN "work_unit";

-- 2. categories: อาการที่พบบ่อย + ไอคอน + ลำดับ -----------------------------------
ALTER TABLE "categories"
  ADD COLUMN "symptoms" VARCHAR(100)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(100)[],
  ADD COLUMN "icon" VARCHAR(20) NOT NULL DEFAULT 'other',
  ADD COLUMN "sort_order" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_icon_check"
    CHECK ("icon" IN ('computer', 'monitor', 'projector', 'aircon', 'fan', 'light', 'network', 'audio', 'furniture', 'other'));

-- 3. rooms ---------------------------------------------------------------------
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "building_code" VARCHAR(50) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "floor" SMALLINT,
    "description" VARCHAR(500),
    "qr_code" VARCHAR(16) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");
CREATE UNIQUE INDEX "rooms_qr_code_key" ON "rooms"("qr_code");
CREATE INDEX "rooms_building_code_idx" ON "rooms"("building_code");
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_building_code_check" CHECK ("building_code" ~ '^[A-Z0-9-]{1,50}$'),
  ADD CONSTRAINT "rooms_code_check" CHECK ("code" ~ '^[A-Z0-9-]{1,30}$'),
  ADD CONSTRAINT "rooms_name_check" CHECK (char_length(btrim("name")) >= 2),
  ADD CONSTRAINT "rooms_floor_check" CHECK ("floor" BETWEEN -5 AND 99),
  ADD CONSTRAINT "rooms_qr_code_check" CHECK ("qr_code" ~ '^[A-HJ-NP-Z2-9]{8}$');

-- 4. equipment -----------------------------------------------------------------
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "label" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "asset_number" VARCHAR(50),
    "specs" VARCHAR(1000),
    "position" VARCHAR(50),
    "qr_code" VARCHAR(16) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "equipment_qr_code_key" ON "equipment"("qr_code");
CREATE UNIQUE INDEX "equipment_room_id_label_key" ON "equipment"("room_id", "label");
CREATE INDEX "equipment_category_id_idx" ON "equipment"("category_id");
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment"
  ADD CONSTRAINT "equipment_label_check" CHECK (char_length(btrim("label")) >= 1),
  ADD CONSTRAINT "equipment_name_check" CHECK (char_length(btrim("name")) >= 2),
  ADD CONSTRAINT "equipment_qr_code_check" CHECK ("qr_code" ~ '^[A-HJ-NP-Z2-9]{8}$');

-- 5. repair_requests: ผูกกับห้อง/เครื่อง แทนสติกเกอร์ QR แบบเดิม ------------------
ALTER TABLE "repair_requests" DROP CONSTRAINT IF EXISTS "repair_requests_qr_tag_id_fkey";
ALTER TABLE "repair_requests" DROP COLUMN "qr_tag_id";
ALTER TABLE "repair_requests" ADD COLUMN "room_id" UUID, ADD COLUMN "equipment_id" UUID;
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "repair_requests_equipment_id_status_idx" ON "repair_requests"("equipment_id", "status");
CREATE INDEX "repair_requests_room_id_status_idx" ON "repair_requests"("room_id", "status");

DROP TABLE "qr_tags";

-- "ฉันก็เจอ": ผู้ใช้ติดตามใบแจ้งซ่อมเดิมที่ยังเปิดอยู่แทนการแจ้งซ้ำ
ALTER TYPE "ActivityType" ADD VALUE 'FOLLOWED';

CREATE TABLE "request_followers" (
    "id" UUID NOT NULL,
    "repair_request_id" UUID NOT NULL,
    "core_user_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "request_followers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "request_followers_repair_request_id_core_user_id_key" ON "request_followers"("repair_request_id", "core_user_id");
CREATE INDEX "request_followers_core_user_id_idx" ON "request_followers"("core_user_id");

ALTER TABLE "request_followers" ADD CONSTRAINT "request_followers_repair_request_id_fkey" FOREIGN KEY ("repair_request_id") REFERENCES "repair_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "request_followers" ADD CONSTRAINT "request_followers_core_user_id_fkey" FOREIGN KEY ("core_user_id") REFERENCES "profiles"("core_user_id") ON DELETE CASCADE ON UPDATE CASCADE;

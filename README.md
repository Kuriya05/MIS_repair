# csmju-maintenance-request — ระบบแจ้งซ่อม

ระบบย่อยของโครงการ CSMJU2030 สำหรับแจ้งซ่อมอาคารและอุปกรณ์ ติดตามงานช่าง และดูสถิติ
เข้าสู่ระบบผ่าน **Core Hub** เท่านั้น (Central SSO 1.1) — ระบบนี้ไม่มีหน้า login หรือฟอร์มรหัสผ่านของตัวเอง

มาตรฐานกลางอยู่ใน `standards/` (submodule ของ CSMJU2030/csmju2030-standards · ตรึงที่ **v1.7.0** ตาม `.standards-version`)
ผลตรวจล่าสุดและข้อสมมติทั้งหมดอยู่ใน [REPORT.md](REPORT.md)

## ความสามารถ

| ผู้ใช้ | ทำอะไรได้ |
|---|---|
| นักศึกษา / บุคลากร / อาจารย์ (`USER`) | แจ้งซ่อมพร้อมรูป (ย่อรูปในเครื่องก่อนส่ง) · ระบบเตือนเมื่อที่เดียวกันมีใบที่ยังเปิดอยู่ ให้กด **“ฉันก็เจอ”** ติดตามใบเดิมแทนการแจ้งซ้ำ · ระบบแนะนำหมวดหมู่/ความเร่งด่วนจากอาการที่พิมพ์ · สแกน QR ที่ห้อง/อุปกรณ์แล้วฟอร์มกรอกสถานที่ให้ · ติดตามสถานะ · คุยกับช่าง · ยกเลิก · ให้คะแนนหลังซ่อมเสร็จ · การแจ้งเตือนในระบบ · ตั้งรูปโปรไฟล์และข้อมูลติดต่อ |
| ช่าง (`TECHNICIAN`) | คิวงาน (รอรับ / งานของฉัน / ใกล้และเกินกำหนด) · **บอร์ดงานแบบลากวาง** (`/board` — ลากการ์ดเพื่อรับงาน เริ่ม พัก ปิดงาน) · เห็นจำนวนคนที่เดือดร้อนจากเรื่องเดียวกัน · รับงาน · เริ่ม / พักรออะไหล่ / ปิดงานพร้อมรูปหลังซ่อม · ปรับความเร่งด่วนหรือหมวดหมู่ · พิมพ์ใบงาน · ส่งออก CSV |
| ผู้ดูแลระบบ (`ADMIN`) | ทุกอย่างของช่าง + มอบหมาย/โอนงาน · แต่งตั้งบุคลากรเป็นช่าง · จัดการหมวดหมู่และสติกเกอร์ QR (พิมพ์เป็นแผ่น) · ดูอาคารจากข้อมูลกลาง · สถิติ SLA ความพึงพอใจ จุดเสียซ้ำ ภาระงานช่าง |

SLA ตามความเร่งด่วน: ด่วนมาก 4 ชม. · ด่วน 24 ชม. · ปกติ 72 ชม. · ไม่เร่งด่วน 7 วัน
ค้นหาด่วนได้ทุกหน้าด้วย `Ctrl K`

ข้อมูลที่ **ไม่ได้** เก็บในระบบนี้ (standards 1.7.0 · `reference-data.md` ข้อ 8):
ชื่อและอีเมลของผู้ใช้ (เก็บแค่ `core_user_id` + `person_code` แล้วดูชื่อจาก Core Hub ตอนแสดงผล) ·
รายการอาคาร (เก็บแค่ `building_code` ของ Core Hub)

## โครงสร้าง

```
backend/    NestJS 11 + Prisma 7 (PostgreSQL ของระบบนี้เท่านั้น: repair_db)
  src/auth            ตรวจ token ของ Core Hub 10 ขั้น (RS256 + JWKS) · /auth/login · /auth/callback · /auth/logout · /api/v1/me
  src/core-hub        เรียกข้อมูลกลางด้วย token ของผู้ใช้: /people/me · /people/:code · /buildings (cache 10 นาที)
  src/repair-requests ใบแจ้งซ่อม: workflow, SLA, รูป, ประวัติ, ความคิดเห็น, คะแนน
  src/rooms           ห้อง + เครื่องในห้อง (แอดมินเพิ่มเอง) · QR ต่อห้อง/ต่อเครื่อง · สถานะเครื่องจากใบแจ้งที่เปิดอยู่
  src/statistics      สถิติหน้า dashboard              src/notifications การแจ้งเตือนในระบบ
  src/profiles        รูปโปรไฟล์ · รายชื่อบุคคลจาก Core Hub · แต่งตั้งช่าง
  src/actor           RepairActorGuard (ต่อจาก guard ของ reference: บันทึกโปรไฟล์ + ยกเป็นช่าง)
  src/buildings (อ่านจาก Core Hub), src/categories, src/repair-images, src/health
  prisma/             schema, migrations, seed.ts (ประเภทอุปกรณ์ 10 ประเภท + ห้องของสาขา 8 ห้อง)
  openapi.json        สร้างจากโค้ด (pnpm --filter backend generate:openapi)
frontend/   Next.js 16 App Router + Tailwind (token ตาม ui-design-system.md)
  src/app             หน้า: / · buildings · rooms/[id] (+ qr) · equipment/[id] · requests · queue · board · dashboard · profile · q/[code] · admin/*
  src/csmju           ตัวแทนชั่วคราวของ template csmju-subsystem-web (AppShell, Modal, …) — ดู README ในโฟลเดอร์
  src/lib             API client (คุกกี้ HttpOnly ผ่าน origin เดียวกัน) · silent re-SSO · ชนิดข้อมูลจาก openapi.json
standards/  มาตรฐานกลาง (ห้ามแก้ใน repo นี้)
```

## เริ่มพัฒนาในเครื่อง

ต้องมี Node.js 22, pnpm 12.3.4 (`corepack enable`) และ PostgreSQL 16+ (ติดตั้งในเครื่อง หรือใช้ Docker)
ระบบต้องลงทะเบียนในหลังบ้านของ Core Hub แล้ว (PL ของทีม — `standards/docs/connect-core-hub.md` ข้อ 3):

| ช่อง | ค่า |
|---|---|
| ชื่อระบบ | `csmju-maintenance-request` |
| Callback URL | `http://localhost:3221/auth/callback` (พอร์ต frontend) |
| Base URL | เว้นว่าง |
| บทบาท | student → `USER` · staff → `USER` · lecturer → `USER` · admin → `ADMIN` |

```bash
git clone --recurse-submodules <repo> && cd <repo>
cp .env.example .env                        # ชี้ Core Hub จริง https://csmju2030.jowave.com อยู่แล้ว
#   ฐานข้อมูล — PostgreSQL ในเครื่อง (พอร์ต 5432): สร้าง role + ฐานข้อมูลครั้งเดียว (ด้านล่าง) แล้วแก้ DATABASE_URL ใน .env
#   หรือ Docker: docker compose up -d db (localhost:${REPAIR_DB_PORT:-5434})
pnpm install
pnpm --filter backend db:migrate            # prisma migrate deploy
pnpm --filter backend db:seed               # ประเภทอุปกรณ์ + ห้อง Lab 1–5, Lab Network, Lect 6, Lect 8 (SEED_ROOM_BUILDING_CODE ค่าเริ่มต้น CS)
pnpm dev:backend                            # http://127.0.0.1:4221
pnpm dev:frontend                           # http://localhost:3221  ← เปิดอันนี้
```

สร้างฐานข้อมูลใน PostgreSQL ที่ติดตั้งในเครื่อง (ครั้งเดียว · รันด้วย `psql -U postgres` แล้วตั้งรหัสเอง):

```sql
CREATE ROLE repair WITH LOGIN PASSWORD '<รหัสที่ตั้งเอง>';
CREATE DATABASE repair_db OWNER repair;
```

แล้วใน `.env`: `DATABASE_URL=postgresql://repair:<รหัสที่ตั้งเอง>@localhost:5432/repair_db`

เปิด **http://localhost:3221** (ต้องเป็น `localhost` ไม่ใช่ `127.0.0.1` — คุกกี้ผูกกับชื่อ host) → ยังไม่มี session
ระบบพาไป `/auth/login` → เว็บ Core Hub → กลับมาที่ `/auth/callback` ซึ่ง backend ตรวจ state + token
แล้วตั้งคุกกี้ `csmju_maintenance_request_access_token` (HttpOnly) · token หมดทุก 15 นาที หน้าเว็บต่ออายุให้เอง

- ผู้ใช้ที่เข้าระบบครั้งแรกจะถูกสร้างโปรไฟล์อัตโนมัติ (บันทึก `person_code` จาก `/people/me`) ·
  ผู้ดูแลระบบรับงานและอัปเดตสถานะเองได้ที่หน้า **บอร์ดงานซ่อม**
- ชื่อผู้แจ้ง/ช่างแสดงเป็นชื่อจริงเฉพาะหน้ารายละเอียด และเฉพาะผู้ดูที่ Core Hub ให้ดูข้อมูลบุคคลได้
  (staff · lecturer · admin หรือชื่อของตัวเอง) — ที่อื่นแสดงรหัสบุคคล
- ไม่มีข้อมูลจำลอง — seed สร้างห้องของสาขาให้ (ไม่มีอุปกรณ์) ผู้ดูแลเข้าแต่ละห้องแล้วกด **เพิ่มอุปกรณ์** ใส่รูป แล้วพิมพ์สติกเกอร์ QR

## ตรวจก่อนเปิด PR

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm check          # ./standards/scripts/run-all-checks.sh . (ต้องมี jq)
CONFORMANCE_ACCOUNTS_FILE=~/.csmju/conformance-accounts.json pnpm conformance   # บัญชีอยู่นอก repo เท่านั้น
```

ชื่อ branch `feature/repair/<เรื่อง>` · commit แบบ `<type>(repair): …` · อ่าน `standards/docs/github-workflow.md` ข้อ 1
เลื่อนเวอร์ชัน standards ตาม `standards/docs/standards-versioning.md` ข้อ 2 (แก้ `.standards-version` + submodule)

## รันทั้งระบบด้วย Docker

```bash
docker compose --profile app up -d --build  # db + backend :4221 + frontend :3221
```

- backend รัน `prisma migrate deploy` ก่อนเริ่มทุกครั้ง · รูปงานซ่อมเก็บใน volume `repair_uploads`
- `NEXT_PUBLIC_*` และ `BACKEND_URL` ถูกฝังตอน build ของ frontend (Next.js คำนวณ rewrites ตอน build) —
  เปลี่ยนค่าแล้วต้อง build ใหม่
- frontend เป็นประตูเดียวของระบบ (ส่งต่อ `/api/*` และ `/auth/login` `/auth/callback` `/auth/logout` ให้ backend)
  ขึ้น host จริงแล้วให้ admin ระบบกลางเปลี่ยน Callback URL เป็น `https://<โดเมน>/auth/callback` และตั้ง `NODE_ENV=production`

## ตัวแปร environment

คำอธิบายทุกตัวอยู่ใน [.env.example](.env.example) — ที่สำคัญคือ `DATABASE_URL` (ของระบบนี้เท่านั้น),
`CORE_HUB_URL` / `CORE_HUB_JWKS_URL` / `CORE_HUB_WEB_URL`, `SUBSYSTEM_ID=csmju-maintenance-request`, `UPLOAD_DIR`,
`BACKEND_URL` และ `NEXT_PUBLIC_CORE_HUB_URL`

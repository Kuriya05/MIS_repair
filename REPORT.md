# REPORT — csmju-maintenance-request

ระบบแจ้งซ่อม · ย้ายจาก standards 1.0.0 (สายที่ปิดแล้ว) เป็น **1.7.0** · branch `feature/repair/bump-standards-v1-7-0`

## ผลรัน

`./standards/scripts/run-all-checks.sh .` (standards v1.7.0) — 2 ต.ค. 2569 ก่อน commit

```
  ✅ PASS  Convention / Security & Stack / API Contract Sync / Data Dictionary / UI Token
  ✅ PASS  Code Quality (QA-01..06: lint · typecheck · test · build)  ·  Exception Validation
  ❌ FAIL  Standards Version Check (GH-04) — ตรวจ pointer ของ submodule ใน commit ล่าสุด
           submodule ในเครื่องชี้ v1.7.0 (88c4ce8) แล้ว จะผ่านเมื่อ commit
❌ 1 / 19 checks failed
```

ARC-02/03 และ API-01 ข้ามในเครื่องเพราะไม่มี `jq` (CI มี) · ไม่ได้เพิ่ม dependency ใหม่

```
pnpm --filter backend test     unit 73 passed · e2e 26 passed
pnpm --filter frontend test    21 passed
```

**ยังไม่ได้รัน conformance** — ต้องลงทะเบียน `csmju-maintenance-request` ในหลังบ้านของ Core Hub ก่อน
และต้องมีไฟล์บัญชีนอก repo (`CONFORMANCE_ACCOUNTS_FILE`)

## เปลี่ยนอะไรสำหรับ 1.7.0

- **ตรวจ token 10 ขั้น** (`core-hub-token.verifier.ts`): ขั้น 9 อายุ token `exp − iat ≤ 900 + skew` · ขั้น 10 `azp` ต้องเป็น `csmju-maintenance-request` เมื่อมี ·
  `sub` เป็น string ทึบ ≤ 64 (ไม่ใช่ UUID) · `email` ไม่บังคับ · claim อื่นปล่อยผ่าน · log `token_lifetime_exceeded` / `invalid_azp`
- **Central SSO 1.1** (`sso-callback.controller.ts`, `sso-session.ts`): `GET /auth/login` สร้าง state 32 ไบต์ในคุกกี้ `csmju_maintenance_request_sso_state`
  (Path=/auth/callback · 600 วินาที) → เว็บ Core Hub `/sso/authorize` · callback: ไม่มี state → 302 `/auth/login` ไม่ตั้งคุกกี้ ·
  state ไม่ตรง → 401 (HTML มีปุ่มเข้าสู่ระบบอีกครั้ง) · role ไม่รับ → 403 · สำเร็จ → คุกกี้ `csmju_maintenance_request_access_token` แล้ว 302 ไป `next` ·
  `POST /auth/logout` → 303 ไป `/logout` ของ Core Hub · `Cache-Control: no-store` และ `Referrer-Policy: no-referrer` · log แค่ path
- **core role 6 ค่า**: `lecturer` → USER · `guest` / `alumni` → 403
- **ไม่เก็บชื่อ/อีเมล** (migration `20261002120000_standards_1_7_0`): `profiles` ลบ `email` `display_name` เพิ่ม `person_code` (จาก `/people/me` ครั้งแรกที่เข้าใช้) ·
  ชื่อดูจาก Core Hub ตอนแสดงผล (`src/core-hub/people.service.ts`) เฉพาะหน้ารายละเอียด ไม่ cache · รายการแสดง person_code ·
  ข้อความแจ้งเตือน/ประวัติที่เขียนใหม่ใช้ person_code แทนชื่อ
- **อาคารเป็นข้อมูลกลาง**: ลบตาราง `buildings` · `repair_requests` / `qr_tags` เก็บ `building_code` (ย้ายข้อมูลเดิมจาก `buildings.code`) ·
  `GET /api/v1/buildings` อ่านจาก Core Hub ผ่าน cache รวม 10 นาที (single-flight · stale-on-error · รอ 30 วินาที/Retry-After) · Core Hub ล่มไม่มี cache → 503 + Retry-After ·
  ลบ POST/PATCH/DELETE อาคาร
- **error code 9 ค่า** (`TOO_MANY_REQUESTS`, `SERVICE_UNAVAILABLE` + `Retry-After`)
- **frontend**: ต่ออายุแบบ silent re-SSO ผ่าน `/auth/login?next=` (กันวน 30 วินาที · ต่อล่วงหน้าตาม `sessionExpiresAt`) ·
  ฟอร์มแจ้งซ่อมที่กรอกค้างไม่ถูก redirect ทับ ขึ้นแถบต่ออายุในแท็บใหม่ · ออกจากระบบเป็น POST · proxy เฉพาะ `/api/*` + `/auth/login|callback|logout` ·
  ไม่มีฟอร์มข้อมูลติดต่อ (โปรไฟล์มีแค่รูป) · ไม่แสดงรายการสิทธิ์
- **ค่าตั้ง**: ชื่อ `csmju-maintenance-request` · พอร์ต frontend 3221 / backend 4221 (ไฟล์บัญชี dev server) · `.env.example` ชี้ `https://csmju2030.jowave.com` ·
  `subsystem.yaml` รูปแบบ 1.7.0 (ไม่มี `standards_version` · มี `core_hub_web_url` · `default_role_mapping` · probe ย้ายไป `categories`) ·
  pnpm 12.3.4 (`allowBuilds` ใน `pnpm-workspace.yaml` · lockfile เพิ่ม packageManagerDependencies)
- seed.ts: ประเภทอุปกรณ์ 10 ประเภท (อาการที่พบบ่อย/ไอคอน/ลำดับ) + ห้องของสาขา 8 ห้องตามหน้า Facilities (สร้างเฉพาะที่ยังไม่มี · ไม่มีอุปกรณ์) · ลบ seed-demo.ts และรูปตัวอย่าง

## ฟีเจอร์ใหม่ (3 ต.ค. 2569)

- **“ฉันก็เจอ” แทนการแจ้งซ้ำ** — ตาราง `request_followers` (migration `20261003090000_request_followers`) · `GET /api/v1/repair-requests/similar`
  (ใบที่ยังเปิดในอาคารเดียวกัน ห้อง/จุดมีคำเดียวกัน หรือเลขครุภัณฑ์ตรงกัน · ไม่มีข้อมูลบุคคล) · `POST /:id/followers` · `DELETE /:id/followers/me` ·
  permission `repair-request:follow` (USER) · ผู้ติดตามอ่านใบนั้นได้ อยู่ในรายการ "ของฉัน" และได้รับการแจ้งเตือนเหมือนผู้แจ้ง (แต่ยกเลิก/ให้คะแนนไม่ได้) ·
  ประวัติมีรายการ `FOLLOWED` · ฟอร์มแจ้งซ่อมเตือนระหว่างกรอก · หน้าใบแจ้งซ่อม/รายการ/บอร์ดแสดง "เดือดร้อน N คน"
- **แนะนำหมวดหมู่/ความเร่งด่วนจากอาการ** — `frontend/src/lib/triage.ts` กฎคำสำคัญในเครื่อง (ไม่ส่งข้อความออกนอกระบบ ไม่ใช้ AI ภายนอก) ·
  อันตราย (ช็อต ควัน ไหม้ น้ำท่วม แก๊ส ติดลิฟต์) → ด่วนมาก พร้อมคำเตือนความปลอดภัย · ผู้ใช้กด "ใช้คำแนะนำ" เอง
- **บอร์ดงานแบบลากวาง** — `/board` (ช่าง/ผู้ดูแล) คอลัมน์ รอรับ · รับแล้ว · กำลังซ่อม · รออะไหล่ · เสร็จ · คอลัมน์ที่วางได้ตามสิทธิ์จาก
  `allowedActions` (เพิ่มใน summary) · พักงาน/ปิดงานถามหมายเหตุ · ใช้คีย์บอร์ด/มือถือผ่านเมนู "ย้ายไป…" · ใช้ endpoint เดิม (`/accept`, `/status`)

## รอบปรับปรุง 3 ต.ค. 2569 (ตามคำขอเจ้าของระบบ)

- **ห้อง → เครื่อง → แจ้งซ่อม** — ผู้ดูแลเพิ่มห้องและเครื่อง (เพิ่มทีละหลายเครื่องได้ เช่น PC-01…PC-30) · ทุกคนเห็นผังเครื่องในห้องพร้อมสถานะ
  (ปกติ · แจ้งแล้ว · กำลังซ่อม · รออะไหล่) · หน้าเครื่องแจ้งอาการด้วยปุ่มอาการที่พบบ่อยของหมวด + รูป ·
  เครื่องที่มีใบเปิดอยู่แจ้งซ้ำไม่ได้ (409) ให้กด "ฉันก็เจอ" แทน
- **QR ต่อห้องและต่อเครื่อง** (`GET /api/v1/qr-codes/:code`) แทนสติกเกอร์จุดแจ้งซ่อมเดิม (ลบตาราง `qr_tags`)
- **ผู้ใช้และช่าง** ดึงรายชื่อนักศึกษา/บุคลากรจาก Core Hub (`GET /api/v1/profiles/people`) · ระบบนี้เก็บแค่ว่าใครแจ้งอะไร
- ผู้ดูแลไม่มีเมนู/สิทธิ์แจ้งซ่อม · การแจ้งเตือนของช่าง/ผู้ดูแลรวมในหน้าคิวงาน · สถิติเริ่มที่ 7 วันล่าสุดและรีเฟรชทุกนาที ·
  บอร์ดงานปรับให้อ่านง่าย · ใบแจ้งซ่อมมีแถบขั้นตอน (แจ้งแล้ว → รับเรื่อง → กำลังซ่อม → เสร็จ)
- หมวดหมู่งานซ่อมเป็นประเภทอุปกรณ์จริงของสาขา (seed 10 หมวด) พร้อมอาการที่พบบ่อย · ลบข้อมูลจำลองทั้งหมด

## ชั้น auth ที่คัดลอกมา

- คัดลอกจาก demo-student-subsystem (https://github.com/CSMJU2030/demo-student-subsystem) แบบไม่แก้: `backend/src/auth/**` · `common/**` ·
  `core-hub/**` · `config/env.validation.ts` · `health/**` · `main.ts` · `test/helpers/{token-factory,fake-core-hub}.ts` (อยู่ใน `.prettierignore`)
- แก้ไข (ส่วนที่ reference ให้ปรับ): `role-mapping.ts` · `permissions.ts` · `core-hub-identity.ts` (role USER/TECHNICIAN/ADMIN) ·
  `reference-datasets.ts` + `reference-data.types.ts` (เพิ่ม `buildings`) · `config/configuration.ts` (พอร์ต/ชื่อระบบ/`UPLOAD_DIR`) · spec ที่ผูกกับ role
- ของระบบนี้: `src/actor/repair-actor.guard.ts` วางระหว่าง `CoreHubJwtGuard` กับ `PermissionsGuard`

## Role mapping ที่ประกาศ (ต้องตรงกับ default_role_mapping ในทะเบียน)

| core role | subsystem role |
|---|---|
| student | USER |
| staff | USER (ผู้ดูแลแต่งตั้งเป็น `TECHNICIAN` ได้ — `profiles.is_technician`) |
| lecturer | USER |
| admin | ADMIN |
| alumni · guest | ไม่รับ → 403 |

## ข้อสมมติที่ตั้งเอง (เพราะมาตรฐานไม่ได้ระบุ หรือระบุไม่ตรงกัน)

1. **เวอร์ชัน standards** — ใช้ 1.7.0 ทั้งชุด (สาย 1.0.x ปิดแล้ว) · ฟอนต์ Noto Sans Thai + Plus Jakarta Sans และ palette Material 3 ตาม `ui-design-system.md`
2. **Tailwind v3.4 แทน v4** — `@tailwindcss/postcss` ไม่อยู่ใน whitelist · ใช้ชื่อ class/token เดียวกับมาตรฐาน ย้ายเป็น v4 ได้โดยไม่แก้หน้าเว็บ
3. **`src/csmju` แทน template `csmju-subsystem-web` และ `@csmju/core-sdk`** ที่ยังไม่เผยแพร่ — ชื่อ component/สไตล์ตามมาตรฐาน ·
   โลโก้เป็นตัวแทน (เข้าถึง `csmju-core-hub/frontend/public/csmju-logo.png` ไม่ได้)
4. **ข้อขัดกันใน ui-design-system.md ข้อ 16.1.2** — ข้อ 5 (JSON เป็น snake_case) และข้อ 6 (อ่านผู้ใช้จาก header `X-User-Id` ของ gateway)
   ขัดกับ `api-conventions.md` / `auth-contract.md` และ conformance → ทำตามสองเอกสารหลัง (JSON camelCase, ตรวจ JWT เองด้วย JWKS)
5. **endpoint ไฟล์รูป** `GET /api/v1/repair-images/:id/file` และ `GET /api/v1/profiles/:id/avatar` ตอบเป็นไฟล์ภาพ ไม่ใช่ envelope JSON
   (ใช้กับ `<img>` ได้ตรง ๆ) — ข้อยกเว้นเดียว (error ยังเป็น envelope ตามปกติ)
6. **ออกจากระบบ** = `POST /auth/logout` ลบคุกกี้ของระบบนี้แล้วพาไป `/logout` ของ Core Hub (ออกทั้งระบบ — auth-contract ข้อ 7)
7. **ข้อมูลบุคคลที่เก็บในระบบนี้** — เฉพาะ `person_code` และรูปโปรไฟล์ `avatar_filename` ที่ผู้ใช้อัปโหลดเอง · ลบ `phone`, `work_unit`
   (migration `20261003120000_rooms_equipment` — แจ้งซ่อมอุปกรณ์ในสาขา ไม่ต้องติดต่อกลับ) · **ไม่เก็บชื่อและอีเมล** · `core_role` เป็นสำเนาจาก token ใช้กรองช่างเท่านั้น ·
   รูปโปรไฟล์ครอปเป็นสี่เหลี่ยม 512px ในเบราว์เซอร์ รับเฉพาะ JPG/PNG/WebP ≤ 2 MB (ตรวจ magic bytes)
   · ชื่อจริงแสดงเฉพาะหน้ารายละเอียด (หาไม่เกิน 10 คนต่อคำขอ) ผู้ดูที่ไม่ใช่ staff/lecturer/admin เห็นชื่อตัวเองเท่านั้น
8. **ช่าง** = บุคลากร (core role `staff`) ที่ผู้ดูแลแต่งตั้ง · ถอดได้เมื่อไม่มีงานค้าง (409)
   · **⚠️ ผู้ดูแลระบบแจ้งซ่อมจาก ADMIN_ACCOUNTS** — บัญชีเจ้าของระบบของทีมมี core role `staff` จึงได้แค่ USER ·
   สิทธิ์พิเศษรายบุคคลของ Core Hub (subsystem-registry ข้อ 7) ยังไม่ใส่ role ใน token จึงใช้ค่าตั้ง `ADMIN_ACCOUNTS`
   (อีเมลจาก token ที่ตรวจแล้ว · เฉพาะ staff/lecturer) ตั้งที่ server ไม่อยู่ในโค้ดหรือ repo — เบี่ยงจากข้อห้ามรายชื่อผู้ใช้ ต้องแจ้ง PL
   และเลิกใช้เมื่อ Core Hub รองรับสิทธิ์พิเศษใน token
9. **รูปงานซ่อมเก็บบนดิสก์** (`UPLOAD_DIR`, volume ใน Docker) ไม่ใช่ object storage
10. **QR** — whitelist ไม่มีไลบรารี QR จึงเขียน encoder เอง (byte mode, v1–40, L/M/Q/H) · ทดสอบด้วยตัวถอดรหัสที่เขียนแยก
    (`frontend/src/lib/qr.test.ts`) และตรวจกับ jsQR ระหว่างพัฒนา 160/160
11. **UI-03 (warn)** — `!important` มีเฉพาะใน `prefers-reduced-motion` ซึ่งมาตรฐานอนุญาต (ข้อ 3.6)
12. **⚠️ ห้องและเครื่องเก็บในระบบนี้** — `reference-data.md` ให้ห้องเป็นข้อมูลกลาง แต่ Core Hub ยังไม่มี dataset ห้อง/ครุภัณฑ์ของสาขา
    เจ้าของระบบจึงให้ผู้ดูแลสร้างห้องเอง (ตาราง `rooms` · `equipment` ผูก `building_code` ของ Core Hub) — ต้องขอข้อยกเว้นจาก PL
    และย้ายไปใช้ dataset กลางเมื่อมี
13. **⚠️ เบี่ยงจากสเปค AppShell (ตามคำขอของเจ้าของระบบ 2026-09-25)** — บนจอ md+ sidebar ย่อเป็นแถบไอคอน 72px
    และกางเป็น 256px แบบมาตรฐานเมื่อชี้เมาส์หรือกด Tab เข้าไป (กางทับเนื้อหา ไม่ดันหน้า) · ปุ่ม "ตรึงแถบเมนูไว้"
    กลับเป็น sidebar กางตลอดตามสเปค (จำค่าในคุกกี้ `csmju_sidebar`) · ปุ่มกลับหน้าหลัก/ออกจากระบบยังอยู่ล่างซ้ายตำแหน่งเดิม ·
    มือถือยังเป็น drawer ตามสเปค — ถ้า PL ไม่อนุมัติ ให้ตั้งค่าเริ่มต้นเป็นตรึงไว้ (`initialPinned`) หรือใช้ AppShell จาก template แทน ·
    เมื่อระบบปฏิบัติการตั้ง `prefers-reduced-motion` (เช่น Windows ปิด Animation effects) แถบจะกาง/หุบทันทีตามกฎข้อ 3.6
    และใช้การจางของข้อความ 150ms แทนการเลื่อน · กรอบโลโก้กว้างเต็มแผง ·
    เมนูผู้ใช้บน top bar แสดงแค่ avatar (สเปคให้มีชื่อบทบาทข้าง avatar บน desktop) กดแล้วจึงเห็นชื่อ อีเมล และบทบาท
14. **แยกสถานะ 3 เรื่องด้วยรูปแบบ ไม่ใช่สีอย่างเดียว** (สีและ badge ใช้ของมาตรฐานทั้งหมด) — สถานะงาน = badge มีจุดสี +
    แถบสีซ้ายของแถวรายการ · ความเร่งด่วน = tag ไม่มีจุด + ลูกศรบอกระดับ (สีเฉพาะด่วน/ด่วนมาก) · กำหนดเสร็จ = ข้อความ + ไอคอนนาฬิกา
    (สีเฉพาะใกล้/เกินกำหนด) · กราฟสถิติตามสถานะ/ความเร่งด่วนใช้สีเดียวกับ badge · ตัวนับแท็บ "เกินกำหนด" เป็นสีแดง

## สิ่งที่ยังทำไม่ได้ / เคสที่ยังไม่ผ่าน

- **GH-04** ผ่านเมื่อ commit submodule ที่ชี้ v1.7.0
- **ต้องให้ DevOps แก้** `.github/workflows/ci.yml` (ทีมแก้ไม่ได้): ยังปัก `@v1.0.0` และ `subsystem_name: csmju-repair` —
  ต้องย้ายเป็น `@v1.5.2` ขึ้นไป (`standards-versioning.md` ข้อ 4) และใช้ชื่อ `csmju-maintenance-request`
- **ลงทะเบียน** `csmju-maintenance-request` ในหลังบ้านของ Core Hub (PL · callback `http://localhost:3221/auth/callback`) แล้วรัน conformance
- **probe create** ใช้ `allowed_role: admin` (หมวดหมู่ = งานของผู้ดูแลระบบ) แต่ Core Hub จริงไม่มีบัญชี admin ให้ทีม —
  เคสนี้รันได้กับ Core Hub ในเครื่อง/ตัวจำลองเท่านั้น จนกว่าจะได้สิทธิ์พิเศษรายบุคคล
- ข้อความแจ้งเตือน/ประวัติ **เก่า** ที่เคยเขียนชื่อคนไว้ในข้อความยังอยู่ในฐานข้อมูล (migration ไม่แก้ข้อความอิสระ)
- อาคารเดิมที่ไม่มี code ได้ `LEGACY-xxxxxxxx` ซึ่งไม่ตรงกับ Core Hub — ต้องแก้สติกเกอร์ QR ไปใช้อาคารของ Core Hub
- template `csmju-subsystem-web` / โลโก้ ยังไม่มีสิทธิ์ใช้ (`frontend/src/csmju` เป็นตัวแทน)

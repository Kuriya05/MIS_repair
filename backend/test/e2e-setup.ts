/**
 * Static environment for the e2e suite — runs before AppModule is imported (และก่อน env validation)
 * DATABASE_URL ไม่ถูกเรียกจริง: ProfilesService ถูกแทนด้วยตัวจำลองในหน่วยความจำ
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://localhost:5434/repair_e2e_unused';
process.env.CORE_HUB_ISSUER = 'core-hub';
process.env.CORE_HUB_AUDIENCE = 'csmju2030';
process.env.JWKS_CACHE_TTL_MS = '60000';
process.env.JWKS_MIN_REFRESH_INTERVAL_MS = '1';
process.env.SUBSYSTEM_ID = 'csmju-maintenance-request';
// เว็บของ Core Hub: เป็นแค่ปลายทาง redirect ไม่ถูกเรียกในเทส
process.env.CORE_HUB_WEB_URL = 'https://core-hub-web.test';

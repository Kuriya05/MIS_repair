import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import type { NextConfig } from 'next';

/**
 * ค่าที่ frontend ใช้จาก .env ที่รากของ repo (ไฟล์เดียวกับ backend) — หยิบเฉพาะคีย์ของหน้าเว็บ
 * ไม่ดึงค่าอื่น (เช่น connection string ของฐานข้อมูล) เข้ามาในโปรเซสของ Next.js (ARC-01)
 */
const rootEnv = resolve(process.cwd(), '..', '.env');
if (existsSync(rootEnv)) {
  const parsed = parseEnv(readFileSync(rootEnv, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    const wanted = key === 'BACKEND_URL' || key === 'CORE_HUB_WEB_URL' || key.startsWith('NEXT_PUBLIC_');
    if (wanted && value !== undefined && process.env[key] === undefined) process.env[key] = value;
  }
}

const backend = (process.env.BACKEND_URL ?? 'http://127.0.0.1:4221').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // กติกาของ AI agent ใน repo นี้มาจาก standards/ai/AGENTS.md — ไม่ให้ next dev สร้างไฟล์ซ้อน
  agentRules: false,
  // ปุ่ม dev tools ของ Next.js (เฉพาะตอน dev) ย้ายไปขวาล่าง ไม่ให้บังปุ่มออกจากระบบในแถบเมนูซ้าย
  devIndicators: { position: 'bottom-right' },
  output: 'standalone',
  // frontend เป็นประตูเดียวของระบบ (connect-core-hub.md ข้อ 1): /api/* และ /auth/login · callback · logout
  // ส่งต่อไป backend — คุกกี้ <ชื่อระบบ>_access_token จึงถูกส่งไปกับทุกคำขอเอง
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/auth/login', destination: `${backend}/auth/login` },
      { source: '/auth/callback', destination: `${backend}/auth/callback` },
      { source: '/auth/logout', destination: `${backend}/auth/logout` },
    ];
  },
  async headers() {
    return [
      {
        // /auth/* ตั้ง Cache-Control และ Referrer-Policy: no-referrer เองที่ backend (URL ของ callback มี token)
        source: '/((?!auth/).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

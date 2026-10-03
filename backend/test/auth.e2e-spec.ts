/**
 * e2e ของผิว HTTP ด้าน auth/สัญญา API — รันในโปรเซส ไม่ต้องมีฐานข้อมูลหรือ Core Hub จริง
 * Core Hub จำลอง (test/helpers/fake-core-hub.ts ของ reference) ให้ JWKS และ /people/me ·
 * ProfilesService เป็นตัวแทนในหน่วยความจำ
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ROUTES_OUTSIDE_API_PREFIX, configureApp } from '../src/app-setup';
import { AppModule } from '../src/app.module';
import type { CoreHubIdentity } from '../src/auth/core-hub-identity';
import { ProfilesService } from '../src/profiles/profiles.service';
import { FakeCoreHub } from './helpers/fake-core-hub';
import { createSigningKey, signCoreHubToken, type TestSigningKey } from './helpers/token-factory';

const SESSION = 'csmju_maintenance_request_access_token';
const STATE = 'csmju_maintenance_request_sso_state';

const setCookies = (res: request.Response): string[] => {
  const raw = res.headers['set-cookie'] as unknown;
  return Array.isArray(raw) ? (raw as string[]) : raw ? [String(raw)] : [];
};
const cookieNamed = (res: request.Response, name: string) =>
  setCookies(res).find((cookie) => cookie.startsWith(`${name}=`));

describe('HTTP surface (auth-contract.md 1.2 · api-conventions.md)', () => {
  let app: INestApplication;
  let key: TestSigningKey;
  const hub = new FakeCoreHub();
  const technicians = new Set<string>();

  const token = (options: Parameters<typeof signCoreHubToken>[1] = {}) => signCoreHubToken(key, options);

  beforeAll(async () => {
    key = await createSigningKey();
    await hub.start([key]);
    process.env.CORE_HUB_URL = hub.url;
    process.env.CORE_HUB_JWKS_URL = `${hub.url}/api/v1/.well-known/jwks.json`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProfilesService)
      .useValue({
        touch: async (user: CoreHubIdentity) => ({
          id: '4f1c2b9a-7d4e-4c1a-9b2f-1a2b3c4d5e6f',
          coreUserId: user.id,
          personCode: null,
          coreRole: user.coreRole,
          isTechnician: technicians.has(user.id),
          avatarFilename: null,
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    // The same two calls main.ts makes.
    app.setGlobalPrefix('api', { exclude: ROUTES_OUTSIDE_API_PREFIX });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await hub.stop();
  });

  const http = () => request(app.getHttpServer());

  it('GET /api/health is public and names the subsystem', async () => {
    const res = await http().get('/api/health').expect(200);
    expect(res.body).toEqual({
      success: true,
      data: { status: 'ok', service: 'csmju-maintenance-request' },
    });
  });

  it.each(['/api/v1/auth/login', '/api/v1/login', '/api/v1/auth/register'])(
    'has no local authentication endpoint at POST %s',
    async (path) => {
      const res = await http().post(path).send({ email: 'x@y.local', password: 'password1' }).expect(404);
      expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    },
  );

  it('401 UNAUTHORIZED without a token', async () => {
    const res = await http().get('/api/v1/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/me reflects the verified claims in the reference shape', async () => {
    const res = await http()
      .get('/api/v1/me')
      .set('authorization', `Bearer ${await token({ role: 'student', sub: 'user-6504101234' })}`)
      .expect(200);
    expect(res.body.data).toMatchObject({
      id: 'user-6504101234',
      coreRole: 'student',
      subsystemRole: 'USER',
      session: { expiresAt: expect.any(String) },
    });
  });

  it('403 FORBIDDEN (not 401) for core roles that are not mapped', async () => {
    for (const role of ['alumni', 'guest']) {
      const res = await http()
        .get('/api/v1/me')
        .set('authorization', `Bearer ${await token({ role, sub: 'user-004' })}`)
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('an appointed staff member becomes TECHNICIAN before permissions are checked', async () => {
    technicians.add('user-007');
    const res = await http()
      .get('/api/v1/me')
      .set('authorization', `Bearer ${await token({ role: 'staff', sub: 'user-007' })}`)
      .expect(200);
    expect(res.body.data.subsystemRole).toBe('TECHNICIAN');
  });

  it('401 for a refresh-token-like lifetime and for a token issued to another subsystem', async () => {
    const longLived = await token({ expiresInSec: 7 * 86_400 });
    await http().get('/api/v1/me').set('authorization', `Bearer ${longLived}`).expect(401);
    const otherAzp = await token({ azp: 'csmju-other-system' });
    await http().get('/api/v1/me').set('authorization', `Bearer ${otherAzp}`).expect(401);
  });

  describe('Central SSO 1.1', () => {
    async function startLogin(next?: string) {
      const res = await http()
        .get(`/auth/login${next === undefined ? '' : `?next=${encodeURIComponent(next)}`}`)
        .expect(302);
      const location = new URL(res.headers.location as string);
      const cookie = cookieNamed(res, STATE)!;
      return { res, location, state: location.searchParams.get('state')!, cookie: cookie.split(';')[0] };
    }

    it('GET /auth/login sends the browser to the Core Hub web app with a one-time state', async () => {
      const { location, cookie } = await startLogin('/rooms');
      expect(location.origin + location.pathname).toBe('https://core-hub-web.test/sso/authorize');
      expect(location.searchParams.get('subsystem')).toBe('csmju-maintenance-request');
      expect(cookie.startsWith(`${STATE}=`)).toBe(true);
    });

    it('callback with a matching state sets the session cookie and returns to next', async () => {
      const { state, cookie } = await startLogin('/rooms');
      const res = await http()
        .get(`/auth/callback?access_token=${await token()}&state=${state}`)
        .set('cookie', cookie)
        .expect(302);
      expect(res.headers.location).toBe('/rooms');
      const session = cookieNamed(res, SESSION)!;
      expect(session).toMatch(/HttpOnly/);
      const me = await http().get('/api/v1/me').set('cookie', session.split(';')[0]).expect(200);
      expect(me.body.data.id).toBe('user-003');
    });

    it('callback without state restarts at /auth/login and sets no cookie', async () => {
      const res = await http()
        .get(`/auth/callback?access_token=${await token()}`)
        .expect(302);
      expect(res.headers.location).toBe('/auth/login');
      expect(cookieNamed(res, SESSION)).toBeUndefined();
    });

    it('a mismatched state is 401 without a session cookie', async () => {
      const { cookie } = await startLogin();
      const res = await http()
        .get(`/auth/callback?access_token=${await token()}&state=someone-else`)
        .set('cookie', cookie)
        .expect(401);
      expect(cookieNamed(res, SESSION)).toBeUndefined();
    });

    it('POST /auth/logout clears the cookies and goes to the Core Hub logout page', async () => {
      const res = await http().post('/auth/logout').expect(303);
      expect(res.headers.location).toBe('https://core-hub-web.test/logout');
      expect(cookieNamed(res, SESSION)).toBeDefined();
    });
  });

  it('checks permissions before touching data', async () => {
    const student = `Bearer ${await token({ role: 'student', sub: 'user-002' })}`;
    const res = await http().post('/api/v1/categories').set('authorization', student).send({ name: 'Probe' });
    expect(res.status).toBe(403);
    const admin = `Bearer ${await token({ role: 'admin', sub: 'user-001' })}`;
    // ผู้ดูแลระบบไม่ได้เป็นผู้แจ้งซ่อม
    const report = await http().post('/api/v1/repair-requests').set('authorization', admin).send({});
    expect(report.status).toBe(403);
  });

  it('400 for a malformed resource id and 404 envelope for an unknown route', async () => {
    const staff = `Bearer ${await token()}`;
    const bad = await http().get('/api/v1/categories/not-a-uuid').set('authorization', staff).expect(400);
    expect(bad.body.error.code).toBe('BAD_REQUEST');
    const missing = await http().get('/api/v1/__does_not_exist__').set('authorization', staff).expect(404);
    expect(missing.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('400 VALIDATION_ERROR with Thai "field: message" details for invalid input', async () => {
    const res = await http()
      .get('/api/v1/categories?limit=not-a-number')
      .set('authorization', `Bearer ${await token()}`)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0]).toMatch(/^limit: /);
  });
});

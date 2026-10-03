import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiRequestError, NETWORK_ERROR_MESSAGE, toQuery } from './api';

const respond = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    ),
  );

afterEach(() => vi.unstubAllGlobals());

describe('api client (api-conventions.md ข้อ 3–4)', () => {
  it('unwraps the success envelope and keeps pagination meta', async () => {
    respond(200, { success: true, data: [{ id: 1 }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    await expect(api('/api/v1/buildings')).resolves.toEqual({
      data: [{ id: 1 }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('turns VALIDATION_ERROR details into per-field Thai messages', async () => {
    respond(400, {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ข้อมูลไม่ถูกต้อง',
        details: ['location: กรุณาระบุสถานที่', 'location: ยาวเกิน 150 ตัวอักษร', 'floor: ต้องเป็นตัวเลข'],
      },
    });
    const failure = await api('/api/v1/qr-tags', { method: 'POST', json: {} }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiRequestError);
    const error = failure as ApiRequestError;
    expect([error.status, error.code, error.message]).toEqual([400, 'VALIDATION_ERROR', 'ข้อมูลไม่ถูกต้อง']);
    // ข้อความแรกของแต่ละช่องชนะ
    expect(error.fieldErrors()).toEqual({ location: 'กรุณาระบุสถานที่', floor: 'ต้องเป็นตัวเลข' });
  });

  it('reports a Thai network error when the request never reaches the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(api('/api/v1/me')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: NETWORK_ERROR_MESSAGE,
    });
  });

  it('falls back to INTERNAL_ERROR for a non-envelope response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 })),
    );
    await expect(api('/api/v1/me')).rejects.toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('sends JSON with the same-origin cookie, never a token header', async () => {
    respond(201, { success: true, data: { id: 'x' } });
    await api('/api/v1/buildings', { method: 'POST', json: { name: 'อาคาร A' } });
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('same-origin');
    expect(init.body).toBe('{"name":"อาคาร A"}');
    expect(init.headers).toEqual({ accept: 'application/json', 'content-type': 'application/json' });
  });

  it('builds query strings without empty values', () => {
    expect(toQuery({ q: 'แอร์', page: 2, status: '', buildingCode: undefined, mine: false })).toBe(
      `?q=${encodeURIComponent('แอร์')}&page=2&mine=false`,
    );
    expect(toQuery({ q: null })).toBe('');
  });
});

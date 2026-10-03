import { identity } from '../__tests__/fixtures';
import { ApiError } from '../shared/errors';
import {
  allowedActions,
  assertCan,
  canFollow,
  canRead,
  type RequestAction,
  type WorkflowSubject,
} from './workflow';

const reporter = { ...identity('USER', 'user-003') };
const stranger = { ...identity('USER', 'user-002') };
const technician = identity('TECHNICIAN', 'user-005');
const otherTechnician = identity('TECHNICIAN', 'user-006');
const admin = identity('ADMIN', 'user-001');

const request = (overrides: Partial<WorkflowSubject> = {}): WorkflowSubject => ({
  status: 'PENDING',
  coreUserId: 'user-003',
  assigneeCoreUserId: null,
  rating: null,
  ...overrides,
});

function statusOf(run: () => void) {
  try {
    run();
    return 'allowed';
  } catch (error) {
    if (error instanceof ApiError) return error.getStatus();
    throw error;
  }
}

describe('repair request workflow — 403 ก่อน 409', () => {
  it('only the reporter (read:own) or technicians/admins (read:any) can read a request', () => {
    expect(canRead(reporter, request())).toBe(true);
    expect(canRead(stranger, request())).toBe(false);
    expect(canRead(technician, request())).toBe(true);
  });

  it('403: a USER cannot accept jobs, even on their own request', () => {
    expect(statusOf(() => assertCan(reporter, request(), 'accept'))).toBe(403);
  });

  it('403: cancelling somebody else’s request', () => {
    expect(statusOf(() => assertCan(stranger, request(), 'cancel'))).toBe(403);
  });

  it('409: accepting a job that someone already accepted', () => {
    const accepted = request({ status: 'ACCEPTED', assigneeCoreUserId: 'user-006' });
    expect(statusOf(() => assertCan(technician, accepted, 'accept'))).toBe(409);
  });

  it('409: the reporter cannot cancel once work has started', () => {
    const started = request({ status: 'IN_PROGRESS', assigneeCoreUserId: 'user-005' });
    expect(statusOf(() => assertCan(reporter, started, 'cancel'))).toBe(409);
  });

  it('403 wins over 409: a stranger cancelling a finished job gets 403, not 409', () => {
    const done = request({ status: 'COMPLETED', assigneeCoreUserId: 'user-005' });
    expect(statusOf(() => assertCan(stranger, done, 'cancel'))).toBe(403);
  });

  it('only the assignee (update:own) or an admin (update:any) moves a job forward', () => {
    const job = request({ status: 'ACCEPTED', assigneeCoreUserId: 'user-005' });
    expect(statusOf(() => assertCan(technician, job, 'start'))).toBe('allowed');
    expect(statusOf(() => assertCan(otherTechnician, job, 'start'))).toBe(403);
    expect(statusOf(() => assertCan(admin, job, 'complete'))).toBe('allowed');
  });

  it('follows the transition table', () => {
    const job = (status: WorkflowSubject['status']) => request({ status, assigneeCoreUserId: 'user-005' });
    const cases: [WorkflowSubject['status'], RequestAction, number | 'allowed'][] = [
      ['ACCEPTED', 'start', 'allowed'],
      ['ACCEPTED', 'hold', 409],
      ['ACCEPTED', 'complete', 'allowed'],
      ['IN_PROGRESS', 'hold', 'allowed'],
      ['ON_HOLD', 'start', 'allowed'],
      ['ON_HOLD', 'complete', 409],
      ['COMPLETED', 'start', 409],
      ['COMPLETED', 'reject', 409],
      ['CANCELLED', 'comment', 409],
    ];
    for (const [status, action, expected] of cases) {
      expect([status, action, statusOf(() => assertCan(admin, job(status), action))]).toEqual([
        status,
        action,
        expected,
      ]);
    }
  });

  it('any technician may reject an unclaimed request (duplicate / not a repair)', () => {
    expect(statusOf(() => assertCan(otherTechnician, request(), 'reject'))).toBe('allowed');
    expect(statusOf(() => assertCan(reporter, request(), 'reject'))).toBe(403);
  });

  it('409: rating twice or before completion', () => {
    const done = request({ status: 'COMPLETED', assigneeCoreUserId: 'user-005' });
    expect(statusOf(() => assertCan(reporter, done, 'rate'))).toBe('allowed');
    expect(statusOf(() => assertCan(reporter, { ...done, rating: 5 }, 'rate'))).toBe(409);
    expect(
      statusOf(() =>
        assertCan(reporter, request({ status: 'IN_PROGRESS', assigneeCoreUserId: 'user-005' }), 'rate'),
      ),
    ).toBe(409);
  });

  it('lists the buttons each viewer may use', () => {
    expect(allowedActions(reporter, request())).toEqual(['comment', 'cancel']);
    expect(allowedActions(stranger, request())).toEqual([]);
    expect(allowedActions(technician, request())).toEqual(['comment', 'accept', 'reject']);
    expect(allowedActions(admin, request())).toEqual(['comment', 'accept', 'assign', 'edit', 'reject']);
    const mine = request({ status: 'IN_PROGRESS', assigneeCoreUserId: 'user-005' });
    expect(allowedActions(technician, mine)).toEqual(['comment', 'edit', 'hold', 'complete', 'reject']);
  });
});

describe('"ฉันก็เจอ" (follow)', () => {
  it('another user can follow an open request once', () => {
    expect(canFollow(stranger, request(), false)).toBe(true);
    expect(canFollow(stranger, request({ status: 'IN_PROGRESS' }), false)).toBe(true);
    expect(canFollow(stranger, request(), true)).toBe(false);
  });

  it('the reporter cannot follow their own request', () => {
    expect(canFollow(reporter, request(), false)).toBe(false);
  });

  it('closed requests cannot be followed — report a new one instead', () => {
    for (const status of ['COMPLETED', 'REJECTED', 'CANCELLED'] as const) {
      expect(canFollow(stranger, request({ status }), false)).toBe(false);
    }
  });

  it('a follower does not gain the reporter’s actions', () => {
    expect(allowedActions(stranger, request({ status: 'COMPLETED' }))).not.toContain('rate');
    expect(statusOf(() => assertCan(stranger, request(), 'cancel'))).toBe(403);
  });
});

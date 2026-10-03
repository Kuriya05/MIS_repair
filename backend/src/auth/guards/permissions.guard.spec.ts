import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthEventsLogger } from '../auth-events.logger';
import { CoreHubIdentity, SubsystemRole } from '../core-hub-identity';
import { Permission } from '../permissions';
import { PermissionsGuard } from './permissions.guard';

function contextFor(user?: CoreHubIdentity): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, path: '/api/v1/courses' }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function identity(role: SubsystemRole): CoreHubIdentity {
  return {
    id: 'user-001',
    email: 'user@core.local',
    coreRole: role.toLowerCase(),
    subsystemRole: role,
  };
}

describe('PermissionsGuard - authorization tests (spec §15, §36)', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector, new AuthEventsLogger());

  function requirePermissions(...permissions: Permission[]): void {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permissions);
  }

  afterEach(() => jest.restoreAllMocks());

  it('allows a route with no permission metadata', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextFor(identity(SubsystemRole.USER)))).toBe(true);
  });

  it('allows an ADMIN to assign a repair job', () => {
    requirePermissions(Permission.REPAIR_JOB_ASSIGN);
    expect(guard.canActivate(contextFor(identity(SubsystemRole.ADMIN)))).toBe(true);
  });

  it('denies a USER assigning a repair job with 403', () => {
    requirePermissions(Permission.REPAIR_JOB_ASSIGN);
    expect(() => guard.canActivate(contextFor(identity(SubsystemRole.USER)))).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('denies an ADMIN filing a repair request (admins do not report)', () => {
    requirePermissions(Permission.REPAIR_REQUEST_CREATE);
    expect(() => guard.canActivate(contextFor(identity(SubsystemRole.ADMIN)))).toThrow(
      expect.objectContaining({ status: 403 }),
    );
    expect(guard.canActivate(contextFor(identity(SubsystemRole.USER)))).toBe(true);
  });

  it('passes when the role holds any one of the required permissions', () => {
    requirePermissions(Permission.REPAIR_REQUEST_READ_ANY, Permission.REPAIR_REQUEST_READ_OWN);
    expect(guard.canActivate(contextFor(identity(SubsystemRole.USER)))).toBe(true);
  });

  it('returns 401 when no verified identity is present', () => {
    requirePermissions(Permission.BUILDING_READ);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(expect.objectContaining({ status: 401 }));
  });
});

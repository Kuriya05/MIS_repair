import { SubsystemRole } from './core-hub-identity';
import { Permission, ROLE_PERMISSIONS, can, canAny } from './permissions';

describe('Subsystem permission model (spec §15, §16)', () => {
  it('a USER reports repairs and sees only their own requests', () => {
    expect(can(SubsystemRole.USER, Permission.REPAIR_REQUEST_CREATE)).toBe(true);
    expect(can(SubsystemRole.USER, Permission.REPAIR_REQUEST_READ_OWN)).toBe(true);
    expect(can(SubsystemRole.USER, Permission.REPAIR_REQUEST_READ_ANY)).toBe(false);
    expect(can(SubsystemRole.USER, Permission.REPAIR_JOB_ACCEPT)).toBe(false);
  });

  it('a TECHNICIAN keeps everything a USER has and works the queue', () => {
    for (const permission of ROLE_PERMISSIONS.USER) {
      expect(can(SubsystemRole.TECHNICIAN, permission)).toBe(true);
    }
    expect(can(SubsystemRole.TECHNICIAN, Permission.REPAIR_JOB_ACCEPT)).toBe(true);
    expect(can(SubsystemRole.TECHNICIAN, Permission.REPAIR_JOB_ASSIGN)).toBe(false);
  });

  it('an ADMIN manages jobs and master data but does not file repair requests', () => {
    expect(can(SubsystemRole.ADMIN, Permission.REPAIR_JOB_ASSIGN)).toBe(true);
    expect(can(SubsystemRole.ADMIN, Permission.ROOM_MANAGE)).toBe(true);
    expect(can(SubsystemRole.ADMIN, Permission.REPAIR_REQUEST_CREATE)).toBe(false);
    expect(can(SubsystemRole.ADMIN, Permission.REPAIR_REQUEST_FOLLOW)).toBe(false);
  });

  it('canAny passes when at least one permission is held', () => {
    expect(
      canAny(SubsystemRole.USER, [Permission.REPAIR_REQUEST_READ_ANY, Permission.REPAIR_REQUEST_READ_OWN]),
    ).toBe(true);
    expect(canAny(SubsystemRole.USER, [Permission.REPAIR_JOB_ASSIGN])).toBe(false);
  });

  it('uses <resource>:<action>[:own|:any] names only', () => {
    for (const permission of Object.values(Permission)) {
      expect(permission).toMatch(/^[a-z]+(-[a-z]+)*:[a-z]+(-[a-z]+)*(:(own|any))?$/);
    }
  });
});

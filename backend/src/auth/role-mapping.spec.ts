import { SubsystemRole } from './core-hub-identity';
import { CORE_ROLE_TO_SUBSYSTEM_ROLE, mapCoreRoleToSubsystemRole } from './role-mapping';

describe('Core role -> subsystem role mapping (spec §14)', () => {
  it.each([
    ['student', SubsystemRole.USER],
    ['staff', SubsystemRole.USER],
    ['lecturer', SubsystemRole.USER],
    ['admin', SubsystemRole.ADMIN],
  ])('maps core role "%s" to %s', (coreRole, expected) => {
    expect(mapCoreRoleToSubsystemRole(coreRole)).toBe(expected);
  });

  it('matches default_role_mapping in subsystem.yaml', () => {
    expect(CORE_ROLE_TO_SUBSYSTEM_ROLE).toEqual({
      student: 'USER',
      staff: 'USER',
      lecturer: 'USER',
      admin: 'ADMIN',
    });
  });

  it('is case and whitespace tolerant', () => {
    expect(mapCoreRoleToSubsystemRole('  STAFF ')).toBe(SubsystemRole.USER);
  });

  it('refuses alumni, guest and unknown roles (403)', () => {
    expect(mapCoreRoleToSubsystemRole('alumni')).toBeNull();
    expect(mapCoreRoleToSubsystemRole('guest')).toBeNull();
    expect(mapCoreRoleToSubsystemRole('finance-officer')).toBeNull();
    expect(mapCoreRoleToSubsystemRole(undefined)).toBeNull();
  });
});

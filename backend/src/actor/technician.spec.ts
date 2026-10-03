import { SubsystemRole } from '../auth/core-hub-identity';
import { effectiveRole, parseAdminAccounts } from './technician';

describe('parseAdminAccounts', () => {
  it('splits on commas and spaces, trims and lowercases', () => {
    expect(parseAdminAccounts(' A@x.ac.th, b@y.ac.th  c@z.ac.th,,')).toEqual([
      'a@x.ac.th',
      'b@y.ac.th',
      'c@z.ac.th',
    ]);
  });

  it('is empty when the variable is missing or blank', () => {
    expect(parseAdminAccounts(undefined)).toEqual([]);
    expect(parseAdminAccounts('  ')).toEqual([]);
  });
});

describe('effectiveRole', () => {
  it('raises a declared staff or lecturer account to ADMIN', () => {
    expect(effectiveRole(SubsystemRole.USER, 'staff', false, true)).toBe(SubsystemRole.ADMIN);
    expect(effectiveRole(SubsystemRole.USER, 'lecturer', false, true)).toBe(SubsystemRole.ADMIN);
  });

  it('never raises a student, or a role this system rejects', () => {
    expect(effectiveRole(SubsystemRole.USER, 'student', false, true)).toBe(SubsystemRole.USER);
    expect(effectiveRole(null, 'guest', false, true)).toBeNull();
  });

  it('keeps the technician appointment for staff who are not declared admins', () => {
    expect(effectiveRole(SubsystemRole.USER, 'staff', true)).toBe(SubsystemRole.TECHNICIAN);
    expect(effectiveRole(SubsystemRole.USER, 'staff', false)).toBe(SubsystemRole.USER);
  });
});

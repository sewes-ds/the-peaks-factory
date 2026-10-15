import { describe, expect, it } from 'vitest';

import { decodeSection03ReadModel } from './readModels';
import {
  P4A4_EMPLOYEE_OPERATIONS_RESPONSE,
  P4A4_MACHINE_OPERATIONS_RESPONSE,
} from './fixtures/p4a4ProductionCorrection';
import {
  P4A5_NOTIFICATIONS_ALL_RESPONSE,
  P4A5_NOTIFICATIONS_EMPTY_RESPONSE,
  SECTION03_P4A5_FIXTURES,
} from './fixtures/p4a5Notifications';

describe('complete Section 03 decoded read boundary', () => {
  it('validates and deeply freezes every retained JSON field', () => {
    const input = structuredClone(P4A5_NOTIFICATIONS_ALL_RESPONSE);
    const decoded = decodeSection03ReadModel('notifications', input);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.tasks)).toBe(true);
    expect(Object.isFrozen((decoded.tasks as readonly object[])[0])).toBe(true);
    expect(input).toEqual(P4A5_NOTIFICATIONS_ALL_RESPONSE);
    expect(decodeSection03ReadModel('notifications', P4A5_NOTIFICATIONS_EMPTY_RESPONSE).open_tasks_count).toBe(0);
  });

  it('uses only the strict notification decoder and rejects malformed/count/copy shapes', () => {
    for (const fixture of SECTION03_P4A5_FIXTURES.filter((item) => item.expectProjectionFailure)) {
      expect(() => decodeSection03ReadModel('notifications', fixture.apiResponse), fixture.fixtureId).toThrow();
    }
    expect(() => decodeSection03ReadModel('notifications', {
      section: 'S03', screen: 'S03-NOT01', title: 'Уведомления', tasks: [],
      open_tasks: [], open_tasks_count: 0, available_actions: ['BACK'], extra: true,
    })).toThrow();
  });

  it('fails closed on missing required shapes, wrong screens and malformed action authority', () => {
    expect(() => decodeSection03ReadModel('employees', { section: 'S03', screen: 'S03-E01', title: 'Сотрудники', available_actions: ['BACK'] })).toThrow();
    expect(() => decodeSection03ReadModel('employees', { section: 'S03', screen: 'S03-M01', title: 'Сотрудники', employees: [], available_actions: ['BACK'] })).toThrow('S03-E01');
    expect(() => decodeSection03ReadModel('employees', { section: 'S03', screen: 'S03-E01', title: 'Сотрудники', employees: [], available_actions: [1] })).toThrow();
  });

  it('accepts only the two strict backend-backed production correction shapes', () => {
    const employee = decodeSection03ReadModel('production-completed-operations', P4A4_EMPLOYEE_OPERATIONS_RESPONSE);
    const machine = decodeSection03ReadModel('production-completed-operations', P4A4_MACHINE_OPERATIONS_RESPONSE);
    expect(employee.works).toHaveLength(1);
    expect(machine.operations).toHaveLength(1);
    expect(Object.isFrozen(employee.works)).toBe(true);
    expect(Object.isFrozen(machine.operations)).toBe(true);
    expect(() => decodeSection03ReadModel('production-completed-operations', {
      ...P4A4_MACHINE_OPERATIONS_RESPONSE,
      works: P4A4_EMPLOYEE_OPERATIONS_RESPONSE.works,
    })).toThrow();
  });
});

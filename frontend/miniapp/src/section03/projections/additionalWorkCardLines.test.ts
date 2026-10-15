import { describe, expect, it } from 'vitest';
import { additionalWorkEntityLines } from './additionalWorkCardLines';

describe('Section 03 additional-work detail line contract', () => {
  it('always emits employee and work type as two labeled value blocks', () => {
    const lines = additionalWorkEntityLines({
      idPrefix: 'owner-contract',
      employeeFullName: 'Анна Ким',
      additionalWorkName: 'Проверить комплектность',
    });
    expect(lines).toEqual([
      {
        id: 'owner-contract-employee',
        label: { kind: 'text', text: 'Сотрудник' },
        value: { kind: 'text', text: 'Анна Ким' },
      },
      {
        id: 'owner-contract-type',
        label: { kind: 'text', text: 'Вид работы' },
        value: { kind: 'text', text: 'Проверить комплектность' },
      },
    ]);
    expect(JSON.stringify(lines)).not.toContain('ФИО');
    expect(Object.isFrozen(lines)).toBe(true);
    expect(lines.every(Object.isFrozen)).toBe(true);
  });
});

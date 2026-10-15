import { describe, expect, it } from 'vitest';
import {
  SECTION03_CONTROL_ROLES,
  Section03ControlBindingError,
  resolveSection03ControlBinding,
} from './controlBindings';

describe('Section03 control bindings', () => {
  it('owns the exact stable four-role mapping', () => {
    expect(SECTION03_CONTROL_ROLES).toEqual([
      'open-machines',
      'back',
      'open-operational-downtime-finish',
      'finish-operational-downtime',
    ]);
    const expected = [
      ['navigation-open', 'list-button'],
      ['navigation-back', 'action-button'],
      ['action-warning', 'action-button'],
      ['action-warning', 'action-button'],
    ];
    const resolved = SECTION03_CONTROL_ROLES.map((role) =>
      resolveSection03ControlBinding({ role }));
    expect(resolved.map((value) => [value.controlKey, value.surface]))
      .toEqual(expected);
    expect(resolved.every(Object.isFrozen)).toBe(true);
    expect(resolveSection03ControlBinding({ role: 'back' }))
      .toBe(resolveSection03ControlBinding({ role: 'back' }));
    expect(JSON.stringify(resolved)).not.toMatch(
      /color|variant|icon|endpoint|label/i,
    );
  });

  it('rejects malformed, unknown and extra input', () => {
    for (const input of [
      null,
      { role: 'unknown' },
      { role: 'back', label: 'Назад' },
    ]) {
      expect(() => resolveSection03ControlBinding(input))
        .toThrow(Section03ControlBindingError);
    }
  });
});

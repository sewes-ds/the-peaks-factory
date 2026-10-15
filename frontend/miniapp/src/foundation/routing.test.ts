import { describe, expect, it } from 'vitest';
import type { ScreenId } from './contracts';
import { screenRegistry } from './routing';

describe('screen registry foundation', () => {
  it('contains all currently declared Section 01/02/03 screen IDs used by routing', () => {
    const requiredScreenIds = [
      'S01-N01',
      'S01-N02',
      'S02-N01',
      'S02-N02',
      'S02-AW03A',
      'S02-N26_keyboard',
      'S02-SAL01',
      'S03-N01',
      'S03-M01',
      'S03-E01',
      'S03-AW01',
      'S03-C00',
      'S03-CF20',
      'S03-NOT01',
      'S03-R01',
      'S04-N01'
    ] satisfies ScreenId[];

    expect(Object.keys(screenRegistry)).toEqual(expect.arrayContaining(requiredScreenIds));
    expect(screenRegistry['S02-N01'].name).toBe('shift_not_started_two_buttons');
    expect(screenRegistry['S02-AW03A'].name).toBe('additional_work_action_operator_requested');
    expect(screenRegistry['S03-N01'].section).toBe('section03');
    expect(screenRegistry['S03-M02'].name).toBe('S03 Карточка станка');
    expect(screenRegistry['S03-D01'].name).toBe('S03 Простои');
    expect(screenRegistry['S03-R01'].name).toBe('S03 Отчёты');
    expect(screenRegistry['S04-N01'].section).toBe('section04');
  });
});

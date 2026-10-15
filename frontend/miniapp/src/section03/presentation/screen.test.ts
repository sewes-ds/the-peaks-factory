import { describe, expect, it } from 'vitest';
import {
  Section03ScreenError,
  defineSection03ScreenProjection,
} from './screen';

function item(id: string) {
  return {
    kind: 'state-list-button',
    id,
    stateKey: 'state-info',
    interaction: { kind: 'inert' },
    mainLine: { kind: 'text', text: id },
  };
}

function input() {
  return {
    nodeId: 'S03-M01',
    ariaLabel: 'Станки',
    fixedTopTitle: 'Станки',
    bridgeProjection: {
      nodeId: 'S03-M01',
      items: [item('a'), item('b'), item('c')],
    },
    slots: {
      fixedTop: ['a'],
      scroll: ['b'],
      fixedBottom: ['c'],
    },
  };
}

describe('Section03 temporary screen contract', () => {
  it('preserves slot order and freezes the complete grouping', () => {
    const source = input();
    const screen = defineSection03ScreenProjection(source);
    expect(screen.slots).toEqual(source.slots);
    expect(Object.isFrozen(screen)).toBe(true);
    expect(Object.isFrozen(screen.bridgeProjection)).toBe(true);
    expect(Object.isFrozen(screen.bridgeProjection.items)).toBe(true);
    expect(Object.isFrozen(screen.slots)).toBe(true);
    expect(Object.isFrozen(screen.slots.scroll)).toBe(true);
    expect(JSON.stringify(screen)).not.toMatch(
      /className|style|color|variant/,
    );
    expect(source.slots.scroll).toEqual(['b']);
  });

  it('rejects exact-field, identity and total-assignment violations', () => {
    const cases = [
      { ...input(), style: {} },
      { ...input(), nodeId: 'S03-X' },
      {
        ...input(),
        bridgeProjection: {
          ...input().bridgeProjection,
          nodeId: 'S03-M02',
        },
      },
      { ...input(), slots: { ...input().slots, scroll: ['a'] } },
      { ...input(), slots: { ...input().slots, scroll: ['missing'] } },
      { ...input(), slots: { ...input().slots, scroll: [] } },
      {
        ...input(),
        slots: { ...input().slots, extra: [] },
      },
      {
        ...input(),
        bridgeProjection: {
          nodeId: 'S03-M01',
          items: [item('a'), item('a'), item('c')],
        },
      },
    ];
    for (const value of cases) {
      expect(() => defineSection03ScreenProjection(value))
        .toThrow(Section03ScreenError);
    }
  });
});

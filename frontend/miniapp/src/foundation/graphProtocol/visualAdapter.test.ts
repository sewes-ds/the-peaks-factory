import { describe, expect, it } from 'vitest';

import {
  GraphVisualStateValidationError,
  graphVisualAdapterFor,
} from './visualAdapter';

describe('Graph Protocol visual adapters', () => {
  type CardRendererVariant =
    | 'white'
    | 'lightBlue'
    | 'green'
    | 'yellow'
    | 'red'
    | 'gray';

  const cardAdapters =
    graphVisualAdapterFor<CardRendererVariant>();

  const adapter = cardAdapters.define({
    states: [
      'white',
      'light_blue',
      'green',
      'yellow',
      'red',
      'grey',
    ],
    mapping: {
      white: 'white',
      light_blue: 'lightBlue',
      green: 'green',
      yellow: 'yellow',
      red: 'red',
      grey: 'gray',
    },
  });

  const unsafeDefine = cardAdapters.define as (
    definition: Readonly<{
      states: readonly [string, ...string[]];
      mapping: Readonly<Record<string, string>>;
    }>,
  ) => unknown;

  it('maps every declared semantic state to its typed renderer variant', () => {
    expect(
      adapter.states.map((state) => [
        state,
        adapter.adapt(state),
      ]),
    ).toEqual([
      ['white', 'white'],
      ['light_blue', 'lightBlue'],
      ['green', 'green'],
      ['yellow', 'yellow'],
      ['red', 'red'],
      ['grey', 'gray'],
    ]);

    expect(Object.isFrozen(adapter)).toBe(true);
    expect(Object.isFrozen(adapter.states)).toBe(true);
    expect(Object.isFrozen(adapter.mapping)).toBe(true);
  });

  it('decodes external values before adaptation and has no fallback', () => {
    expect(adapter.decode('light_blue')).toBe('light_blue');
    expect(adapter.fromUnknown('light_blue')).toBe('lightBlue');

    expect(() => adapter.fromUnknown('new_backend_state')).toThrow(
      new GraphVisualStateValidationError(
        'Unknown graph visual state "new_backend_state".',
        'new_backend_state',
      ),
    );

    expect(() => adapter.fromUnknown(null)).toThrow(
      'Unknown graph visual state "null".',
    );
  });

  it('rejects missing or extra mapping keys across an unsafe boundary', () => {
    expect(() =>
      unsafeDefine({
        states: ['green', 'red'],
        mapping: {
          green: 'green',
        },
      }),
    ).toThrow(
      'Missing graph visual mapping for state "red".',
    );

    expect(() =>
      unsafeDefine({
        states: ['green'],
        mapping: {
          green: 'green',
          red: 'red',
        },
      }),
    ).toThrow(
      'Unknown graph visual mapping state "red".',
    );
  });

  it('rejects blank and duplicate source states across an unsafe boundary', () => {
    expect(() =>
      unsafeDefine({
        states: ['   '],
        mapping: {
          '   ': 'green',
        },
      }),
    ).toThrow(
      'Graph visual states must be non-empty strings.',
    );

    expect(() =>
      unsafeDefine({
        states: ['green', 'green'],
        mapping: {
          green: 'green',
        },
      }),
    ).toThrow(
      'Duplicate graph visual state "green".',
    );
  });

  it('rejects an empty source-state list across an unsafe boundary', () => {
    const unsafeEmptyDefine = cardAdapters.define as (
      definition: Readonly<{
        states: readonly string[];
        mapping: Readonly<Record<string, string>>;
      }>,
    ) => unknown;

    expect(() =>
      unsafeEmptyDefine({
        states: [],
        mapping: {},
      }),
    ).toThrow(
      'Graph visual adapter must declare at least one source state.',
    );
  });

  it('rejects blank renderer variant values across an unsafe boundary', () => {
    expect(() =>
      unsafeDefine({
        states: ['green'],
        mapping: {
          green: '   ',
        },
      }),
    ).toThrow(
      'Graph visual mapping for state "green" must name a non-empty renderer variant.',
    );
  });
});

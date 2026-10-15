import { describe, expect, it } from 'vitest';

import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
  graphActionEvent,
  graphActionInstancesFor,
} from './action';

describe('Graph Protocol semantic actions', () => {
  const noEvent = defineGraphActionEvent({});

  const employeeEvent = defineGraphActionEvent({
    employee_id: graphActionEvent.id(),
  });

  const actions = defineGraphActions({
    business: {
      finishEmployeeBreak: graphAction.business(
        'FINISH_BREAK',
        employeeEvent,
        graphAction.actionButton({
          label: 'Завершить перерыв',
          icon: 'finish_break.svg',
          variant: 'yellow',
        }),
      ),
    },
    presentation: {
      back: graphAction.presentation(
        noEvent,
        graphAction.actionButton({
          label: 'Назад',
          icon: 'back.svg',
          variant: 'outlineBlue',
          size: 'fixed55',
        }),
      ),
      selectEmployee: graphAction.presentation(
        employeeEvent,
        graphAction.listButton({
          variant: 'blue',
        }),
      ),
    },
  });

  it('keeps business and presentation actions as distinct protocol classes', () => {
    expect(actions.business.finishEmployeeBreak).toMatchObject({
      class: 'business',
      availableAction: 'FINISH_BREAK',
      eventSchema: employeeEvent,
    });
    expect(actions.presentation.back).toMatchObject({
      class: 'presentation',
      eventSchema: noEvent,
    });
  });

  it('normalizes and seals action-button visual fields in the definition', () => {
    expect(actions.business.finishEmployeeBreak.visual).toEqual({
      kind: 'action-button',
      label: 'Завершить перерыв',
      icon: 'finish_break.svg',
      variant: 'yellow',
      size: 'main70',
      showIcon: true,
    });
    expect(
      Object.isFrozen(actions.business.finishEmployeeBreak.visual),
    ).toBe(true);
  });

  it('creates business instances from the canonical semantic definition', () => {
    const instances = graphActionInstancesFor(actions);
    const instance = instances.business(
      'finishEmployeeBreak',
      {
        instanceId: 'employee-1-break',
        ariaLabel: 'Завершить перерыв сотрудника',
      },
      {
        employee_id: '1',
      },
    );

    expect(instance).toEqual({
      kind: 'business-action',
      actionId: 'finishEmployeeBreak',
      definition: actions.business.finishEmployeeBreak,
      input: {
        instanceId: 'employee-1-break',
        ariaLabel: 'Завершить перерыв сотрудника',
      },
      event: {
        employee_id: '1',
      },
    });
    expect(instance.definition).toBe(
      actions.business.finishEmployeeBreak,
    );
    expect(Object.isFrozen(instance.input)).toBe(true);
    expect(Object.isFrozen(instance.event)).toBe(true);
  });

  it('keeps declared list content dynamic without exposing visual overrides', () => {
    const instances = graphActionInstancesFor(actions);
    const instance = instances.presentation(
      'selectEmployee',
      {
        mainLine: 'Петр Васильевич Садальский',
        secondaryLine: 'Смена открыта',
      },
      {
        employee_id: '1',
      },
    );

    expect(instance.definition.visual).toEqual({
      kind: 'list-button',
      variant: 'blue',
    });
    expect(instance.input).toEqual({
      mainLine: 'Петр Васильевич Садальский',
      secondaryLine: 'Смена открыта',
    });
    expect(instance.event).toEqual({
      employee_id: '1',
    });
  });

  it('rejects an empty action registry across an unsafe boundary', () => {
    const unsafeDefineGraphActions = defineGraphActions as (
      definitions: Readonly<{
        business: Record<string, never>;
        presentation: Record<string, never>;
      }>,
    ) => unknown;

    expect(() =>
      unsafeDefineGraphActions({
        business: {},
        presentation: {},
      }),
    ).toThrow(
      'Graph action registry must contain at least one semantic action.',
    );
  });

  it('rejects blank or cross-class duplicate semantic IDs across unsafe boundaries', () => {
    const businessDefinition = graphAction.business(
      'DOMAIN_ACTION',
      noEvent,
      graphAction.actionButton({
        label: 'Действие',
        icon: 'action.svg',
        variant: 'green',
      }),
    );
    const presentationDefinition = graphAction.presentation(
      noEvent,
      graphAction.actionButton({
        label: 'Переход',
        icon: 'next.svg',
        variant: 'primaryBlue',
      }),
    );

    const unsafeDefineGraphActions = defineGraphActions as (
      definitions: Readonly<{
        business: Record<string, typeof businessDefinition>;
        presentation: Record<string, typeof presentationDefinition>;
      }>,
    ) => unknown;

    expect(() =>
      unsafeDefineGraphActions({
        business: { '   ': businessDefinition },
        presentation: {},
      }),
    ).toThrow('Graph semantic action IDs must be non-empty strings.');

    expect(() =>
      unsafeDefineGraphActions({
        business: { duplicated: businessDefinition },
        presentation: { duplicated: presentationDefinition },
      }),
    ).toThrow(
      'Graph semantic action ID "duplicated" cannot be both business and presentation.',
    );
  });
});

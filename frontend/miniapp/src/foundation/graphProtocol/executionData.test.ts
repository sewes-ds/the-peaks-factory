import { describe, expect, it } from 'vitest';

import {
  GraphActionEventValidationError,
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
  graphActionEvent,
  graphActionInstancesFor,
} from './action';
import {
  GraphCommandValidationError,
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
  graphCommandInput,
} from './command';

describe('Graph Protocol schema-backed execution data', () => {
  const commandInput = defineGraphCommandInput({
    employee_id: graphCommandInput.id(),
    quantity: graphCommandInput.scalarInput((value: unknown) => {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value)
      ) {
        throw new Error('Expected a finite number.');
      }

      return value;
    }),
    period: graphCommandInput.period('today', 'week'),
    mode: graphCommandInput.mode('manual', 'scan'),
  });

  const requestedInputs: unknown[] = [];

  const command = graphCommandFor(commandInput).define({
    command: 'CORRECT_PRODUCTION',
    method: 'POST',
    endpoint: '/operations/production/correct',
    outcomes: ['CORRECTION_RECORDED'],
    entities: defineGraphCommandEntities({
      employee_id: graphCommandEntity.id(),
    }),
    request: async (input) => {
      requestedInputs.push(input);
      return {
        command: 'CORRECT_PRODUCTION',
        outcome: 'CORRECTION_RECORDED',
        entities: {
          employee_id: input.employee_id,
        },
      } as unknown;
    },
  });

  const employeeEvent = defineGraphActionEvent({
    employee_id: graphActionEvent.id(),
    period: graphActionEvent.period('today', 'week'),
    mode: graphActionEvent.mode('view', 'edit'),
  });

  const noEvent = defineGraphActionEvent({});

  const actions = defineGraphActions({
    business: {},
    presentation: {
      selectEmployee: graphAction.presentation(
        employeeEvent,
        graphAction.listButton({
          variant: 'blue',
        }),
      ),
      back: graphAction.presentation(
        noEvent,
        graphAction.actionButton({
          label: 'Назад',
          icon: 'back.svg',
          variant: 'outlineBlue',
        }),
      ),
    },
  });

  it('stores and parses the declared command input schema', () => {
    const input = command.parseInput({
      employee_id: '1',
      quantity: 5,
      period: 'today',
      mode: 'manual',
    });

    expect(command.inputSchema).toEqual(commandInput);
    expect(Object.isFrozen(command.inputSchema)).toBe(true);
    expect(input).toEqual({
      employee_id: '1',
      quantity: 5,
      period: 'today',
      mode: 'manual',
    });
    expect(Object.isFrozen(input)).toBe(true);
  });

  it('validates command input before the declared request is invoked', async () => {
    requestedInputs.length = 0;

    await command.request({
      employee_id: '1',
      quantity: 5,
      period: 'week',
      mode: 'scan',
    });

    expect(requestedInputs).toEqual([
      {
        employee_id: '1',
        quantity: 5,
        period: 'week',
        mode: 'scan',
      },
    ]);
    expect(Object.isFrozen(requestedInputs[0])).toBe(true);

    await expect(
      command.request({
        employee_id: {
          employee_id: '1',
          full_name: 'Snapshot',
        },
        quantity: 5,
        period: 'week',
        mode: 'scan',
      }),
    ).rejects.toThrow(
      'Invalid graph command input field "employee_id": Expected a non-empty string.',
    );

    expect(requestedInputs).toHaveLength(1);
  });

  it('rejects missing, unknown and non-plain command input data', () => {
    expect(() =>
      command.parseInput({
        employee_id: '1',
        quantity: 5,
        period: 'today',
      }),
    ).toThrowError(
      new GraphCommandValidationError(
        'Missing required graph command input field "mode".',
        'mode',
      ),
    );

    expect(() =>
      command.parseInput({
        employee_id: '1',
        quantity: 5,
        period: 'today',
        mode: 'manual',
        employee: {
          employee_id: '1',
        },
      }),
    ).toThrow(
      'Unknown graph command input field "employee".',
    );

    expect(() => command.parseInput(new Date())).toThrow(
      'Graph command input must be a plain object.',
    );
  });

  it('preserves command input category decoder semantics', () => {
    expect(() =>
      command.parseInput({
        employee_id: '1',
        quantity: 5,
        period: 'month',
        mode: 'manual',
      }),
    ).toThrow(
      'Invalid graph command input field "period": Expected one of: today, week.',
    );

    expect(() =>
      command.parseInput({
        employee_id: '1',
        quantity: '5',
        period: 'today',
        mode: 'manual',
      }),
    ).toThrow('Expected a finite number.');
  });

  it('keeps action execution event data separate from visual instance input', () => {
    const instances = graphActionInstancesFor(actions);
    const instance = instances.presentation(
      'selectEmployee',
      {
        instanceId: 'employee-row-1',
        mainLine: 'Петр Васильевич Садальский',
        secondaryLine: 'Смена открыта',
      },
      {
        employee_id: '1',
        period: 'today',
        mode: 'view',
      },
    );

    expect(instance.input).toEqual({
      instanceId: 'employee-row-1',
      mainLine: 'Петр Васильевич Садальский',
      secondaryLine: 'Смена открыта',
    });
    expect(instance.event).toEqual({
      employee_id: '1',
      period: 'today',
      mode: 'view',
    });
    expect(Object.isFrozen(instance.input)).toBe(true);
    expect(Object.isFrozen(instance.event)).toBe(true);
  });

  it('rejects invalid action event data across an unsafe boundary', () => {
    const instances = graphActionInstancesFor(actions);
    const unsafePresentation = instances.presentation as (
      actionId: 'selectEmployee',
      input: Readonly<{
        mainLine: string;
      }>,
      event: unknown,
    ) => unknown;

    expect(() =>
      unsafePresentation(
        'selectEmployee',
        { mainLine: 'Employee' },
        {
          employee_id: {
            employee_id: '1',
            full_name: 'Snapshot',
          },
          period: 'today',
          mode: 'view',
        },
      ),
    ).toThrowError(GraphActionEventValidationError);

    expect(() =>
      unsafePresentation(
        'selectEmployee',
        { mainLine: 'Employee' },
        {
          employee_id: '1',
          period: 'today',
          mode: 'view',
          employee: 'Snapshot',
        },
      ),
    ).toThrow(
      'Unknown graph action event field "employee".',
    );

    expect(() =>
      unsafePresentation(
        'selectEmployee',
        { mainLine: 'Employee' },
        null,
      ),
    ).toThrow(
      'Graph action event must be a plain object.',
    );
  });

  it('validates action event period and mode categories without fallback', () => {
    const instances = graphActionInstancesFor(actions);
    const unsafePresentation = instances.presentation as (
      actionId: 'selectEmployee',
      input: Readonly<{
        mainLine: string;
      }>,
      event: unknown,
    ) => unknown;

    expect(() =>
      unsafePresentation(
        'selectEmployee',
        { mainLine: 'Employee' },
        {
          employee_id: '1',
          period: 'month',
          mode: 'view',
        },
      ),
    ).toThrow(
      'Invalid graph action event field "period": Expected one of: today, week.',
    );

    expect(() =>
      unsafePresentation(
        'selectEmployee',
        { mainLine: 'Employee' },
        {
          employee_id: '1',
          period: 'today',
          mode: 'manage',
        },
      ),
    ).toThrow(
      'Invalid graph action event field "mode": Expected one of: view, edit.',
    );
  });

  it('uses an explicit empty event schema for actions with no execution data', () => {
    const instances = graphActionInstancesFor(actions);

    expect(
      instances.presentation('back', {}, {}).event,
    ).toEqual({});

    const unsafePresentation = instances.presentation as (
      actionId: 'back',
      input: Readonly<Record<string, never>>,
      event: unknown,
    ) => unknown;

    expect(() =>
      unsafePresentation(
        'back',
        {},
        {
          employee_id: '1',
        },
      ),
    ).toThrow(
      'Unknown graph action event field "employee_id".',
    );
  });
});

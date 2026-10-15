import { describe, expect, it } from 'vitest';
import type { OperatorMachineItem } from '../../section02/operatorWorkplace';
import { mutationRefetchPolicies } from '../../foundation/refetchPolicy';
import { S02_ACTION_BINDINGS } from './section02ActionBindings';
import {
  SECTION_02_INITIAL_PIPELINE_STATE,
  SECTION_02_PIPELINE_REGISTRY,
  section02PipelineReducer,
  type Section02PipelineEvent,
  type Section02PipelineState
} from './section02PipelineModel';

const machine: OperatorMachineItem = {
  machine_id: 'machine-1',
  machine_name: 'Machine One'
};

describe('Section 02 pipeline registry', () => {
  it('defines only the scoped pipelines with runtime ownership and semantic effects', () => {
    expect(SECTION_02_PIPELINE_REGISTRY).toEqual({
      SECTION_02_ENTRY: {
        pipelineId: 'SECTION_02_ENTRY',
        owner: 'app',
        effectIds: ['REFETCH_OPERATOR_WORKPLACE']
      },
      START_SHIFT: {
        pipelineId: 'START_SHIFT',
        owner: 'app',
        effectIds: ['MUTATE_START_SHIFT', 'REFETCH_OPERATOR_WORKPLACE']
      },
      START_PRODUCTION: {
        pipelineId: 'START_PRODUCTION',
        owner: 'operator-host',
        effectIds: [
          'LOAD_OPERATOR_MACHINES',
          'LOAD_OPERATOR_SKUS',
          'MUTATE_START_PRODUCTION',
          'REFETCH_OPERATOR_WORKPLACE'
        ]
      },
      FINISH_PRODUCTION: {
        pipelineId: 'FINISH_PRODUCTION',
        owner: 'operator-host',
        effectIds: ['MUTATE_FINISH_PRODUCTION', 'REFETCH_OPERATOR_WORKPLACE']
      },
      START_BREAK: {
        pipelineId: 'START_BREAK',
        owner: 'operator-host',
        effectIds: ['LOAD_OPERATOR_BREAK_TYPES', 'MUTATE_START_BREAK', 'REFETCH_OPERATOR_WORKPLACE']
      },
      FINISH_BREAK: {
        pipelineId: 'FINISH_BREAK',
        owner: 'operator-host',
        effectIds: ['MUTATE_FINISH_BREAK', 'REFETCH_OPERATOR_WORKPLACE']
      },
      START_DOWNTIME: {
        pipelineId: 'START_DOWNTIME',
        owner: 'operator-host',
        effectIds: ['LOAD_AVAILABLE_DOWNTIME_TYPES']
      },
      START_OPERATIONAL_DOWNTIME: {
        pipelineId: 'START_OPERATIONAL_DOWNTIME',
        owner: 'operator-host',
        effectIds: ['MUTATE_START_DOWNTIME', 'REFETCH_OPERATOR_WORKPLACE']
      },
      START_CRITICAL_DOWNTIME_WITH_OPERATION: {
        pipelineId: 'START_CRITICAL_DOWNTIME_WITH_OPERATION',
        owner: 'operator-host',
        effectIds: ['MUTATE_START_DOWNTIME', 'REFETCH_OPERATOR_WORKPLACE_ON_RESULT_BACK']
      },
      START_CRITICAL_DOWNTIME_WITHOUT_OPERATION: {
        pipelineId: 'START_CRITICAL_DOWNTIME_WITHOUT_OPERATION',
        owner: 'operator-host',
        effectIds: [
          'LOAD_CRITICAL_DOWNTIME_MACHINES',
          'MUTATE_START_DOWNTIME',
          'REFETCH_OPERATOR_WORKPLACE_ON_RESULT_BACK'
        ]
      },
      FINISH_DOWNTIME: {
        pipelineId: 'FINISH_DOWNTIME',
        owner: 'operator-host',
        effectIds: ['MUTATE_FINISH_DOWNTIME', 'REFETCH_OPERATOR_WORKPLACE']
      },
      OPEN_ADDITIONAL_WORK: {
        pipelineId: 'OPEN_ADDITIONAL_WORK',
        owner: 'operator-host',
        effectIds: ['REFETCH_OPERATOR_ADDITIONAL_WORK', 'REFETCH_OPERATOR_WORKPLACE']
      },
      REQUEST_ADDITIONAL_WORK: {
        pipelineId: 'REQUEST_ADDITIONAL_WORK',
        owner: 'operator-host',
        effectIds: [
          'LOAD_AVAILABLE_ADDITIONAL_WORK_TYPES',
          'MUTATE_REQUEST_ADDITIONAL_WORK',
          'REFETCH_ADDITIONAL_WORK_AND_WORKPLACE'
        ]
      },
      START_ADDITIONAL_WORK: {
        pipelineId: 'START_ADDITIONAL_WORK',
        owner: 'operator-host',
        effectIds: ['MUTATE_START_ADDITIONAL_WORK', 'REFETCH_ADDITIONAL_WORK_AND_WORKPLACE']
      },
      FINISH_ADDITIONAL_WORK: {
        pipelineId: 'FINISH_ADDITIONAL_WORK',
        owner: 'operator-host',
        effectIds: [
          'MUTATE_FINISH_ADDITIONAL_WORK',
          'REFETCH_ADDITIONAL_WORK_AND_WORKPLACE_ON_RESULT_BACK'
        ]
      }
    });

    expect(JSON.stringify(SECTION_02_PIPELINE_REGISTRY)).not.toContain('/operator');
    expect(JSON.stringify(SECTION_02_PIPELINE_REGISTRY)).not.toContain('/production');
    expect(JSON.stringify(SECTION_02_PIPELINE_REGISTRY)).not.toContain('/shifts');
  });

  it('binds D2 actions and refetch policies to the accepted endpoints and order', () => {
    expect(S02_ACTION_BINDINGS.additional_work).toMatchObject({
      kind: 'readModel',
      method: 'GET',
      endpoint: '/operator/additional-work-state',
      refetch: ['operator_additional_work_state', 'operator_workplace_state'],
      successTransition: 'S02-N11'
    });
    expect(S02_ACTION_BINDINGS.request_additional_work).toMatchObject({
      kind: 'mutation',
      method: 'POST',
      endpoint: '/additional-works/request',
      bodyContract: '{ additional_work_type_id }',
      refetch: ['operator_additional_work_state', 'operator_workplace_state']
    });
    expect(S02_ACTION_BINDINGS.start_additional_work).toMatchObject({
      endpoint: '/additional-works/:additional_work_id/start',
      bodyContract: '{}',
      refetch: ['operator_additional_work_state', 'operator_workplace_state']
    });
    expect(S02_ACTION_BINDINGS.finish_additional_work).toMatchObject({
      endpoint: '/additional-works/:additional_work_id/finish',
      bodyContract: '{}',
      successTransition: 'S02-AW05; refetch on ordinary Back'
    });

    expect(
      mutationRefetchPolicies.filter((policy) => policy.mutation.startsWith('POST /additional-works'))
    ).toEqual([
      {
        mutation: 'POST /additional-works/request',
        refetch: ['operator_additional_work_state', 'operator_workplace_state']
      },
      {
        mutation: 'POST /additional-works/:additional_work_id/start',
        refetch: ['operator_additional_work_state', 'operator_workplace_state']
      },
      {
        mutation: 'POST /additional-works/:additional_work_id/finish',
        refetch: ['operator_additional_work_state', 'operator_workplace_state']
      }
    ]);
  });
});

describe('Section 02 operator pipeline reducer', () => {
  it.each<{
    name: string;
    state: Section02PipelineState;
    event: Section02PipelineEvent;
    expected: Section02PipelineState;
  }>([
    {
      name: 'opens machine entry from the workplace',
      state: { kind: 'workplace' },
      event: { type: 'OPEN_START_PRODUCTION' },
      expected: { kind: 'machine-entry' }
    },
    {
      name: 'opens the loaded machine list',
      state: { kind: 'machine-entry' },
      event: { type: 'MACHINES_LOADED' },
      expected: { kind: 'machine-list' }
    },
    {
      name: 'opens the loaded SKU list for the selected machine',
      state: { kind: 'machine-list' },
      event: { type: 'MACHINE_SELECTED', machine },
      expected: { kind: 'sku-list', machine }
    },
    {
      name: 'returns to the workplace after production starts',
      state: { kind: 'sku-list', machine },
      event: { type: 'PRODUCTION_STARTED' },
      expected: { kind: 'workplace' }
    },
    {
      name: 'returns to the workplace after production finishes',
      state: { kind: 'quantity-entry', productionOperationId: 'production-1' },
      event: { type: 'PRODUCTION_FINISHED' },
      expected: { kind: 'workplace' }
    },
    {
      name: 'opens the loaded break type list',
      state: { kind: 'workplace' },
      event: { type: 'BREAK_TYPES_LOADED' },
      expected: { kind: 'break-type-list' }
    },
    {
      name: 'returns to the workplace after a break starts',
      state: { kind: 'break-type-list' },
      event: { type: 'BREAK_STARTED' },
      expected: { kind: 'workplace' }
    },
    {
      name: 'opens finish-break confirmation',
      state: { kind: 'workplace' },
      event: { type: 'OPEN_FINISH_BREAK' },
      expected: { kind: 'confirm-finish-break' }
    },
    {
      name: 'returns to the workplace after a break finishes',
      state: { kind: 'confirm-finish-break' },
      event: { type: 'BREAK_FINISHED' },
      expected: { kind: 'workplace' }
    }
  ])('$name', ({ state, event, expected }) => {
    expect(section02PipelineReducer(state, event)).toEqual(expected);
  });

  it.each<{
    name: string;
    state: Section02PipelineState;
    expected: Section02PipelineState;
  }>([
    {
      name: 'machine entry to workplace',
      state: { kind: 'machine-entry' },
      expected: { kind: 'workplace' }
    },
    {
      name: 'machine list to machine entry',
      state: { kind: 'machine-list' },
      expected: { kind: 'machine-entry' }
    },
    {
      name: 'SKU list to machine list',
      state: { kind: 'sku-list', machine },
      expected: { kind: 'machine-list' }
    },
    {
      name: 'quantity entry to workplace',
      state: { kind: 'quantity-entry', productionOperationId: 'production-1' },
      expected: { kind: 'workplace' }
    },
    {
      name: 'break type list to workplace',
      state: { kind: 'break-type-list' },
      expected: { kind: 'workplace' }
    },
    {
      name: 'finish-break confirmation to workplace',
      state: { kind: 'confirm-finish-break' },
      expected: { kind: 'workplace' }
    }
  ])('preserves the Back edge: $name', ({ state, expected }) => {
    expect(section02PipelineReducer(state, { type: 'BACK' })).toEqual(expected);
  });

  it('handles missing, blocked, and ready finish-production entry states', () => {
    const missing = section02PipelineReducer({ kind: 'workplace' }, { type: 'OPEN_FINISH_PRODUCTION' });
    expect(missing).toEqual({
      kind: 'message',
      title: 'Производство не найдено',
      message: 'Система не вернула активную производственную операцию. Обновите рабочее место и повторите действие.',
      backTo: { kind: 'workplace' }
    });

    const blocked = section02PipelineReducer(
      { kind: 'workplace' },
      {
        type: 'OPEN_FINISH_PRODUCTION',
        productionOperationId: 'production-1',
        canFinishProduction: false
      }
    );
    expect(blocked).toEqual({
      kind: 'message',
      title: 'Завершение недоступно',
      message:
        'Система сейчас не разрешает завершить производство. Проверьте активный простой или другое блокирующее состояние.',
      backTo: { kind: 'workplace' }
    });

    const ready = section02PipelineReducer(
      { kind: 'workplace' },
      {
        type: 'OPEN_FINISH_PRODUCTION',
        productionOperationId: 'production-1',
        canFinishProduction: true,
        machineName: 'Machine One',
        skuCode: 'SKU-1',
        skuName: 'Product One'
      }
    );
    expect(ready).toEqual({
      kind: 'quantity-entry',
      productionOperationId: 'production-1',
      machineName: 'Machine One',
      skuCode: 'SKU-1',
      skuName: 'Product One'
    });
  });

  it('preserves the QR placeholder message and Back edge', () => {
    const message = section02PipelineReducer({ kind: 'machine-entry' }, { type: 'OPEN_QR_PLACEHOLDER' });
    expect(message).toEqual({
      kind: 'message',
      title: 'QR-сканирование',
      message: 'QR-сканирование будет подключено отдельным pipeline. Сейчас выберите станок из списка.',
      backTo: { kind: 'machine-entry' }
    });
    expect(section02PipelineReducer(message, { type: 'BACK' })).toEqual({ kind: 'machine-entry' });
  });

  it('preserves the finish-production error return and quantity reset boundary', () => {
    const quantityState: Section02PipelineState = {
      kind: 'quantity-entry',
      productionOperationId: 'production-1',
      machineName: 'Old Machine'
    };
    const message = section02PipelineReducer(quantityState, {
      type: 'FINISH_PRODUCTION_REJECTED',
      machineName: 'Current Machine',
      skuCode: 'SKU-1',
      skuName: 'Product One'
    });

    expect(message).toEqual({
      kind: 'message',
      title: 'Количество не принято',
      message:
        'Backend не принял введённое количество. Проверьте значение и повторите ввод. Если ошибка повторится, нужен отчёт backend.',
      backTo: {
        kind: 'quantity-entry',
        productionOperationId: 'production-1',
        machineName: 'Current Machine',
        skuCode: 'SKU-1',
        skuName: 'Product One'
      }
    });

    expect(message.kind).toBe('message');
    if (message.kind !== 'message') {
      throw new Error('Expected finish-production rejection message');
    }

    const returned = section02PipelineReducer(message, { type: 'BACK' });
    expect(returned).toEqual(message.backTo);
    expect(returned).not.toBe(quantityState);
  });

  it('models the exact critical downtime N09/N26/N27/N28 transitions and Back edges', () => {
    const downtimeType = {
      downtime_type_id: 'downtime-type-1',
      display_name: 'Поломка',
      downtime_class: 'CRITICAL' as const,
      ui_color_token: 'scarlet' as const,
      requires_production_operation: false,
      requires_comment: true
    };
    const context = {
      downtimeType,
      machine,
      productionOperationId: null,
      returnTo: 'downtime-machine-list' as const
    };

    const loading = section02PipelineReducer({ kind: 'workplace' }, { type: 'OPEN_START_DOWNTIME' });
    expect(loading).toEqual({ kind: 'downtime-type-list', status: 'loading' });
    const ready = section02PipelineReducer(loading, { type: 'DOWNTIME_TYPES_LOADED', hasItems: true });
    expect(ready).toEqual({ kind: 'downtime-type-list', status: 'ready' });
    const machineLoading = section02PipelineReducer(ready, {
      type: 'OPEN_CRITICAL_DOWNTIME_WITHOUT_OPERATION',
      downtimeType
    });
    expect(machineLoading).toEqual({ kind: 'downtime-machine-list', status: 'loading', downtimeType });
    const machineReady = section02PipelineReducer(machineLoading, {
      type: 'DOWNTIME_MACHINES_LOADED',
      hasItems: true
    });
    const comment = section02PipelineReducer(machineReady, {
      type: 'DOWNTIME_MACHINE_SELECTED',
      context
    });
    expect(comment).toEqual({ kind: 'downtime-comment', context, comment: '' });
    expect(section02PipelineReducer(comment, { type: 'DOWNTIME_COMMENT_ENTERED', comment: '   ' })).toBe(comment);

    const confirm = section02PipelineReducer(comment, {
      type: 'DOWNTIME_COMMENT_ENTERED',
      comment: '  Электрика  '
    });
    expect(confirm).toEqual({ kind: 'downtime-confirm', context, comment: '  Электрика  ' });
    expect(section02PipelineReducer(confirm, { type: 'BACK' })).toEqual({
      kind: 'downtime-comment',
      context,
      comment: '  Электрика  '
    });
    expect(
      section02PipelineReducer(confirm, { type: 'CRITICAL_DOWNTIME_STARTED', machineName: 'Machine One' })
    ).toEqual({ kind: 'downtime-result', machineName: 'Machine One' });
  });

  it('models operational/finish downtime returns and protects N28 from synchronous Back', () => {
    expect(
      section02PipelineReducer(
        { kind: 'downtime-type-list', status: 'ready' },
        { type: 'OPERATIONAL_DOWNTIME_STARTED' }
      )
    ).toEqual({ kind: 'workplace' });

    const finish = section02PipelineReducer(
      { kind: 'workplace' },
      {
        type: 'OPEN_FINISH_DOWNTIME',
        downtimeId: 'downtime-1',
        downtimeTypeName: 'Наладка',
        downtimeClass: 'OPERATIONAL'
      }
    );
    expect(finish).toEqual({
      kind: 'confirm-finish-downtime',
      downtimeId: 'downtime-1',
      downtimeTypeName: 'Наладка',
      downtimeClass: 'OPERATIONAL'
    });
    expect(section02PipelineReducer(finish, { type: 'DOWNTIME_FINISHED' })).toEqual({ kind: 'workplace' });

    const result: Section02PipelineState = { kind: 'downtime-result', machineName: 'Machine One' };
    expect(section02PipelineReducer(result, { type: 'BACK' })).toBe(result);
    expect(section02PipelineReducer(result, { type: 'DOWNTIME_RESULT_CLOSED' })).toEqual({ kind: 'workplace' });
  });

  it('keeps D1 errors attached to the current downtime step for Back recovery', () => {
    const current: Section02PipelineState = { kind: 'downtime-type-list', status: 'ready' };
    const message = section02PipelineReducer(current, { type: 'SHOW_DOWNTIME_ERROR' });
    expect(message).toEqual({
      kind: 'message',
      title: 'Сервис временно недоступен',
      message: 'Не удалось подтвердить результат. Перед повтором обновите данные.',
      backTo: current,
      retry: true
    });
    expect(section02PipelineReducer(message, { type: 'BACK' })).toBe(current);
  });

  it('models N11 and AW01-AW05 transitions without retired screens or cancel states', () => {
    const additionalWorkType = {
      additional_work_type_id: 'type-1',
      display_name: 'Помощь складу'
    };
    const approvedAdditionalWork = {
      additional_work_id: 'approved-1',
      additional_work_type_id: 'type-1',
      display_name: 'Помощь складу',
      origin: 'OPERATOR_REQUEST_APPROVED' as const,
      ui_group: 'APPROVED' as const,
      ui_color_token: 'gray_green' as const,
      action: 'START_ADDITIONAL_WORK' as const
    };
    const activeAdditionalWork = {
      additional_work_id: 'active-1',
      additional_work_type_id: 'type-2',
      display_name: 'Инвентаризация',
      ui_group: 'ACTIVE' as const,
      ui_color_token: 'green' as const,
      action: 'FINISH_ADDITIONAL_WORK' as const
    };

    const menuLoading = section02PipelineReducer({ kind: 'workplace' }, { type: 'OPEN_ADDITIONAL_WORK' });
    expect(menuLoading).toEqual({ kind: 'additional-work-menu', status: 'loading' });
    const menuReady = section02PipelineReducer(menuLoading, { type: 'ADDITIONAL_WORK_MENU_LOADED' });
    expect(menuReady).toEqual({ kind: 'additional-work-menu', status: 'ready' });

    const typesLoading = section02PipelineReducer(menuReady, { type: 'OPEN_REQUEST_ADDITIONAL_WORK' });
    const typesReady = section02PipelineReducer(typesLoading, {
      type: 'ADDITIONAL_WORK_TYPES_LOADED',
      hasItems: true
    });
    const requestConfirm = section02PipelineReducer(typesReady, {
      type: 'ADDITIONAL_WORK_TYPE_SELECTED',
      additionalWorkType
    });
    expect(requestConfirm).toEqual({
      kind: 'additional-work-request-confirm',
      additionalWorkType
    });
    expect(section02PipelineReducer(requestConfirm, { type: 'ADDITIONAL_WORK_REQUESTED' })).toEqual({
      kind: 'additional-work-menu',
      status: 'ready'
    });

    const startConfirm = section02PipelineReducer(menuReady, {
      type: 'ADDITIONAL_WORK_APPROVED_SELECTED',
      additionalWork: approvedAdditionalWork
    });
    expect(startConfirm).toEqual({
      kind: 'additional-work-start-confirm',
      additionalWork: approvedAdditionalWork
    });
    expect(section02PipelineReducer(startConfirm, { type: 'ADDITIONAL_WORK_STARTED' })).toEqual({
      kind: 'additional-work-menu',
      status: 'ready'
    });

    const finishConfirm = section02PipelineReducer(menuReady, {
      type: 'ADDITIONAL_WORK_ACTIVE_SELECTED',
      additionalWork: activeAdditionalWork
    });
    const result = section02PipelineReducer(finishConfirm, { type: 'ADDITIONAL_WORK_FINISHED' });
    expect(result).toEqual({
      kind: 'additional-work-result',
      additionalWork: activeAdditionalWork
    });
    expect(section02PipelineReducer(result, { type: 'BACK' })).toBe(result);
    expect(section02PipelineReducer(result, { type: 'ADDITIONAL_WORK_RESULT_CLOSED' })).toEqual({
      kind: 'additional-work-menu',
      status: 'ready'
    });
    expect(JSON.stringify([menuReady, typesReady, requestConfirm, startConfirm, finishConfirm, result])).not.toMatch(
      /S02-N1[2-5]|cancel/i
    );
  });

  it('preserves additional-work Back edges and validation context', () => {
    const type = { additional_work_type_id: 'type-1', display_name: 'Packing' };
    const requestConfirm: Section02PipelineState = {
      kind: 'additional-work-request-confirm',
      additionalWorkType: type
    };
    expect(section02PipelineReducer(requestConfirm, { type: 'BACK' })).toEqual({
      kind: 'additional-work-type-list',
      status: 'ready'
    });

    const validation = section02PipelineReducer(requestConfirm, {
      type: 'SHOW_ADDITIONAL_WORK_VALIDATION_ERROR',
      message: 'Тип недоступен'
    });
    expect(validation).toEqual({
      kind: 'message',
      title: 'Проверьте данные',
      message: 'Тип недоступен',
      backTo: requestConfirm
    });
    expect(section02PipelineReducer(validation, { type: 'BACK' })).toBe(requestConfirm);
  });

  it('preserves critical confirmation context when authoritative refresh fails', () => {
    const downtimeType = {
      downtime_type_id: 'downtime-type-1',
      display_name: 'Поломка',
      downtime_class: 'CRITICAL' as const,
      ui_color_token: 'scarlet' as const,
      requires_production_operation: false,
      requires_comment: true
    };
    const current: Section02PipelineState = {
      kind: 'downtime-confirm',
      context: {
        downtimeType,
        machine: { machine_id: 'machine-1', machine_name: 'Machine One' },
        productionOperationId: 'production-1',
        returnTo: 'downtime-type-list'
      },
      comment: 'Сломался привод'
    };

    const message = section02PipelineReducer(current, { type: 'SHOW_DOWNTIME_ERROR' });
    expect(message.kind).toBe('message');
    expect(section02PipelineReducer(message, { type: 'BACK' })).toBe(current);
  });

  it.each([
    { kind: 'machine-entry' },
    { kind: 'machine-list' },
    { kind: 'sku-list', machine },
    { kind: 'workplace' },
    { kind: 'quantity-entry', productionOperationId: 'production-1' },
    { kind: 'break-type-list' },
    { kind: 'confirm-finish-break' },
    { kind: 'downtime-type-list', status: 'ready' },
    {
      kind: 'downtime-machine-list',
      status: 'empty',
      downtimeType: {
        downtime_type_id: 'downtime-type-1',
        display_name: 'Поломка',
        downtime_class: 'CRITICAL',
        ui_color_token: 'scarlet',
        requires_production_operation: false,
        requires_comment: true
      }
    },
    { kind: 'downtime-result', machineName: 'Machine One' },
    {
      kind: 'message',
      title: 'Existing message',
      message: 'Existing body',
      backTo: { kind: 'machine-entry' }
    }
  ] satisfies Section02PipelineState[])('shows the existing fatal error message from $kind', (state) => {
    expect(section02PipelineReducer(state, { type: 'SHOW_FATAL_ERROR' })).toEqual({
      kind: 'message',
      title: 'Сервис временно недоступен',
      message: 'Не удалось выполнить действие. Повторите позже.',
      backTo: { kind: 'workplace' }
    });
  });

  it.each<{
    name: string;
    state: Section02PipelineState;
    event: Section02PipelineEvent;
    expected: Section02PipelineState;
  }>([
    {
      name: 'late break types replace machine entry',
      state: { kind: 'machine-entry' },
      event: { type: 'BREAK_TYPES_LOADED' },
      expected: { kind: 'break-type-list' }
    },
    {
      name: 'late machines replace break selection',
      state: { kind: 'break-type-list' },
      event: { type: 'MACHINES_LOADED' },
      expected: { kind: 'machine-list' }
    },
    {
      name: 'late SKU load replaces quantity entry',
      state: { kind: 'quantity-entry', productionOperationId: 'production-1' },
      event: { type: 'MACHINE_SELECTED', machine },
      expected: { kind: 'sku-list', machine }
    },
    {
      name: 'late production start returns from finish-break confirmation',
      state: { kind: 'confirm-finish-break' },
      event: { type: 'PRODUCTION_STARTED' },
      expected: { kind: 'workplace' }
    },
    {
      name: 'late production finish returns from machine entry',
      state: { kind: 'machine-entry' },
      event: { type: 'PRODUCTION_FINISHED' },
      expected: { kind: 'workplace' }
    },
    {
      name: 'late break start returns from machine list',
      state: { kind: 'machine-list' },
      event: { type: 'BREAK_STARTED' },
      expected: { kind: 'workplace' }
    },
    {
      name: 'late break finish returns from SKU list',
      state: { kind: 'sku-list', machine },
      event: { type: 'BREAK_FINISHED' },
      expected: { kind: 'workplace' }
    }
  ])('preserves unconditional async completion: $name', ({ state, event, expected }) => {
    expect(section02PipelineReducer(state, event)).toEqual(expected);
  });

  it.each<{
    state: Section02PipelineState;
    event: Section02PipelineEvent;
  }>([
    { state: SECTION_02_INITIAL_PIPELINE_STATE, event: { type: 'BACK' } },
    { state: { kind: 'machine-entry' }, event: { type: 'OPEN_FINISH_BREAK' } },
    { state: { kind: 'machine-list' }, event: { type: 'OPEN_QR_PLACEHOLDER' } },
    { state: { kind: 'sku-list', machine }, event: { type: 'OPEN_START_PRODUCTION' } },
    {
      state: { kind: 'quantity-entry', productionOperationId: 'production-1' },
      event: { type: 'OPEN_FINISH_BREAK' }
    },
    {
      state: { kind: 'break-type-list' },
      event: { type: 'OPEN_START_PRODUCTION' }
    },
    {
      state: { kind: 'confirm-finish-break' },
      event: { type: 'OPEN_START_PRODUCTION' }
    },
    {
      state: {
        kind: 'message',
        title: 'Message',
        message: 'Body',
        backTo: { kind: 'workplace' }
      },
      event: { type: 'OPEN_START_PRODUCTION' }
    }
  ])('returns the identical state object for an invalid event/state combination', ({ state, event }) => {
    expect(section02PipelineReducer(state, event)).toBe(state);
  });
});

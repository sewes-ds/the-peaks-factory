import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, type ApiClient } from '../../foundation/apiClient';
import type {
  ActiveAdditionalWorkItem,
  ApprovedAdditionalWorkItem,
  OperatorAvailableDowntimeTypeItem,
  OperatorAdditionalWorkStateResponse,
  OperatorBreakTypeItem,
  OperatorMachineItem,
  OperatorSkuItem,
  OperatorWorkplaceStateResponse
} from '../../section02/operatorWorkplace';

const operatorWorkplaceMocks = vi.hoisted(() => ({
  finishOperatorAdditionalWork: vi.fn(),
  finishOperatorBreak: vi.fn(),
  finishOperatorShift: vi.fn(),
  startOperatorShift: vi.fn(),
  finishOperatorDowntime: vi.fn(),
  finishProductionOperation: vi.fn(),
  getOperatorAdditionalWorkState: vi.fn(),
  getOperatorAdditionalWorkTypesAvailable: vi.fn(),
  getOperatorAvailableDowntimeTypes: vi.fn(),
  getOperatorBreakTypes: vi.fn(),
  getOperatorCriticalDowntimeMachines: vi.fn(),
  getOperatorMachines: vi.fn(),
  getOperatorSkus: vi.fn(),
  getOperatorWorkplaceState: vi.fn(),
  orderOperatorAvailableDowntimeTypes: vi.fn((items) => [
    ...items.filter((item: { downtime_class: string }) => item.downtime_class === 'OPERATIONAL'),
    ...items.filter((item: { downtime_class: string }) => item.downtime_class === 'CRITICAL')
  ]),
  requestOperatorAdditionalWork: vi.fn(),
  startOperatorAdditionalWork: vi.fn(),
  startOperatorBreak: vi.fn(),
  startOperatorDowntime: vi.fn(),
  startProductionOperation: vi.fn()
}));

vi.mock('../../section02/operatorWorkplace', () => operatorWorkplaceMocks);

import { Section02OperatorPipelineHost } from './Section02OperatorPipelineHost';

const inactiveWorkplace: OperatorWorkplaceStateResponse = {
  shift: { is_active: true },
  available_pipelines: ['START_DOWNTIME'],
  downtime: { can_start_downtime: true }
};

const activeProductionWorkplace: OperatorWorkplaceStateResponse = {
  shift: { is_active: true },
  available_pipelines: ['START_DOWNTIME'],
  downtime: { can_start_downtime: true },
  production: {
    is_active: true,
    production_operation_id: 'production-1',
    machine_id: 'machine-1',
    machine_name: 'Machine One',
    sku_code: 'SKU-1',
    sku_name: 'Product One',
    can_finish_production: true
  }
};

const operationalDowntimeWorkplace: OperatorWorkplaceStateResponse = {
  shift: { is_active: true },
  downtime: {
    slot_state: 'OPERATIONAL_ACTIVE',
    downtime_id: 'downtime-1',
    downtime_type_name: 'Наладка',
    downtime_class: 'OPERATIONAL',
    can_finish_downtime: true
  }
};

const criticalDowntimeWorkplace: OperatorWorkplaceStateResponse = {
  shift: { is_active: true },
  downtime: {
    slot_state: 'CRITICAL_ACTIVE',
    downtime_id: 'downtime-2',
    downtime_type_name: 'Поломка',
    downtime_class: 'CRITICAL',
    can_finish_downtime: true
  }
};

const activeBreakWorkplace: OperatorWorkplaceStateResponse = {
  shift: { is_active: true },
  break: {
    is_active: true,
    operator_break_id: 'break-1',
    break_type_name: 'Coffee break',
    can_finish_break: true
  }
};

const machine: OperatorMachineItem = {
  machine_id: 'machine-1',
  machine_name: 'Machine One',
  is_selectable_for_critical_downtime: true
};

const blockedCriticalMachine: OperatorMachineItem = {
  machine_id: 'machine-2',
  machine_name: 'Machine Two',
  is_selectable_for_critical_downtime: false
};

const sku: OperatorSkuItem = {
  sku_id: 'sku-1',
  sku_code: 'SKU-1',
  sku_name: 'Product One'
};

const breakType: OperatorBreakTypeItem = {
  break_type_id: 'break-type-1',
  display_name: 'Coffee break'
};

const operationalDowntimeType: OperatorAvailableDowntimeTypeItem = {
  downtime_type_id: 'downtime-type-operational',
  display_name: 'Наладка',
  downtime_class: 'OPERATIONAL',
  ui_color_token: 'yellow',
  requires_production_operation: true,
  requires_comment: false
};

const criticalDowntimeType: OperatorAvailableDowntimeTypeItem = {
  downtime_type_id: 'downtime-type-critical',
  display_name: 'Поломка',
  downtime_class: 'CRITICAL',
  ui_color_token: 'scarlet',
  requires_production_operation: false,
  requires_comment: true
};

const additionalWorkEntryWorkplace: OperatorWorkplaceStateResponse = {
  shift: { is_active: true },
  available_pipelines: ['OPEN_ADDITIONAL_WORK']
};

const additionalWorkMenuWorkplace: OperatorWorkplaceStateResponse = {
  shift: { is_active: true },
  available_pipelines: ['OPEN_ADDITIONAL_WORK', 'REQUEST_ADDITIONAL_WORK']
};

const activeAdditionalWork: ActiveAdditionalWorkItem = {
  additional_work_id: 'active-work-1',
  additional_work_type_id: 'type-active',
  display_name: 'Инвентаризация склада',
  ui_group: 'ACTIVE',
  ui_color_token: 'green',
  action: 'FINISH_ADDITIONAL_WORK'
};

const operatorApprovedAdditionalWork: ApprovedAdditionalWorkItem = {
  additional_work_id: 'approved-operator-1',
  additional_work_type_id: 'type-approved-operator',
  display_name: 'Помощь упаковке',
  origin: 'OPERATOR_REQUEST_APPROVED',
  ui_group: 'APPROVED',
  ui_color_token: 'gray_green',
  action: 'START_ADDITIONAL_WORK'
};

const managerAssignedAdditionalWork: ApprovedAdditionalWorkItem = {
  additional_work_id: 'approved-manager-1',
  additional_work_type_id: 'type-approved-manager',
  display_name: 'Пересчёт материалов',
  origin: 'MANAGER_ASSIGNED',
  ui_group: 'APPROVED',
  ui_color_token: 'gray_green',
  action: 'START_ADDITIONAL_WORK'
};

const additionalWorkState: OperatorAdditionalWorkStateResponse = {
  actor_employee_id: 'employee-1',
  active_additional_works: [activeAdditionalWork],
  approved_additional_works: [operatorApprovedAdditionalWork, managerAssignedAdditionalWork],
  pending_approval_additional_works: [
    {
      additional_work_id: 'pending-work-1',
      additional_work_type_id: 'type-pending',
      display_name: 'Ожидающая заявка',
      ui_group: 'PENDING_APPROVAL',
      ui_color_token: 'white_gray_inactive',
      action: null
    }
  ]
};

let mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => {
    for (const { root } of mountedRoots) {
      root.unmount();
    }
  });

  for (const { container } of mountedRoots) {
    container.remove();
  }

  mountedRoots = [];
  vi.restoreAllMocks();
});

describe('Section02OperatorPipelineHost behavior', () => {
  it('runs the start-production list path in effect order and returns to the workplace monitor', async () => {
    const effects: string[] = [];
    operatorWorkplaceMocks.getOperatorMachines.mockImplementation(async () => {
      effects.push('machines');
      return [machine];
    });
    operatorWorkplaceMocks.getOperatorSkus.mockImplementation(async () => {
      effects.push('skus');
      return [sku];
    });
    operatorWorkplaceMocks.startProductionOperation.mockImplementation(async () => {
      effects.push('start-production');
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockImplementation(async () => {
      effects.push('workplace-refetch');
      return activeProductionWorkplace;
    });

    const container = await renderHost(inactiveWorkplace);
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');
    expectActionLabel(container, 'start_production', 'Начать производство');

    await clickAction(container, 'start_production');
    expectNode(container, 'START_PRODUCTION_SELECT_MACHINE_ENTRY');
    expectActionLabel(container, 'scan_machine_qr', 'Сканировать QR станка');
    expectActionLabel(container, 'select_machine_from_list', 'Выбрать станок из списка');

    await clickAction(container, 'select_machine_from_list');
    expectNode(container, 'START_PRODUCTION_SELECT_MACHINE_LIST');
    await clickButton(container, 'Machine One');

    expectNode(container, 'START_PRODUCTION_SELECT_SKU_LIST');
    await clickButton(container, 'SKU-1 Product One');

    expect(effects).toEqual(['machines', 'skus', 'start-production', 'workplace-refetch']);
    expect(operatorWorkplaceMocks.startProductionOperation).toHaveBeenCalledWith(expect.anything(), 'machine-1', 'sku-1');
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');
    expectActionLabel(container, 'finish_production', 'Завершить производство');
  });

  it('finishes production with normalized quantity, then refetches and returns to the monitor', async () => {
    const effects: string[] = [];
    operatorWorkplaceMocks.finishProductionOperation.mockImplementation(async () => {
      effects.push('finish-production');
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockImplementation(async () => {
      effects.push('workplace-refetch');
      return inactiveWorkplace;
    });

    const container = await renderHost(activeProductionWorkplace);
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');
    expectActionLabel(container, 'finish_production', 'Завершить производство');

    await clickAction(container, 'finish_production');
    expectNode(container, 'FINISH_PRODUCTION_ENTER_QUANTITY');
    expect(container.textContent).toContain('Введите количество сделанной продукции.');

    await clickButton(container, '1');
    await clickButton(container, ',');
    await clickButton(container, '5');
    await clickAction(container, 'finish_production');

    expect(effects).toEqual(['finish-production', 'workplace-refetch']);
    expect(operatorWorkplaceMocks.finishProductionOperation).toHaveBeenCalledWith(
      expect.anything(),
      'production-1',
      '1.5'
    );
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');
    expectActionLabel(container, 'start_production', 'Начать производство');
  });

  it('starts a break after reading types, then mutates, refetches, and returns to the monitor', async () => {
    const effects: string[] = [];
    operatorWorkplaceMocks.getOperatorBreakTypes.mockImplementation(async () => {
      effects.push('break-types');
      return [breakType];
    });
    operatorWorkplaceMocks.startOperatorBreak.mockImplementation(async () => {
      effects.push('start-break');
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockImplementation(async () => {
      effects.push('workplace-refetch');
      return activeBreakWorkplace;
    });

    const container = await renderHost(inactiveWorkplace);
    expectActionLabel(container, 'start_break', 'Начать перерыв');
    await clickAction(container, 'start_break');

    expectNode(container, 'BREAK_SELECT_TYPE');
    expect(container.textContent).toContain('Выберите тип перерыва.');
    await clickAction(container, 'start_break', 'Начать Coffee break');

    expect(effects).toEqual(['break-types', 'start-break', 'workplace-refetch']);
    expect(operatorWorkplaceMocks.startOperatorBreak).toHaveBeenCalledWith(expect.anything(), 'break-type-1');
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');
    expectActionLabel(container, 'finish_break', 'Завершить перерыв');
  });

  it('preserves a late break-types completion after the user enters machine selection', async () => {
    const pendingBreakTypes = deferred<OperatorBreakTypeItem[]>();
    operatorWorkplaceMocks.getOperatorBreakTypes.mockReturnValue(pendingBreakTypes.promise);

    const container = await renderHost(inactiveWorkplace);
    await clickAction(container, 'start_break');
    expectActionEnabled(container, 'start_production');

    await clickAction(container, 'start_production');
    expectNode(container, 'START_PRODUCTION_SELECT_MACHINE_ENTRY');

    await act(async () => {
      pendingBreakTypes.resolve([breakType]);
      await pendingBreakTypes.promise;
    });

    expectNode(container, 'BREAK_SELECT_TYPE');
    expect(container.textContent).toContain('Выберите тип перерыва.');
    expectActionLabel(container, 'start_break', 'Начать Coffee break');
  });

  it('confirms finish break, then mutates, refetches, and returns to the monitor', async () => {
    const effects: string[] = [];
    operatorWorkplaceMocks.finishOperatorBreak.mockImplementation(async () => {
      effects.push('finish-break');
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockImplementation(async () => {
      effects.push('workplace-refetch');
      return inactiveWorkplace;
    });

    const container = await renderHost(activeBreakWorkplace);
    await clickAction(container, 'finish_break');

    expectNode(container, 'BREAK_CONFIRM_FINISH');
    expect(container.textContent).toContain('Вы хотите завершить');
    expect(container.textContent).toContain('Coffee break');
    expectActionLabel(container, 'finish_break', 'Завершить перерыв');
    await clickAction(container, 'finish_break');

    expect(effects).toEqual(['finish-break', 'workplace-refetch']);
    expect(operatorWorkplaceMocks.finishOperatorBreak).toHaveBeenCalledWith(expect.anything());
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');
    expectActionLabel(container, 'start_break', 'Начать перерыв');
  });

  it('orders downtime types by backend class and starts operational downtime immediately before refetch', async () => {
    const effects: string[] = [];
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockResolvedValue({
      active_production_operation_id: 'production-1',
      available_downtime_types: [criticalDowntimeType, operationalDowntimeType]
    });
    operatorWorkplaceMocks.startOperatorDowntime.mockImplementation(async () => {
      effects.push('start-downtime');
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockImplementation(async () => {
      effects.push('workplace-refetch');
      return operationalDowntimeWorkplace;
    });

    const container = await renderHost(activeProductionWorkplace);
    await clickAction(container, 'start_downtime');
    expectNode(container, 'S02-N09');
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('[data-action-id="start_downtime"] button')];
    expect(buttons.map(normalizedText)).toEqual(['Начать: Наладка', 'Начать: Поломка']);
    expect(buttons[0]?.classList.contains('peaks-action-button--yellow')).toBe(true);
    expect(buttons[1]?.classList.contains('peaks-action-button--red')).toBe(true);
    expect(container.textContent).not.toContain('OPERATIONAL');
    expect(container.textContent).not.toContain('CRITICAL');

    await clickButton(container, 'Начать: Наладка');
    expect(effects).toEqual(['start-downtime', 'workplace-refetch']);
    expect(operatorWorkplaceMocks.startOperatorDowntime).toHaveBeenCalledWith(expect.anything(), {
      machine_id: 'machine-1',
      downtime_type_id: 'downtime-type-operational',
      production_operation_id: 'production-1',
      comment: null
    });
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');
  });

  it('runs critical downtime with active operation through N26/N27/N28 and refetches only on N28 Back', async () => {
    const effects: string[] = [];
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockResolvedValue({
      active_production_operation_id: 'production-1',
      available_downtime_types: [criticalDowntimeType]
    });
    operatorWorkplaceMocks.startOperatorDowntime.mockImplementation(async () => {
      effects.push('start-critical');
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockImplementation(async () => {
      effects.push('workplace-refetch');
      return criticalDowntimeWorkplace;
    });

    const container = await renderHost(activeProductionWorkplace);
    await clickAction(container, 'start_downtime');
    await clickButton(container, 'Начать: Поломка');
    expectNode(container, 'S02-N26');
    expectActionDisabled(container, 'start_downtime');
    await enterComment(container, '  Сломался привод  ');
    await clickAction(container, 'start_downtime', 'Далее');
    expectNode(container, 'S02-N27');
    const confirmedComment = container.querySelector<HTMLTextAreaElement>('textarea[name="confirmed_comment"]');
    expect(confirmedComment).not.toBeNull();
    expect(confirmedComment?.readOnly).toBe(true);
    expect(confirmedComment?.rows).toBe(4);
    expect(confirmedComment?.classList.contains('peaks-comment-input-keyboard__field')).toBe(true);
    expect(confirmedComment?.value).toBe('Комментарий:\n  Сломался привод  ');
    await clickAction(container, 'start_downtime', 'Начать:Поломка');

    expect(effects).toEqual(['start-critical']);
    expect(operatorWorkplaceMocks.startOperatorDowntime).toHaveBeenCalledWith(expect.anything(), {
      machine_id: 'machine-1',
      downtime_type_id: 'downtime-type-critical',
      production_operation_id: 'production-1',
      comment: 'Сломался привод'
    });
    expectNode(container, 'S02-N28');
    expect(container.textContent).not.toContain('Поломка');
    await clickAction(container, 'back');
    expect(effects).toEqual(['start-critical', 'workplace-refetch']);
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');
  });

  it('uses list-only machine selection and backend selectability for critical downtime without operation', async () => {
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockResolvedValue({
      active_production_operation_id: null,
      available_downtime_types: [criticalDowntimeType]
    });
    operatorWorkplaceMocks.getOperatorCriticalDowntimeMachines.mockResolvedValue([blockedCriticalMachine, machine]);
    operatorWorkplaceMocks.startOperatorDowntime.mockResolvedValue({ id: 'downtime-2' });

    const container = await renderHost(inactiveWorkplace);
    await clickAction(container, 'start_downtime');
    await clickButton(container, 'Начать: Поломка');
    expectNode(container, 'S02-N04');
    expect(container.textContent).not.toContain('Сканировать QR');
    expect(findButton(container, 'Machine Two').disabled).toBe(true);
    await clickButton(container, 'Machine One');
    await enterComment(container, 'Нет питания');
    await clickAction(container, 'start_downtime', 'Далее');
    await clickAction(container, 'start_downtime', 'Начать:Поломка');

    expect(operatorWorkplaceMocks.startOperatorDowntime).toHaveBeenCalledWith(expect.anything(), {
      machine_id: 'machine-1',
      downtime_type_id: 'downtime-type-critical',
      production_operation_id: null,
      comment: 'Нет питания'
    });
    expectNode(container, 'S02-N28');
  });

  it.each([
    {
      name: 'operational row requiring comment',
      row: { ...operationalDowntimeType, requires_comment: true },
      activeOperationId: 'production-1'
    },
    {
      name: 'operational row without required production operation',
      row: { ...operationalDowntimeType, requires_production_operation: false },
      activeOperationId: 'production-1'
    },
    {
      name: 'operational row without active production operation',
      row: operationalDowntimeType,
      activeOperationId: null
    },
    {
      name: 'critical row not requiring comment',
      row: { ...criticalDowntimeType, requires_comment: false },
      activeOperationId: null
    },
    {
      name: 'critical row requiring production operation',
      row: { ...criticalDowntimeType, requires_production_operation: true },
      activeOperationId: 'production-1'
    }
  ])('fails closed for inconsistent backend branch tokens: $name', async ({ row, activeOperationId }) => {
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockResolvedValue({
      active_production_operation_id: activeOperationId,
      available_downtime_types: [row]
    });

    const container = await renderHost(activeProductionWorkplace);
    await clickAction(container, 'start_downtime');
    await clickButton(container, `Начать: ${row.display_name}`);

    expectNode(container, 'S02_MESSAGE');
    expect(container.textContent).toContain('неподдерживаемую конфигурацию');
    expect(operatorWorkplaceMocks.startOperatorDowntime).not.toHaveBeenCalled();
    expect(operatorWorkplaceMocks.getOperatorCriticalDowntimeMachines).not.toHaveBeenCalled();
  });

  it('finishes downtime through N10, then refetches before returning to N02', async () => {
    const effects: string[] = [];
    operatorWorkplaceMocks.finishOperatorDowntime.mockImplementation(async () => {
      effects.push('finish-downtime');
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockImplementation(async () => {
      effects.push('workplace-refetch');
      return inactiveWorkplace;
    });

    const container = await renderHost(operationalDowntimeWorkplace);
    await clickAction(container, 'finish_downtime_operational');
    expectNode(container, 'S02-N10');
    await clickAction(container, 'finish_downtime_operational');

    expect(effects).toEqual(['finish-downtime', 'workplace-refetch']);
    expect(operatorWorkplaceMocks.finishOperatorDowntime).toHaveBeenCalledWith(expect.anything(), 'downtime-1');
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');
  });

  it('shows D1 loading/empty states and ignores a stale downtime response after Back', async () => {
    const pendingTypes = deferred<{
      active_production_operation_id: null;
      available_downtime_types: OperatorAvailableDowntimeTypeItem[];
    }>();
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockReturnValue(pendingTypes.promise);

    const container = await renderHost(inactiveWorkplace);
    await clickAction(container, 'start_downtime');
    expectNode(container, 'S02-N09');
    expect(container.textContent).toContain('Загрузка…');
    await clickAction(container, 'back');
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');

    await act(async () => {
      pendingTypes.resolve({
        active_production_operation_id: null,
        available_downtime_types: [criticalDowntimeType]
      });
      await pendingTypes.promise;
    });
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');

    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockResolvedValue({
      active_production_operation_id: null,
      available_downtime_types: []
    });
    await clickAction(container, 'start_downtime');
    expect(container.textContent).toContain('Доступные типы простоя отсутствуют.');
    expect(container.querySelectorAll('[data-action-id="start_downtime"]')).toHaveLength(0);
  });

  it('keeps N09 after Back from loading N04 when the critical machine response resolves late', async () => {
    const pendingMachines = deferred<OperatorMachineItem[]>();
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockResolvedValue({
      active_production_operation_id: null,
      available_downtime_types: [criticalDowntimeType]
    });
    operatorWorkplaceMocks.getOperatorCriticalDowntimeMachines.mockReturnValue(pendingMachines.promise);

    const container = await renderHost(inactiveWorkplace);
    await clickAction(container, 'start_downtime');
    await clickButton(container, 'Начать: Поломка');
    expectNode(container, 'S02-N04');
    expect(container.textContent).toContain('Загрузка…');

    await clickAction(container, 'back');
    expectNode(container, 'S02-N09');
    expect(container.textContent).toContain('Начать:Поломка');

    await act(async () => {
      pendingMachines.resolve([machine]);
      await pendingMachines.promise;
    });

    expectNode(container, 'S02-N09');
    expect(container.textContent).toContain('Начать:Поломка');
    expect(container.textContent).not.toContain('Machine One');
  });

  it('renders the explicit empty machine-list state for critical downtime without operation', async () => {
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockResolvedValue({
      active_production_operation_id: null,
      available_downtime_types: [criticalDowntimeType]
    });
    operatorWorkplaceMocks.getOperatorCriticalDowntimeMachines.mockResolvedValue([]);

    const container = await renderHost(inactiveWorkplace);
    await clickAction(container, 'start_downtime');
    await clickButton(container, 'Начать: Поломка');

    expectNode(container, 'S02-N04');
    expect(container.textContent).toContain('Доступные станки отсутствуют.');
    expect(container.querySelectorAll('[data-action-id="select_machine"]')).toHaveLength(0);
  });

  it('routes a D1 read error to the app boundary without leaving the current D1 node', async () => {
    const onUnavailable = vi.fn();
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockRejectedValue(
      apiError(403, 'forbidden', 'Forbidden')
    );

    const container = await renderHost(inactiveWorkplace, onUnavailable);
    await clickAction(container, 'start_downtime');

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expectNode(container, 'S02-N09');
  });

  it('keeps validation on N27 context and renders the exact backend message without refetch', async () => {
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockResolvedValue({
      active_production_operation_id: 'production-1',
      available_downtime_types: [criticalDowntimeType]
    });
    operatorWorkplaceMocks.startOperatorDowntime.mockRejectedValue(
      apiError(400, 'bad_request', 'Комментарий слишком короткий')
    );

    const container = await renderHost(activeProductionWorkplace);
    await enterCriticalConfirmation(container);
    await clickAction(container, 'start_downtime', 'Начать:Поломка');

    expectNode(container, 'S02_MESSAGE');
    expect(container.textContent).toContain('Комментарий слишком короткий');
    expect(operatorWorkplaceMocks.getOperatorWorkplaceState).not.toHaveBeenCalled();
    await clickAction(container, 'back');
    expectNode(container, 'S02-N27');
  });

  it('hands 401/403 mutation errors to the authenticated app boundary without local workaround', async () => {
    const onUnavailable = vi.fn();
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockResolvedValue({
      active_production_operation_id: 'production-1',
      available_downtime_types: [operationalDowntimeType]
    });
    operatorWorkplaceMocks.startOperatorDowntime.mockRejectedValue(
      apiError(401, 'unauthenticated', 'Authentication required')
    );

    const container = await renderHost(activeProductionWorkplace, onUnavailable);
    await clickAction(container, 'start_downtime');
    await clickButton(container, 'Начать: Наладка');

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(operatorWorkplaceMocks.getOperatorWorkplaceState).not.toHaveBeenCalled();
  });

  it.each([
    { status: 404, code: 'not_found' },
    { status: 409, code: 'conflict' }
  ])('refetches authoritative sources after $status stale/conflict before presenting N09', async ({ status, code }) => {
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes
      .mockResolvedValueOnce({
        active_production_operation_id: 'production-1',
        available_downtime_types: [operationalDowntimeType]
      })
      .mockResolvedValueOnce({
        active_production_operation_id: null,
        available_downtime_types: [criticalDowntimeType]
      });
    operatorWorkplaceMocks.startOperatorDowntime.mockRejectedValue(
      apiError(status, code, 'Operation violates current business state')
    );
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(inactiveWorkplace);

    const container = await renderHost(activeProductionWorkplace);
    await clickAction(container, 'start_downtime');
    await clickButton(container, 'Начать: Наладка');

    expect(operatorWorkplaceMocks.getOperatorWorkplaceState).toHaveBeenCalledTimes(1);
    expect(operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes).toHaveBeenCalledTimes(2);
    expectNode(container, 'S02-N09');
    expect(container.textContent).toContain('Поломка');
  });

  it('preserves context, refetches authoritative sources, and offers retry after unknown mutation outcome', async () => {
    operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes.mockResolvedValue({
      active_production_operation_id: 'production-1',
      available_downtime_types: [criticalDowntimeType]
    });
    operatorWorkplaceMocks.startOperatorDowntime.mockRejectedValue(new TypeError('network failed'));
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(activeProductionWorkplace);

    const container = await renderHost(activeProductionWorkplace);
    await enterCriticalConfirmation(container);
    await clickAction(container, 'start_downtime', 'Начать:Поломка');

    expect(operatorWorkplaceMocks.getOperatorWorkplaceState).toHaveBeenCalledTimes(1);
    expect(operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes).toHaveBeenCalledTimes(2);
    expectNode(container, 'S02_MESSAGE');
    expectActionLabel(container, 'start_downtime', 'Повторить');
    await clickAction(container, 'back');
    expectNode(container, 'S02-N27');
    expect(container.textContent).toContain('Сломался привод');
  });

  it.each([
    ['network refresh failure', new TypeError('refresh network failed')],
    ['5xx refresh failure', apiError(500, 'database_error', 'Internal server error')]
  ])(
    'preserves context and blocks duplicate mutation until retry refetch succeeds after %s',
    async (_name, refreshFailure) => {
      operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes
        .mockResolvedValueOnce({
          active_production_operation_id: 'production-1',
          available_downtime_types: [criticalDowntimeType]
        })
        .mockRejectedValueOnce(refreshFailure)
        .mockResolvedValueOnce({
          active_production_operation_id: null,
          available_downtime_types: [criticalDowntimeType]
        });
      operatorWorkplaceMocks.startOperatorDowntime.mockRejectedValue(new TypeError('mutation outcome unknown'));
      operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(activeProductionWorkplace);

      const container = await renderHost(activeProductionWorkplace);
      await enterCriticalConfirmation(container);
      await clickAction(container, 'start_downtime', 'Начать:Поломка');

      expectNode(container, 'S02_MESSAGE');
      expectActionLabel(container, 'start_downtime', 'Повторить');
      expect(operatorWorkplaceMocks.startOperatorDowntime).toHaveBeenCalledTimes(1);
      expect(operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes).toHaveBeenCalledTimes(2);

      await clickAction(container, 'start_downtime', 'Повторить');

      expect(operatorWorkplaceMocks.getOperatorAvailableDowntimeTypes).toHaveBeenCalledTimes(3);
      expect(operatorWorkplaceMocks.startOperatorDowntime).toHaveBeenCalledTimes(1);
      expectNode(container, 'S02-N09');
    }
  );

  it('opens N11 only after additional-work then workplace refetch and renders backend groups/actions only', async () => {
    const effects: string[] = [];
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockImplementation(async () => {
      effects.push('additional-state');
      return additionalWorkState;
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockImplementation(async () => {
      effects.push('workplace');
      return additionalWorkMenuWorkplace;
    });

    const container = await renderHost(additionalWorkEntryWorkplace);
    expectActionLabel(container, 'additional_work', 'Допработа');
    await clickAction(container, 'additional_work');

    expect(effects).toEqual(['additional-state', 'workplace']);
    expectNode(container, 'S02-N11');
    expectActionLabel(container, 'finish_additional_work', 'Завершить: Инвентаризация склада');
    expect(container.querySelectorAll('[data-action-id="start_additional_work"]')).toHaveLength(2);
    expectActionLabel(container, 'request_additional_work', 'Запросить допработу');
    expect(container.querySelector('.peaks-d2-inactive-row')?.textContent).toBe('Ожидающая заявка');
    expect(container.querySelector('.peaks-d2-inactive-row')?.getAttribute('aria-disabled')).toBe('true');
    expect([...container.querySelectorAll('h2')].map(normalizedText)).toEqual([
      'Выполняемые',
      'Согласованные',
      'На согласовании'
    ]);
    expect(container.querySelector('.peaks-graph-fixed-top')).toBeNull();
    const approvedButton = findButton(container, 'Начать: Помощь упаковке');
    expect(approvedButton.classList.contains('peaks-d2-gray-green')).toBe(true);
    expect(approvedButton.querySelector('img')).toBeNull();
    expect(container.textContent).not.toMatch(/Отменить|Согласовать|Отклонить|Начислить/);
    expect(container.querySelector('[data-action-id*="cancel"]')).toBeNull();
  });

  it('hides the N11 request action when the fresh workplace lacks REQUEST_ADDITIONAL_WORK', async () => {
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockResolvedValue(additionalWorkState);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkEntryWorkplace);

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');

    expectNode(container, 'S02-N11');
    expect(container.querySelector('[data-action-id="request_additional_work"]')).not.toBeNull();
  });

  it('renders explicit empty N11 and AW01 states without inventing rows', async () => {
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockResolvedValue({
      actor_employee_id: 'employee-1',
      active_additional_works: [],
      approved_additional_works: [],
      pending_approval_additional_works: []
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);
    operatorWorkplaceMocks.getOperatorAdditionalWorkTypesAvailable.mockResolvedValue({
      additional_work_types: []
    });

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    expect(container.textContent).toContain('Допработы отсутствуют.');
    expect(container.querySelectorAll('[data-action-id="start_additional_work"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-action-id="finish_additional_work"]')).toHaveLength(0);

    await clickAction(container, 'request_additional_work');
    expectNode(container, 'S02-AW01');
    expect(container.textContent).toContain('Доступные типы допработ отсутствуют.');
    expect(container.querySelectorAll('[data-action-id="select_additional_work_type"]')).toHaveLength(0);
  });

  it('runs AW01→AW02→request→additional refetch→workplace refetch→N11 with exact type text', async () => {
    const effects: string[] = [];
    operatorWorkplaceMocks.getOperatorAdditionalWorkState
      .mockImplementationOnce(async () => {
        effects.push('open-additional');
        return additionalWorkState;
      })
      .mockImplementationOnce(async () => {
        effects.push('request-additional-refetch');
        return {
          ...additionalWorkState,
          pending_approval_additional_works: [
            ...additionalWorkState.pending_approval_additional_works,
            {
              additional_work_id: 'pending-new',
              additional_work_type_id: 'type-request',
              display_name: '  Точная допработа  ',
              ui_group: 'PENDING_APPROVAL',
              ui_color_token: 'white_gray_inactive',
              action: null
            }
          ]
        };
      });
    operatorWorkplaceMocks.getOperatorWorkplaceState
      .mockImplementationOnce(async () => {
        effects.push('open-workplace');
        return additionalWorkMenuWorkplace;
      })
      .mockImplementationOnce(async () => {
        effects.push('request-workplace-refetch');
        return additionalWorkMenuWorkplace;
      });
    operatorWorkplaceMocks.getOperatorAdditionalWorkTypesAvailable.mockImplementation(async () => {
      effects.push('available-types');
      return {
        additional_work_types: [
          {
            additional_work_type_id: 'type-request',
            display_name: '  Точная допработа  '
          }
        ]
      };
    });
    operatorWorkplaceMocks.requestOperatorAdditionalWork.mockImplementation(async () => {
      effects.push('request-mutation');
    });

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    await clickAction(container, 'request_additional_work');
    expectNode(container, 'S02-AW01');
    expect(container.textContent).toContain('  Точная допработа  ');
    await clickButton(container, 'Точная допработа');
    expectNode(container, 'S02-AW02');
    const requestConfirmation = container.querySelector('.peaks-d2-confirmation');
    expect(requestConfirmation).not.toBeNull();
    expect(requestConfirmation?.classList.contains('peaks-graph-info-text--blue')).toBe(false);
    const requestButton = findButton(container, 'Запросить: Точная допработа');
    expect(requestButton.classList.contains('peaks-d2-text-action')).toBe(true);
    expect(requestButton.querySelector('img')).toBeNull();
    const requestBack = findButton(container, 'Назад');
    expect(requestBack.classList.contains('peaks-action-button--fixed55')).toBe(true);
    expect(requestBack.querySelector('img')).toBeNull();
    await clickAction(container, 'request_additional_work', 'Запросить: Точная допработа');

    expect(operatorWorkplaceMocks.requestOperatorAdditionalWork).toHaveBeenCalledWith(
      expect.anything(),
      'type-request'
    );
    expect(effects).toEqual([
      'open-additional',
      'open-workplace',
      'available-types',
      'request-mutation',
      'request-additional-refetch',
      'request-workplace-refetch'
    ]);
    expectNode(container, 'S02-N11');
  });

  it('silently removes a concurrently requested type after the authoritative conflict refresh', async () => {
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockResolvedValue(additionalWorkState);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);
    operatorWorkplaceMocks.getOperatorAdditionalWorkTypesAvailable
      .mockResolvedValueOnce({
        additional_work_types: [
          { additional_work_type_id: 'type-request', display_name: 'Упаковка' },
          { additional_work_type_id: 'type-other', display_name: 'Пересчёт' }
        ]
      })
      .mockResolvedValueOnce({
        additional_work_types: [
          { additional_work_type_id: 'type-other', display_name: 'Пересчёт' }
        ]
      });
    operatorWorkplaceMocks.requestOperatorAdditionalWork.mockRejectedValue(
      apiError(409, 'conflict', 'Operation violates current business state')
    );

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    await clickAction(container, 'request_additional_work');
    await clickButton(container, 'Упаковка');
    await clickAction(container, 'request_additional_work', 'Запросить: Упаковка');

    expectNode(container, 'S02-AW01');
    expect(container.textContent).not.toContain('Упаковка');
    expect(container.textContent).toContain('Пересчёт');
    expect(container.textContent).not.toContain('Operation violates current business state');
    expect(container.querySelector('[data-node-id="S02_MESSAGE"]')).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    {
      item: operatorApprovedAdditionalWork,
      nodeId: 'S02-AW03A',
      label: 'Начать: Помощь упаковке'
    },
    {
      item: managerAssignedAdditionalWork,
      nodeId: 'S02-AW03B',
      label: 'Начать: Пересчёт материалов'
    }
  ])('chooses $nodeId solely from backend origin and starts with ordered refetches', async ({ item, nodeId, label }) => {
    const effects: string[] = [];
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockImplementation(async () => {
      effects.push('additional-state');
      return additionalWorkState;
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockImplementation(async () => {
      effects.push('workplace');
      return additionalWorkMenuWorkplace;
    });
    operatorWorkplaceMocks.startOperatorAdditionalWork.mockImplementation(async () => {
      effects.push('start-mutation');
    });

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    await clickButton(container, label);
    expectNode(container, nodeId);
    expect(container.querySelector('.peaks-d2-contract-card')?.textContent).toContain(item.display_name);
    const startButton = findButton(container, label);
    expect(startButton.classList.contains('peaks-d2-gray-green')).toBe(true);
    expect(startButton.querySelector('img')).toBeNull();
    expect(container.textContent).not.toContain('Отменить');
    await clickAction(container, 'start_additional_work', label);

    expect(operatorWorkplaceMocks.startOperatorAdditionalWork).toHaveBeenCalledWith(
      expect.anything(),
      item.additional_work_id
    );
    expect(effects).toEqual([
      'additional-state',
      'workplace',
      'start-mutation',
      'additional-state',
      'workplace'
    ]);
    expectNode(container, 'S02-N11');
  });

  it('finishes through AW04→AW05 with no immediate refetch, then Back refetches additional and workplace', async () => {
    const effects: string[] = [];
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockImplementation(async () => {
      effects.push('additional-state');
      return additionalWorkState;
    });
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockImplementation(async () => {
      effects.push('workplace');
      return additionalWorkMenuWorkplace;
    });
    operatorWorkplaceMocks.finishOperatorAdditionalWork.mockImplementation(async () => {
      effects.push('finish-mutation');
    });

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    await clickAction(container, 'finish_additional_work');
    expectNode(container, 'S02-AW04');
    expect(container.querySelector('.peaks-d2-confirmation')).not.toBeNull();
    const finishButton = findButton(container, 'Завершить: Инвентаризация склада');
    expect(finishButton.classList.contains('peaks-d2-text-action')).toBe(true);
    expect(finishButton.querySelector('img')).toBeNull();
    expect(findButton(container, 'Назад').querySelector('img')).toBeNull();
    await clickAction(container, 'finish_additional_work');

    expect(operatorWorkplaceMocks.finishOperatorAdditionalWork).toHaveBeenCalledWith(
      expect.anything(),
      'active-work-1'
    );
    expect(effects).toEqual(['additional-state', 'workplace', 'finish-mutation']);
    expectNode(container, 'S02-AW05');
    expect(container.querySelector('.peaks-d2-result-card')).not.toBeNull();
    expect(container.querySelector('.peaks-d2-result-card')?.textContent).toContain('Инвентаризация склада');
    expect(container.textContent).toContain('Ожидает решения по оплате.');

    await clickAction(container, 'back');
    expect(effects).toEqual([
      'additional-state',
      'workplace',
      'finish-mutation',
      'additional-state',
      'workplace'
    ]);
    expectNode(container, 'S02-N11');
  });

  it('ignores late additional-work menu and AW01 type responses after Back', async () => {
    const pendingMenu = deferred<OperatorAdditionalWorkStateResponse>();
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockReturnValueOnce(pendingMenu.promise);

    const menuContainer = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(menuContainer, 'additional_work');
    expectNode(menuContainer, 'S02-N11');
    expect(menuContainer.textContent).toContain('Загрузка…');
    await clickAction(menuContainer, 'back');
    expectNode(menuContainer, 'S02-N02_OPERATOR_WORKPLACE');

    await act(async () => {
      pendingMenu.resolve(additionalWorkState);
      await pendingMenu.promise;
    });
    expectNode(menuContainer, 'S02-N02_OPERATOR_WORKPLACE');
    expect(operatorWorkplaceMocks.getOperatorWorkplaceState).not.toHaveBeenCalled();

    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockResolvedValue(additionalWorkState);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);
    const pendingTypes = deferred<{
      additional_work_types: Array<{ additional_work_type_id: string; display_name: string }>;
    }>();
    operatorWorkplaceMocks.getOperatorAdditionalWorkTypesAvailable.mockReturnValue(pendingTypes.promise);

    const typesContainer = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(typesContainer, 'additional_work');
    await clickAction(typesContainer, 'request_additional_work');
    expectNode(typesContainer, 'S02-AW01');
    await clickAction(typesContainer, 'back');
    expectNode(typesContainer, 'S02-N11');

    await act(async () => {
      pendingTypes.resolve({
        additional_work_types: [{ additional_work_type_id: 'late', display_name: 'Поздняя строка' }]
      });
      await pendingTypes.promise;
    });
    expectNode(typesContainer, 'S02-N11');
    expect(typesContainer.textContent).not.toContain('Поздняя строка');
  });

  it('keeps request validation on AW02 and hands auth failures to the app boundary', async () => {
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockResolvedValue(additionalWorkState);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);
    operatorWorkplaceMocks.getOperatorAdditionalWorkTypesAvailable.mockResolvedValue({
      additional_work_types: [{ additional_work_type_id: 'type-request', display_name: 'Packing' }]
    });
    operatorWorkplaceMocks.requestOperatorAdditionalWork.mockRejectedValue(
      apiError(400, 'bad_request', 'Этот тип уже запрошен')
    );

    const validationContainer = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(validationContainer, 'additional_work');
    await clickAction(validationContainer, 'request_additional_work');
    await clickButton(validationContainer, 'Packing');
    await clickAction(validationContainer, 'request_additional_work');

    expectNode(validationContainer, 'S02_MESSAGE');
    expect(validationContainer.textContent).toContain('Этот тип уже запрошен');
    expect(operatorWorkplaceMocks.getOperatorAdditionalWorkState).toHaveBeenCalledTimes(1);
    await clickAction(validationContainer, 'back');
    expectNode(validationContainer, 'S02-AW02');

    const onUnavailable = vi.fn();
    operatorWorkplaceMocks.startOperatorAdditionalWork.mockRejectedValue(
      apiError(403, 'forbidden', 'Forbidden')
    );
    const authContainer = await renderHost(additionalWorkEntryWorkplace, onUnavailable);
    await clickAction(authContainer, 'additional_work');
    await clickAction(authContainer, 'start_additional_work', 'Начать: Помощь упаковке');
    await clickAction(authContainer, 'start_additional_work');
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 404, code: 'not_found' },
    { status: 409, code: 'conflict' }
  ])('refetches the additional-work source after $status stale/conflict', async ({ status, code }) => {
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockResolvedValue(additionalWorkState);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);
    operatorWorkplaceMocks.startOperatorAdditionalWork.mockRejectedValue(
      apiError(status, code, 'Additional work changed')
    );

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    await clickAction(container, 'start_additional_work', 'Начать: Помощь упаковке');
    await clickAction(container, 'start_additional_work');

    expect(operatorWorkplaceMocks.getOperatorAdditionalWorkState).toHaveBeenCalledTimes(2);
    expect(operatorWorkplaceMocks.getOperatorWorkplaceState).toHaveBeenCalledTimes(2);
    expectNode(container, 'S02-N11');
  });

  it('preserves AW04 context after unknown outcome and retries only authoritative refetch', async () => {
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockResolvedValue(additionalWorkState);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);
    operatorWorkplaceMocks.finishOperatorAdditionalWork.mockRejectedValue(
      new TypeError('mutation outcome unknown')
    );

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    await clickAction(container, 'finish_additional_work');
    await clickAction(container, 'finish_additional_work');

    expectNode(container, 'S02_MESSAGE');
    expectActionLabel(container, 'request_additional_work', 'Обновить');
    expect(operatorWorkplaceMocks.finishOperatorAdditionalWork).toHaveBeenCalledTimes(1);
    expect(operatorWorkplaceMocks.getOperatorAdditionalWorkState).toHaveBeenCalledTimes(2);
    await clickAction(container, 'back');
    expectNode(container, 'S02-AW04');

    await clickAction(container, 'finish_additional_work');
    expect(operatorWorkplaceMocks.finishOperatorAdditionalWork).toHaveBeenCalledTimes(2);
    expectNode(container, 'S02_MESSAGE');
    await clickAction(container, 'request_additional_work', 'Обновить');
    expect(operatorWorkplaceMocks.finishOperatorAdditionalWork).toHaveBeenCalledTimes(2);
    expectNode(container, 'S02-N11');
  });

  it('focuses D2 screen entries and announces loading, busy, ready, and error status', async () => {
    const pendingMenu = deferred<OperatorAdditionalWorkStateResponse>();
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockReturnValue(pendingMenu.promise);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');

    const loadingMain = container.querySelector<HTMLElement>('main');
    expect(document.activeElement).toBe(loadingMain);
    expect(loadingMain?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Загрузка допработ');

    await act(async () => {
      pendingMenu.resolve(additionalWorkState);
      await pendingMenu.promise;
    });

    const readyMain = container.querySelector<HTMLElement>('main');
    expect(document.activeElement).toBe(readyMain);
    expect(readyMain?.getAttribute('aria-busy')).toBe('false');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Список допработ обновлён');

    operatorWorkplaceMocks.getOperatorAdditionalWorkTypesAvailable.mockRejectedValue(
      new TypeError('types unavailable')
    );
    await clickAction(container, 'request_additional_work');
    const errorMain = container.querySelector<HTMLElement>('main');
    expectNode(container, 'S02_MESSAGE');
    expect(document.activeElement).toBe(errorMain);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Сервис временно недоступен');
  });

  it('invalidates a retry on Back/new request and ignores its out-of-order completion', async () => {
    const staleRetry = deferred<OperatorAdditionalWorkStateResponse>();
    operatorWorkplaceMocks.getOperatorAdditionalWorkState
      .mockRejectedValueOnce(new TypeError('initial menu failed'))
      .mockReturnValueOnce(staleRetry.promise)
      .mockResolvedValueOnce(additionalWorkState);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    expectNode(container, 'S02_MESSAGE');

    await clickAction(container, 'request_additional_work', 'Обновить');
    expect(operatorWorkplaceMocks.getOperatorAdditionalWorkState).toHaveBeenCalledTimes(2);
    const retryButton = findButton(container, 'Обновить');
    await click(retryButton);
    expect(operatorWorkplaceMocks.getOperatorAdditionalWorkState).toHaveBeenCalledTimes(2);

    await clickAction(container, 'back');
    expectNode(container, 'S02-N11');
    await clickAction(container, 'back');
    expectNode(container, 'S02-N02_OPERATOR_WORKPLACE');

    await clickAction(container, 'additional_work');
    expectNode(container, 'S02-N11');
    expect(container.textContent).toContain('Инвентаризация склада');

    await act(async () => {
      staleRetry.resolve({
        actor_employee_id: 'employee-old',
        active_additional_works: [],
        approved_additional_works: [],
        pending_approval_additional_works: []
      });
      await staleRetry.promise;
    });

    expectNode(container, 'S02-N11');
    expect(container.textContent).toContain('Инвентаризация склада');
    expect(container.textContent).not.toContain('Допработы отсутствуют.');
  });

  it('keeps the newer AW01 navigation when an older type retry completes later', async () => {
    const staleTypes = deferred<{
      additional_work_types: Array<{ additional_work_type_id: string; display_name: string }>;
    }>();
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockResolvedValue(additionalWorkState);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);
    operatorWorkplaceMocks.getOperatorAdditionalWorkTypesAvailable
      .mockRejectedValueOnce(new TypeError('initial types failed'))
      .mockReturnValueOnce(staleTypes.promise)
      .mockResolvedValueOnce({
        additional_work_types: [{ additional_work_type_id: 'new-type', display_name: 'Новая допработа' }]
      });

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    await clickAction(container, 'request_additional_work');
    expectNode(container, 'S02_MESSAGE');
    await clickAction(container, 'request_additional_work', 'Обновить');
    await clickAction(container, 'back');
    expectNode(container, 'S02-AW01');
    await clickAction(container, 'back');
    expectNode(container, 'S02-N11');

    await clickAction(container, 'request_additional_work');
    expectNode(container, 'S02-AW01');
    expect(container.textContent).toContain('Новая допработа');

    await act(async () => {
      staleTypes.resolve({
        additional_work_types: [{ additional_work_type_id: 'old-type', display_name: 'Старая допработа' }]
      });
      await staleTypes.promise;
    });

    expectNode(container, 'S02-AW01');
    expect(container.textContent).toContain('Новая допработа');
    expect(container.textContent).not.toContain('Старая допработа');
  });

  it('invalidates unknown request retry completion after Back to AW02', async () => {
    const staleTypes = deferred<{
      additional_work_types: Array<{ additional_work_type_id: string; display_name: string }>;
    }>();
    const availableTypes = {
      additional_work_types: [{ additional_work_type_id: 'type-request', display_name: 'Packing' }]
    };
    operatorWorkplaceMocks.getOperatorAdditionalWorkState.mockResolvedValue(additionalWorkState);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);
    operatorWorkplaceMocks.getOperatorAdditionalWorkTypesAvailable
      .mockResolvedValueOnce(availableTypes)
      .mockResolvedValueOnce(availableTypes)
      .mockReturnValueOnce(staleTypes.promise);
    operatorWorkplaceMocks.requestOperatorAdditionalWork.mockRejectedValue(
      new TypeError('request outcome unknown')
    );

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    await clickAction(container, 'request_additional_work');
    await clickButton(container, 'Packing');
    await clickAction(container, 'request_additional_work');
    expectNode(container, 'S02_MESSAGE');

    await clickAction(container, 'request_additional_work', 'Обновить');
    await clickAction(container, 'back');
    expectNode(container, 'S02-AW02');

    await act(async () => {
      staleTypes.resolve(availableTypes);
      await staleTypes.promise;
    });
    expectNode(container, 'S02-AW02');
    expect(operatorWorkplaceMocks.requestOperatorAdditionalWork).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'start',
      openAction: 'start_additional_work',
      openLabel: 'Начать: Помощь упаковке',
      confirmationNode: 'S02-AW03A',
      mutationMock: operatorWorkplaceMocks.startOperatorAdditionalWork
    },
    {
      name: 'finish',
      openAction: 'finish_additional_work',
      openLabel: 'Завершить: Инвентаризация склада',
      confirmationNode: 'S02-AW04',
      mutationMock: operatorWorkplaceMocks.finishOperatorAdditionalWork
    }
  ])(
    'invalidates unknown $name retry completion after Back to its confirmation',
    async ({ openAction, openLabel, confirmationNode, mutationMock }) => {
      const staleMenu = deferred<OperatorAdditionalWorkStateResponse>();
      operatorWorkplaceMocks.getOperatorAdditionalWorkState
        .mockResolvedValueOnce(additionalWorkState)
        .mockResolvedValueOnce(additionalWorkState)
        .mockReturnValueOnce(staleMenu.promise);
      operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);
      mutationMock.mockRejectedValue(new TypeError('mutation outcome unknown'));

      const container = await renderHost(additionalWorkEntryWorkplace);
      await clickAction(container, 'additional_work');
      await clickButton(container, openLabel);
      await clickAction(container, openAction);
      expectNode(container, 'S02_MESSAGE');

      await clickAction(container, 'request_additional_work', 'Обновить');
      await clickAction(container, 'back');
      expectNode(container, confirmationNode);

      await act(async () => {
        staleMenu.resolve(additionalWorkState);
        await staleMenu.promise;
      });
      expectNode(container, confirmationNode);
      expect(mutationMock).toHaveBeenCalledTimes(1);
    }
  );

  it('invalidates a failed AW05 Back retry and does not leave the result after Back navigation', async () => {
    const staleMenu = deferred<OperatorAdditionalWorkStateResponse>();
    operatorWorkplaceMocks.getOperatorAdditionalWorkState
      .mockResolvedValueOnce(additionalWorkState)
      .mockRejectedValueOnce(new TypeError('AW05 refresh failed'))
      .mockReturnValueOnce(staleMenu.promise);
    operatorWorkplaceMocks.getOperatorWorkplaceState.mockResolvedValue(additionalWorkMenuWorkplace);
    operatorWorkplaceMocks.finishOperatorAdditionalWork.mockResolvedValue({ id: 'active-work-1' });

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    await clickAction(container, 'finish_additional_work');
    await clickAction(container, 'finish_additional_work');
    expectNode(container, 'S02-AW05');
    await clickAction(container, 'back');
    expectNode(container, 'S02_MESSAGE');

    await clickAction(container, 'request_additional_work', 'Обновить');
    await clickAction(container, 'back');
    expectNode(container, 'S02-AW05');

    await act(async () => {
      staleMenu.resolve(additionalWorkState);
      await staleMenu.promise;
    });
    expectNode(container, 'S02-AW05');
  });

  it('invalidates an in-flight retry on component unmount', async () => {
    const staleRetry = deferred<OperatorAdditionalWorkStateResponse>();
    operatorWorkplaceMocks.getOperatorAdditionalWorkState
      .mockRejectedValueOnce(new TypeError('initial menu failed'))
      .mockReturnValueOnce(staleRetry.promise);

    const container = await renderHost(additionalWorkEntryWorkplace);
    await clickAction(container, 'additional_work');
    await clickAction(container, 'request_additional_work', 'Обновить');

    const mounted = mountedRoots.find((entry) => entry.container === container);
    expect(mounted).toBeDefined();
    await act(async () => {
      mounted?.root.unmount();
    });
    mountedRoots = mountedRoots.filter((entry) => entry !== mounted);

    await act(async () => {
      staleRetry.resolve(additionalWorkState);
      await staleRetry.promise;
    });

    expect(operatorWorkplaceMocks.getOperatorWorkplaceState).not.toHaveBeenCalled();
  });

  it('preserves QR placeholder copy and every rendered Back edge', async () => {
    operatorWorkplaceMocks.getOperatorMachines.mockResolvedValue([machine]);
    operatorWorkplaceMocks.getOperatorSkus.mockResolvedValue([sku]);
    operatorWorkplaceMocks.getOperatorBreakTypes.mockResolvedValue([breakType]);

    const machineEntry = await renderHost(inactiveWorkplace);
    await clickAction(machineEntry, 'start_production');
    await clickAction(machineEntry, 'scan_machine_qr');
    expectNode(machineEntry, 'S02_MESSAGE');
    expect(machineEntry.textContent).toContain(
      'QR-сканирование будет подключено отдельным pipeline. Сейчас выберите станок из списка.'
    );
    await clickAction(machineEntry, 'back');
    expectNode(machineEntry, 'START_PRODUCTION_SELECT_MACHINE_ENTRY');
    await clickAction(machineEntry, 'back');
    expectNode(machineEntry, 'S02-N02_OPERATOR_WORKPLACE');

    const machineList = await renderHost(inactiveWorkplace);
    await clickAction(machineList, 'start_production');
    await clickAction(machineList, 'select_machine_from_list');
    await clickButton(machineList, 'Machine One');
    expectNode(machineList, 'START_PRODUCTION_SELECT_SKU_LIST');
    await clickAction(machineList, 'back');
    expectNode(machineList, 'START_PRODUCTION_SELECT_MACHINE_LIST');
    await clickAction(machineList, 'back');
    expectNode(machineList, 'START_PRODUCTION_SELECT_MACHINE_ENTRY');

    const quantity = await renderHost(activeProductionWorkplace);
    await clickAction(quantity, 'finish_production');
    expectNode(quantity, 'FINISH_PRODUCTION_ENTER_QUANTITY');
    await clickAction(quantity, 'back');
    expectNode(quantity, 'S02-N02_OPERATOR_WORKPLACE');

    const breakList = await renderHost(inactiveWorkplace);
    await clickAction(breakList, 'start_break');
    expectNode(breakList, 'BREAK_SELECT_TYPE');
    await clickAction(breakList, 'back');
    expectNode(breakList, 'S02-N02_OPERATOR_WORKPLACE');

    const finishBreak = await renderHost(activeBreakWorkplace);
    await clickAction(finishBreak, 'finish_break');
    expectNode(finishBreak, 'BREAK_CONFIRM_FINISH');
    await clickAction(finishBreak, 'back');
    expectNode(finishBreak, 'S02-N02_OPERATOR_WORKPLACE');
  });

  it('calls onUnavailable and stays on the current node when a read fails', async () => {
    const onUnavailable = vi.fn();
    operatorWorkplaceMocks.getOperatorMachines.mockRejectedValue(new Error('machines unavailable'));

    const container = await renderHost(inactiveWorkplace, onUnavailable);
    await clickAction(container, 'start_production');
    await clickAction(container, 'select_machine_from_list');

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expectNode(container, 'START_PRODUCTION_SELECT_MACHINE_ENTRY');
    expect(container.textContent).not.toContain('Сервис временно недоступен');
  });

  it('calls onUnavailable, skips refetch, and stays on the current node when a mutation fails', async () => {
    const onUnavailable = vi.fn();
    operatorWorkplaceMocks.getOperatorMachines.mockResolvedValue([machine]);
    operatorWorkplaceMocks.getOperatorSkus.mockResolvedValue([sku]);
    operatorWorkplaceMocks.startProductionOperation.mockRejectedValue(new Error('start production unavailable'));

    const container = await renderHost(inactiveWorkplace, onUnavailable);
    await clickAction(container, 'start_production');
    await clickAction(container, 'select_machine_from_list');
    await clickButton(container, 'Machine One');
    await clickButton(container, 'SKU-1 Product One');

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(operatorWorkplaceMocks.getOperatorWorkplaceState).not.toHaveBeenCalled();
    expectNode(container, 'START_PRODUCTION_SELECT_SKU_LIST');
    expect(container.textContent).not.toContain('Сервис временно недоступен');
  });
});

async function renderHost(
  initialWorkplaceState: OperatorWorkplaceStateResponse,
  onUnavailable?: () => void
): Promise<HTMLDivElement> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });

  await act(async () => {
    root.render(
      <Section02OperatorPipelineHost
        apiClient={{} as ApiClient}
        initialWorkplaceState={initialWorkplaceState}
        onUnavailable={onUnavailable}
      />
    );
  });

  return container;
}

async function clickAction(container: HTMLElement, actionId: string, expectedLabel?: string): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>(`[data-action-id="${actionId}"] button`);
  expect(button, `Expected action ${actionId}`).not.toBeNull();
  if (!button) {
    throw new Error(`Expected action ${actionId}`);
  }

  if (expectedLabel) {
    expect(normalizedText(button)).toBe(expectedLabel);
  }

  await click(button);
}

async function clickButton(container: HTMLElement, label: string): Promise<void> {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => normalizedText(candidate) === label
  );
  expect(button, `Expected button "${label}"`).not.toBeUndefined();
  if (!button) {
    throw new Error(`Expected button "${label}"`);
  }

  await click(button);
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function expectNode(container: HTMLElement, nodeId: string): void {
  expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe(nodeId);
}

function expectActionLabel(container: HTMLElement, actionId: string, label: string): void {
  const button = container.querySelector<HTMLButtonElement>(`[data-action-id="${actionId}"] button`);
  expect(button, `Expected action ${actionId}`).not.toBeNull();
  if (!button) {
    throw new Error(`Expected action ${actionId}`);
  }

  expect(normalizedText(button)).toBe(label);
}

function expectActionEnabled(container: HTMLElement, actionId: string): void {
  const button = container.querySelector<HTMLButtonElement>(`[data-action-id="${actionId}"] button`);
  expect(button, `Expected action ${actionId}`).not.toBeNull();
  expect(button?.disabled).toBe(false);
}

function expectActionDisabled(container: HTMLElement, actionId: string): void {
  const button = container.querySelector<HTMLButtonElement>(`[data-action-id="${actionId}"] button`);
  expect(button, `Expected action ${actionId}`).not.toBeNull();
  expect(button?.disabled).toBe(true);
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => normalizedText(candidate) === label
  );
  expect(button, `Expected button "${label}"`).not.toBeUndefined();
  if (!button) {
    throw new Error(`Expected button "${label}"`);
  }
  return button;
}

async function enterComment(container: HTMLElement, value: string): Promise<void> {
  const textarea = container.querySelector<HTMLTextAreaElement>('textarea[name="comment"]');
  expect(textarea).not.toBeNull();
  if (!textarea) {
    throw new Error('Expected comment textarea');
  }

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function enterCriticalConfirmation(container: HTMLElement): Promise<void> {
  await clickAction(container, 'start_downtime');
  await clickButton(container, 'Начать: Поломка');
  await enterComment(container, 'Сломался привод');
  await clickAction(container, 'start_downtime', 'Далее');
  expectNode(container, 'S02-N27');
}

function apiError(status: number, code: string, message: string): ApiClientError {
  return new ApiClientError('Backend request failed', status, {
    error: { code, message }
  });
}

function normalizedText(element: Element): string {
  const leafText = [...element.querySelectorAll('*')]
    .filter((child) => child.children.length === 0)
    .map((child) => child.textContent?.trim())
    .filter((text): text is string => Boolean(text));

  return (leafText.length > 0 ? leafText.join(' ') : element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

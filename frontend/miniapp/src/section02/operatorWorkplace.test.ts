import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../foundation/apiClient';
import {
  finishOperatorAdditionalWork,
  finishOperatorDowntime,
  getOperatorAdditionalWorkState,
  getOperatorAdditionalWorkTypesAvailable,
  getOperatorAvailableDowntimeTypes,
  getOperatorBreakTypes,
  getOperatorCriticalDowntimeMachines,
  OperatorReadModelContractError,
  orderOperatorAvailableDowntimeTypes,
  requestOperatorAdditionalWork,
  resolveOperatorEntrypointByWorkplaceState,
  startOperatorAdditionalWork,
  startOperatorDowntime,
  type OperatorAvailableDowntimeTypeItem
} from './operatorWorkplace';

describe('Section 02 operator post-auth resolver', () => {
  it('routes authenticated operator without active shift to S02-N01', () => {
    expect(resolveOperatorEntrypointByWorkplaceState({ shift: { is_active: false } })).toBe('S02-N01');
  });

  it('routes authenticated operator with active shift to S02-N02', () => {
    expect(resolveOperatorEntrypointByWorkplaceState({ shift: { is_active: true, employee_shift_id: 'shift-1' } })).toBe('S02-N02');
  });
});

describe('Section 02 downtime endpoint contract', () => {
  it('keeps newly configured break types as backend-owned list rows', async () => {
    const rows = [
      { break_type_id: '1', display_name: 'Обед', break_type_name: 'Обед', is_active: true },
      { break_type_id: '2', display_name: 'Личные нужды', break_type_name: 'Личные нужды', is_active: true },
      { break_type_id: '3', display_name: 'Технический перерыв', break_type_name: 'Технический перерыв', is_active: true },
    ];
    const request = vi.fn().mockResolvedValue({ break_types: rows });

    await expect(getOperatorBreakTypes({ request } as unknown as ApiClient)).resolves.toEqual(rows);
    expect(request).toHaveBeenCalledWith('/operator/break-types');
  });

  it('reads the exact available-downtime-types response without inventing rows or display fallbacks', async () => {
    const response = {
      active_production_operation_id: 'production-1',
      available_downtime_types: [
        {
          downtime_type_id: 'downtime-type-1',
          display_name: 'Наладка',
          downtime_class: 'OPERATIONAL' as const,
          ui_color_token: 'yellow' as const,
          requires_production_operation: true,
          requires_comment: false
        }
      ]
    };
    const request = vi.fn().mockResolvedValue(response);

    await expect(getOperatorAvailableDowntimeTypes({ request } as unknown as ApiClient)).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith('/operator/downtime-types/available');
  });

  it.each([
    ['non-object wrapper', []],
    ['missing active id', { available_downtime_types: [] }],
    ['undefined active id', { active_production_operation_id: undefined, available_downtime_types: [] }],
    ['empty active id', { active_production_operation_id: '', available_downtime_types: [] }],
    ['numeric active id', { active_production_operation_id: 1, available_downtime_types: [] }],
    ['missing rows', { active_production_operation_id: null }],
    ['non-array rows', { active_production_operation_id: null, available_downtime_types: {} }]
  ])('rejects malformed available-downtime wrapper: %s', async (_name, payload) => {
    const request = vi.fn().mockResolvedValue(payload);

    await expect(
      getOperatorAvailableDowntimeTypes({ request } as unknown as ApiClient)
    ).rejects.toBeInstanceOf(OperatorReadModelContractError);
  });

  it.each([
    ['downtime_type_id missing', 'downtime_type_id', undefined],
    ['downtime_type_id empty', 'downtime_type_id', ''],
    ['downtime_type_id invalid', 'downtime_type_id', 1],
    ['display_name missing', 'display_name', undefined],
    ['display_name empty', 'display_name', ''],
    ['display_name invalid', 'display_name', 1],
    ['downtime_class missing', 'downtime_class', undefined],
    ['downtime_class invalid', 'downtime_class', 'UNKNOWN'],
    ['ui_color_token missing', 'ui_color_token', undefined],
    ['ui_color_token invalid', 'ui_color_token', 'red'],
    ['requires_production_operation missing', 'requires_production_operation', undefined],
    ['requires_production_operation invalid', 'requires_production_operation', 'true'],
    ['requires_comment missing', 'requires_comment', undefined],
    ['requires_comment invalid', 'requires_comment', 'true']
  ])('rejects malformed available-downtime row: %s', async (_name, field, value) => {
    const row: Record<string, unknown> = completeDowntimeType();
    if (value === undefined) {
      delete row[field];
    } else {
      row[field] = value;
    }
    const request = vi.fn().mockResolvedValue({
      active_production_operation_id: null,
      available_downtime_types: [row]
    });

    await expect(
      getOperatorAvailableDowntimeTypes({ request } as unknown as ApiClient)
    ).rejects.toBeInstanceOf(OperatorReadModelContractError);
  });

  it.each([
    ['operational with scarlet', 'OPERATIONAL', 'scarlet'],
    ['critical with yellow', 'CRITICAL', 'yellow']
  ])('rejects inconsistent class/color mapping: %s', async (_name, downtimeClass, color) => {
    const request = vi.fn().mockResolvedValue({
      active_production_operation_id: null,
      available_downtime_types: [
        {
          ...completeDowntimeType(),
          downtime_class: downtimeClass,
          ui_color_token: color
        }
      ]
    });

    await expect(
      getOperatorAvailableDowntimeTypes({ request } as unknown as ApiClient)
    ).rejects.toBeInstanceOf(OperatorReadModelContractError);
  });

  it('preserves exact display_name and backend membership for valid rows', async () => {
    const rows = [
      completeDowntimeType(),
      {
        ...completeDowntimeType(),
        downtime_type_id: 'downtime-type-2',
        display_name: '  Точный текст  ',
        downtime_class: 'CRITICAL',
        ui_color_token: 'scarlet'
      }
    ];
    const request = vi.fn().mockResolvedValue({
      active_production_operation_id: null,
      available_downtime_types: rows
    });

    const response = await getOperatorAvailableDowntimeTypes({ request } as unknown as ApiClient);
    expect(response.available_downtime_types).toEqual(rows);
    expect(response.available_downtime_types[1]?.display_name).toBe('  Точный текст  ');
  });

  it('orders backend rows by backend downtime_class and preserves backend-only membership and class order', () => {
    const critical = downtimeType('critical-1', 'Поломка', 'CRITICAL');
    const operational = downtimeType('operational-1', 'Наладка', 'OPERATIONAL');
    const secondCritical = downtimeType('critical-2', 'Электрика', 'CRITICAL');

    expect(orderOperatorAvailableDowntimeTypes([critical, operational, secondCritical])).toEqual([
      operational,
      critical,
      secondCritical
    ]);
  });

  it('keeps newly configured operational and critical types without a frontend allowlist', async () => {
    const rows = [
      downtimeType('operational-1', 'Ожидание материала', 'OPERATIONAL'),
      downtimeType('operational-2', 'Другое', 'OPERATIONAL'),
      downtimeType('operational-3', 'Ожидание комплектующих', 'OPERATIONAL'),
      downtimeType('critical-1', 'Требуется ремонт', 'CRITICAL'),
      downtimeType('critical-2', 'Требуется настройка', 'CRITICAL'),
      downtimeType('critical-3', 'Авария электрики', 'CRITICAL'),
    ];
    const request = vi.fn().mockResolvedValue({
      active_production_operation_id: 'production-1',
      available_downtime_types: rows,
    });

    const response = await getOperatorAvailableDowntimeTypes({ request } as unknown as ApiClient);
    expect(response.available_downtime_types.map((item) => item.display_name)).toEqual([
      'Ожидание материала',
      'Другое',
      'Ожидание комплектующих',
      'Требуется ремонт',
      'Требуется настройка',
      'Авария электрики',
    ]);
  });

  it('binds exact start and finish downtime mutation requests', async () => {
    const request = vi.fn().mockResolvedValue({ id: 'downtime-1' });
    const apiClient = { request } as unknown as ApiClient;

    await startOperatorDowntime(apiClient, {
      machine_id: 'machine-1',
      downtime_type_id: 'downtime-type-1',
      production_operation_id: null,
      comment: 'Поломка'
    });
    await finishOperatorDowntime(apiClient, 'downtime/1');

    expect(request).toHaveBeenNthCalledWith(1, '/machine-downtimes/start', {
      method: 'POST',
      body: {
        machine_id: 'machine-1',
        downtime_type_id: 'downtime-type-1',
        production_operation_id: null,
        comment: 'Поломка'
      }
    });
    expect(request).toHaveBeenNthCalledWith(2, '/machine-downtimes/downtime%2F1/finish', {
      method: 'POST',
      body: {}
    });
  });

  it('accepts only the exact D1 machines wrapper and complete mandatory MachineItem contract', async () => {
    const request = vi.fn().mockResolvedValueOnce({
      machines: [completeMachine()]
    }).mockResolvedValueOnce([completeMachine()]);
    const apiClient = { request } as unknown as ApiClient;

    await expect(getOperatorCriticalDowntimeMachines(apiClient)).resolves.toEqual([
      {
        machine_id: 'machine-1',
        machine_name: 'Machine One',
        is_selectable_for_critical_downtime: true
      }
    ]);
    await expect(getOperatorCriticalDowntimeMachines(apiClient)).resolves.toEqual([]);
  });

  it.each([
    ['machine_id missing', 'machine_id', undefined],
    ['machine_id invalid', 'machine_id', 1],
    ['machine_name missing', 'machine_name', undefined],
    ['machine_name invalid', 'machine_name', 1],
    ['workshop_name missing', 'workshop_name', undefined],
    ['workshop_name invalid', 'workshop_name', 1],
    ['machine_status missing', 'machine_status', undefined],
    ['machine_status invalid', 'machine_status', false],
    ['machine_use_status missing', 'machine_use_status', undefined],
    ['machine_use_status invalid', 'machine_use_status', 1],
    ['is_selectable_for_production missing', 'is_selectable_for_production', undefined],
    ['is_selectable_for_production invalid', 'is_selectable_for_production', 'true'],
    ['is_selectable_for_critical_downtime missing', 'is_selectable_for_critical_downtime', undefined],
    ['is_selectable_for_critical_downtime invalid', 'is_selectable_for_critical_downtime', 'true'],
    ['ui_status_token missing', 'ui_status_token', undefined],
    ['ui_status_token invalid', 'ui_status_token', 'unknown']
  ])('fails closed when mandatory MachineItem field is %s', async (_name, field, value) => {
    const row: Record<string, unknown> = completeMachine();
    if (value === undefined) {
      delete row[field];
    } else {
      row[field] = value;
    }
    const request = vi.fn().mockResolvedValue({ machines: [row] });

    await expect(
      getOperatorCriticalDowntimeMachines({ request } as unknown as ApiClient)
    ).resolves.toEqual([]);
  });
});

describe('Section 02 additional-work endpoint contract', () => {
  it('reads exact backend groups/actions and preserves exact display_name text', async () => {
    const response = completeAdditionalWorkState();
    const request = vi.fn().mockResolvedValue(response);

    await expect(getOperatorAdditionalWorkState({ request } as unknown as ApiClient)).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith('/operator/additional-work-state');
  });

  it.each([
    ['non-object wrapper', []],
    ['missing actor', { ...completeAdditionalWorkState(), actor_employee_id: undefined }],
    ['missing active group', { ...completeAdditionalWorkState(), active_additional_works: undefined }],
    ['invalid approved action', {
      ...completeAdditionalWorkState(),
      approved_additional_works: [
        {
          ...completeAdditionalWorkState().approved_additional_works[0],
          action: null
        }
      ]
    }],
    ['invalid pending action', {
      ...completeAdditionalWorkState(),
      pending_approval_additional_works: [
        {
          ...completeAdditionalWorkState().pending_approval_additional_works[0],
          action: 'START_ADDITIONAL_WORK'
        }
      ]
    }],
    ['invalid approved origin', {
      ...completeAdditionalWorkState(),
      approved_additional_works: [
        {
          ...completeAdditionalWorkState().approved_additional_works[0],
          origin: 'INFERRED_FROM_NAME'
        }
      ]
    }]
  ])('rejects malformed additional-work state: %s', async (_name, payload) => {
    const request = vi.fn().mockResolvedValue(payload);

    await expect(
      getOperatorAdditionalWorkState({ request } as unknown as ApiClient)
    ).rejects.toBeInstanceOf(OperatorReadModelContractError);
  });

  it('reads only the exact available-type wrapper and display names', async () => {
    const response = {
      additional_work_types: [
        {
          additional_work_type_id: 'type-1',
          display_name: '  Точное имя допработы  '
        }
      ]
    };
    const request = vi.fn().mockResolvedValue(response);

    await expect(
      getOperatorAdditionalWorkTypesAvailable({ request } as unknown as ApiClient)
    ).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith('/operator/additional-work-types/available');
  });

  it.each([
    ['non-object wrapper', []],
    ['missing rows', {}],
    ['non-array rows', { additional_work_types: {} }],
    ['missing id', { additional_work_types: [{ display_name: 'Packing' }] }],
    ['empty display name', {
      additional_work_types: [{ additional_work_type_id: 'type-1', display_name: '' }]
    }]
  ])('rejects malformed available additional-work types: %s', async (_name, payload) => {
    const request = vi.fn().mockResolvedValue(payload);

    await expect(
      getOperatorAdditionalWorkTypesAvailable({ request } as unknown as ApiClient)
    ).rejects.toBeInstanceOf(OperatorReadModelContractError);
  });

  it('binds exact request/start/finish paths and JSON bodies', async () => {
    const request = vi.fn().mockResolvedValue({ id: 'work-1' });
    const apiClient = { request } as unknown as ApiClient;

    await requestOperatorAdditionalWork(apiClient, 'type-1');
    await startOperatorAdditionalWork(apiClient, 'work/approved');
    await finishOperatorAdditionalWork(apiClient, 'work/active');

    expect(request).toHaveBeenNthCalledWith(1, '/additional-works/request', {
      method: 'POST',
      body: { additional_work_type_id: 'type-1' }
    });
    expect(request).toHaveBeenNthCalledWith(2, '/additional-works/work%2Fapproved/start', {
      method: 'POST',
      body: {}
    });
    expect(request).toHaveBeenNthCalledWith(3, '/additional-works/work%2Factive/finish', {
      method: 'POST',
      body: {}
    });
  });
});

function downtimeType(
  downtimeTypeId: string,
  displayName: string,
  downtimeClass: 'OPERATIONAL' | 'CRITICAL'
): OperatorAvailableDowntimeTypeItem {
  return {
    downtime_type_id: downtimeTypeId,
    display_name: displayName,
    downtime_class: downtimeClass,
    ui_color_token: downtimeClass === 'OPERATIONAL' ? 'yellow' : 'scarlet',
    requires_production_operation: downtimeClass === 'OPERATIONAL',
    requires_comment: downtimeClass === 'CRITICAL'
  };
}

function completeMachine(): Record<string, unknown> {
  return {
    machine_id: 'machine-1',
    machine_name: 'Machine One',
    workshop_name: null,
    machine_status: null,
    machine_use_status: null,
    is_selectable_for_production: true,
    is_selectable_for_critical_downtime: true,
    ui_status_token: 'normal'
  };
}

function completeDowntimeType(): Record<string, unknown> {
  return {
    downtime_type_id: 'downtime-type-1',
    display_name: 'Наладка',
    downtime_class: 'OPERATIONAL',
    ui_color_token: 'yellow',
    requires_production_operation: true,
    requires_comment: false
  };
}

function completeAdditionalWorkState() {
  return {
    actor_employee_id: 'employee-1',
    active_additional_works: [
      {
        additional_work_id: 'active-1',
        additional_work_type_id: 'type-active',
        display_name: '  Активная допработа  ',
        ui_group: 'ACTIVE' as const,
        ui_color_token: 'green' as const,
        action: 'FINISH_ADDITIONAL_WORK' as const
      }
    ],
    approved_additional_works: [
      {
        additional_work_id: 'approved-1',
        additional_work_type_id: 'type-approved',
        display_name: 'Согласованная допработа',
        origin: 'OPERATOR_REQUEST_APPROVED' as const,
        ui_group: 'APPROVED' as const,
        ui_color_token: 'gray_green' as const,
        action: 'START_ADDITIONAL_WORK' as const
      }
    ],
    pending_approval_additional_works: [
      {
        additional_work_id: 'pending-1',
        additional_work_type_id: 'type-pending',
        display_name: 'Ожидающая допработа',
        ui_group: 'PENDING_APPROVAL' as const,
        ui_color_token: 'white_gray_inactive' as const,
        action: null
      }
    ]
  };
}

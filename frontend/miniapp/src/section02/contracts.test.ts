import { describe, expect, it } from 'vitest';
import {
  Section02ContractError,
  decodeOperationMutationResult,
  decodeOperatorAdditionalWorkTypes,
  decodeOperatorBreakTypes,
  decodeOperatorAdditionalWorkState,
  decodeOperatorDowntimeTypes,
  decodeOperatorMachineQr,
  decodeOperatorSkuQr,
  decodeOperatorMachines,
  decodeOperatorSalaryHistory,
  decodeOperatorSalaryTotals,
  decodeOperatorSkus,
  decodeOperatorWorkplaceState,
  decodeProductionMutationResult,
  decodeShiftMutationResult,
} from './contracts';

describe('Section 02 strict contracts', () => {
  it('accepts exact workplace authority and rejects an invalid shift state', () => {
    const workplace = decodeOperatorWorkplaceState({ actor_employee_id: '201', actor_full_name: 'Иванов Иван Иванович', shift: { is_active: true }, available_pipelines: ['START_DOWNTIME'], additional_work_start: { blockers: [] } });
    expect(workplace.shift.is_active).toBe(true);
    expect(workplace.actor_employee_id).toBe('201');
    expect(() => decodeOperatorWorkplaceState({ shift: { is_active: 'true' } })).toThrow(Section02ContractError);
  });

  it('decodes active and inactive SKU QR responses strictly', () => {
    expect(decodeOperatorSkuQr({
      found: true,
      sku: {
        sku_id: '21', sku_code: 'SKU-021', sku_name: 'Деталь', sku_unit_name: 'шт.',
        current_sku_tariff_uzs: 1250, is_active: true, is_selectable_for_production: true,
        production_unavailability: null,
      },
    })).toMatchObject({ found: true, sku: { sku_id: '21', is_selectable_for_production: true } });
    expect(decodeOperatorSkuQr({ found: false, error_code: 'SKU_QR_NOT_FOUND' })).toEqual({
      found: false, error_code: 'SKU_QR_NOT_FOUND',
    });
    expect(() => decodeOperatorSkuQr({ found: false, error_code: 'MACHINE_QR_NOT_FOUND' })).toThrow('sku-qr');
  });

  it('accepts only unique deterministic additional-work start blocker codes', () => {
    const base = { actor_full_name: 'Иванов Иван Иванович', shift: { is_active: true }, additional_work_start: { blockers: ['ACTIVE_PRODUCTION', 'ACTIVE_BREAK'] } };
    expect(decodeOperatorWorkplaceState(base).additional_work_start?.blockers).toEqual(['ACTIVE_PRODUCTION', 'ACTIVE_BREAK']);
    expect(() => decodeOperatorWorkplaceState({ ...base, additional_work_start: { blockers: ['ACTIVE_BREAK', 'ACTIVE_PRODUCTION'] } })).toThrow(Section02ContractError);
    expect(() => decodeOperatorWorkplaceState({ ...base, additional_work_start: { blockers: ['UNKNOWN'] } })).toThrow(Section02ContractError);
  });

  it('accepts only consistent backend downtime class/color tuples', () => {
    const exact = { active_production_operation_id: '31', available_downtime_types: [{ downtime_type_id: '61', display_name: 'Поломка', downtime_class: 'CRITICAL', ui_color_token: 'scarlet', requires_production_operation: true, requires_comment: true }] };
    expect(decodeOperatorDowntimeTypes(exact).available_downtime_types).toHaveLength(1);
    expect(() => decodeOperatorDowntimeTypes({ ...exact, available_downtime_types: [{ ...exact.available_downtime_types[0], ui_color_token: 'yellow' }] })).toThrow(Section02ContractError);
  });

  it('rejects an unrelated additional-work action in a backend state group', () => {
    expect(() => decodeOperatorAdditionalWorkState({ actor_employee_id: '1', active_additional_works: [], approved_additional_works: [{ additional_work_id: '2', additional_work_type_id: '3', display_name: 'Work', origin: 'MANAGER_ASSIGNED', ui_group: 'APPROVED', ui_color_token: 'gray_green', action: null }], pending_approval_additional_works: [] })).toThrow(Section02ContractError);
  });

  it('decodes the three exact backend mutation result shapes', () => {
    expect(decodeShiftMutationResult({ employee_shift_id: '91' })).toEqual({ employee_shift_id: '91' });
    expect(decodeProductionMutationResult({ production_operation_id: '31' })).toEqual({ production_operation_id: '31' });
    expect(decodeOperationMutationResult({ id: '51' })).toEqual({ id: '51' });
    expect(() => decodeOperationMutationResult({ operation_id: '51' })).toThrow(Section02ContractError);
  });

  it.each([
    ['machines', decodeOperatorMachines, { machines: [{ machine_id: '1', machine_name: 'Machine', machine_status: null, machine_use_status: null, is_selectable_for_production: true, is_selectable_for_critical_downtime: true, ui_status_token: 'normal' }] }, { machines: [{ machine_name: 'Machine' }] }],
    ['skus', decodeOperatorSkus, { skus: [{ sku_id: '2', sku_code: 'SKU', sku_name: 'Part', unit_name: null, current_sku_tariff_uzs: '1', is_active: true }] }, { skus: [{ sku_id: '2', sku_name: 'Part' }] }],
    ['break types', decodeOperatorBreakTypes, { break_types: [{ break_type_id: '3', display_name: 'Lunch', break_type_name: 'Lunch', is_active: true }] }, { break_types: [{ break_type_id: '3' }] }],
    ['additional-work types', decodeOperatorAdditionalWorkTypes, { additional_work_types: [{ additional_work_type_id: '4', display_name: 'Inventory' }] }, { additional_work_types: [{ display_name: 'Inventory' }] }],
    ['salary totals', decodeOperatorSalaryTotals, { totals: { today_uzs: '1', week_uzs: 2, month_uzs: '3' } }, { totals: { today_uzs: null, week_uzs: '2', month_uzs: '3' } }],
    ['salary history', decodeOperatorSalaryHistory, { months: [{ month: '2026-08', production_uzs: '1', additional_work_uzs: '2', corrections_uzs: null, reversals_uzs: null, total_uzs: '3' }] }, { months: [{ month: '2026-08', production_uzs: '1' }] }],
  ] as const)('accepts and rejects the %s source contract', (_name, decoder, accepted, rejected) => {
    expect(() => decoder(accepted)).not.toThrow();
    expect(() => decoder(rejected)).toThrow(Section02ContractError);
  });

  it.each(['normal', 'busy', 'critical', 'unavailable'] as const)('preserves machine ui status token %s', (uiStatusToken) => {
    expect(decodeOperatorMachines({ machines: [{
      machine_id: '1', machine_name: 'Machine', machine_status: null, machine_use_status: null,
      is_selectable_for_production: uiStatusToken === 'normal',
      is_selectable_for_critical_downtime: uiStatusToken === 'normal',
      ui_status_token: uiStatusToken,
    }] })[0]?.ui_status_token).toBe(uiStatusToken);
  });

  it.each([undefined, 'unknown'])('rejects machine ui status token %s', (uiStatusToken) => {
    expect(() => decodeOperatorMachines({ machines: [{
      machine_id: '1', machine_name: 'Machine', machine_status: null, machine_use_status: null,
      is_selectable_for_production: false, is_selectable_for_critical_downtime: false,
      ...(uiStatusToken === undefined ? {} : { ui_status_token: uiStatusToken }),
    }] })).toThrow(Section02ContractError);
  });

  it('decodes QR occupancy evidence and rejects an unknown reason', () => {
    expect(decodeOperatorMachineQr({
      found: true,
      machine: {
        machine_id: '1', machine_name: 'Machine', workshop_name: null,
        machine_status: 'Работает', machine_use_status: 'Используется',
        is_selectable_for_production: false, is_selectable_for_critical_downtime: false,
        ui_status_token: 'busy',
        production_unavailability: { code: 'OCCUPIED_BY_OPERATOR', operator_full_name: 'Петров Пётр Сергеевич' },
      },
    })).toMatchObject({
      found: true,
      machine: {
        production_unavailability: { code: 'OCCUPIED_BY_OPERATOR', operator_full_name: 'Петров Пётр Сергеевич' },
      },
    });

    expect(() => decodeOperatorMachineQr({
      found: true,
      machine: {
        machine_id: '1', machine_name: 'Machine', workshop_name: null,
        machine_status: 'Работает', machine_use_status: 'Используется',
        is_selectable_for_production: false, is_selectable_for_critical_downtime: false,
        ui_status_token: 'busy', production_unavailability: { code: 'UNKNOWN' },
      },
    })).toThrow(Section02ContractError);
  });
});

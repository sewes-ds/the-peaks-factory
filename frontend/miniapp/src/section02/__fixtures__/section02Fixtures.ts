import { ApiClient } from '../../foundation/apiClient';
import type { Section02Context } from '../context';
import type { AdditionalWorkStartBlocker } from '../contracts';
import { SECTION02_NODE_IDS, type Section02NodeId } from '../ids';

export type Section02FixtureRequest = Readonly<{ method: string; path: string; body: unknown }>;

export const SECTION02_FIXTURE_CONTEXTS: Readonly<Record<Section02NodeId, Section02Context>> = Object.freeze(Object.fromEntries(
  SECTION02_NODE_IDS.map((nodeId) => [nodeId, Object.freeze({
    machine_selection_mode: 'production',
    machine_id: '11', machine_name: 'Станок продольной резки с длинным наименованием',
    sku_id: '21', sku_code: 'SKU-021', sku_name: 'Деталь производственная контрольная',
    production_operation_id: '31', break_type_id: '41', break_type_name: 'Обеденный перерыв',
    downtime_id: '51', downtime_type_id: '61', downtime_type_name: 'Поломка электропривода',
    downtime_class: 'CRITICAL', production_requirement: 'required', comment: 'Остановлен электропривод, требуется диагностика.',
    additional_work_id: nodeId === 'S02-AW03' ? '72' : '71',
    additional_work_type_id: nodeId === 'S02-AW03' ? '82' : '81',
    additional_work_name: nodeId === 'S02-AW03' ? 'Помощь упаковке' : 'Инвентаризация материалов',
    quantity_produced: '12.5',
  })]),
) as Record<Section02NodeId, Section02Context>);

function workplace(nodeId: Section02NodeId) {
  const blocked = nodeId === 'S02-FS02';
  const inactive = nodeId === 'S02-N01';
  const productionActive = nodeId !== 'S02-N02' && !inactive;
  return {
    actor_employee_id: '201',
    actor_full_name: 'Иванов Иван Иванович',
    available_pipelines: ['START_PRODUCTION', 'START_BREAK', 'START_DOWNTIME', 'OPEN_ADDITIONAL_WORK', 'REQUEST_ADDITIONAL_WORK', 'START_ADDITIONAL_WORK', 'FINISH_SHIFT', 'VIEW_SALARY'],
    shift: { is_active: !inactive, employee_shift_id: inactive ? null : '91', started_at: inactive ? null : '2026-08-11T08:00:00+05:00' },
    production: {
      is_active: productionActive,
      production_operation_id: productionActive ? '31' : null,
      machine_id: productionActive ? '11' : null,
      machine_name: productionActive ? 'Станок продольной резки' : null,
      sku_id: productionActive ? '21' : null,
      sku_code: productionActive ? 'SKU-021' : null,
      sku_name: productionActive ? 'Деталь производственная' : null,
      started_at: productionActive ? '2026-08-11T08:10:00+05:00' : null,
      can_finish_production: productionActive,
    },
    break: { is_active: nodeId === 'S02-B03', operator_break_id: '101', break_type_id: '41', break_type_name: 'Обеденный перерыв', can_finish_break: true },
    downtime: { slot_state: 'CRITICAL_ACTIVE', downtime_id: '51', downtime_type_name: 'Поломка электропривода', downtime_class: 'CRITICAL', ui_color_token: 'scarlet', can_start_downtime: true, can_finish_downtime: true },
    additional_work_summary: { has_active_additional_work: true, active_additional_work_id: '71', active_additional_work_name: 'Инвентаризация материалов' },
    additional_work_start: { blockers: [] },
    salary: { can_view_salary: true },
    finish_shift: {
      can_finish_now: !blocked, can_finish_shift: !blocked,
      blockers: blocked ? ['PRODUCTION'] : [], blocking_reasons: [],
      warnings: [], warning_messages: [],
      next_required_pipeline: blocked ? 'FINISH_PRODUCTION' : 'CONFIRM_FINISH_SHIFT',
    },
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

export function createSection02FixtureApiClient(
  nodeId: Section02NodeId,
  requests: Section02FixtureRequest[] = [],
  options: Readonly<{
    mutationGate?: Promise<void>;
    failMutation?: boolean;
    additionalWorkStartBlockers?: readonly AdditionalWorkStartBlocker[];
    allowAdditionalWorkStart?: boolean;
    additionalWorkStateOverride?: unknown;
    machineQrResponse?: unknown;
    skuQrResponse?: unknown;
  }> = {},
): ApiClient {
  return new ApiClient({
    baseUrl: 'http://section02-fixture.local',
    fetchImpl: async (request, init) => {
      const path = new URL(String(request)).pathname;
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({ method, path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null }));
      if (method === 'POST') {
        await options.mutationGate;
        if (options.failMutation === true) return json({ error: 'fixture mutation rejected' }, 409);
        if (path === '/operator/machines/resolve-qr') return json(options.machineQrResponse ?? {
          found: true,
          machine: {
            machine_id: '11',
            machine_name: 'Станок продольной резки с длинным наименованием',
            workshop_name: null,
            machine_status: 'Свободен',
            machine_use_status: 'Используется',
            is_selectable_for_production: true,
            is_selectable_for_critical_downtime: true,
            ui_status_token: 'normal',
            production_unavailability: null,
          },
        });
        if (path === '/operator/skus/resolve-qr') return json(options.skuQrResponse ?? {
          found: true,
          sku: {
            sku_id: '21',
            sku_code: 'SKU-021',
            sku_name: 'Деталь производственная контрольная',
            sku_unit_name: 'шт.',
            current_sku_tariff_uzs: 1250,
            is_active: true,
            is_selectable_for_production: true,
            production_unavailability: null,
          },
        });
        if (path === '/shifts/start' || path === '/shifts/finish') return json({ employee_shift_id: '91' });
        if (path === '/production-operations/start' || path.startsWith('/production-operations/')) return json({ production_operation_id: '31' });
        return json({ id: '501' });
      }
      if (path === '/operator/workplace-state') {
        const state = workplace(nodeId);
        return json({
          ...state,
          available_pipelines: options.allowAdditionalWorkStart === false
            ? state.available_pipelines.filter((pipeline) => pipeline !== 'START_ADDITIONAL_WORK')
            : state.available_pipelines,
          additional_work_start: { blockers: [...(options.additionalWorkStartBlockers ?? [])] },
        });
      }
      if (path === '/operator/machines') return json({ machines: [
        { machine_id: '11', machine_name: 'Станок продольной резки с длинным наименованием', machine_status: null, machine_use_status: null, is_selectable_for_production: true, is_selectable_for_critical_downtime: true, ui_status_token: 'normal' },
        { machine_id: '12', machine_name: '180 автомат', machine_status: 'BROKEN', machine_use_status: 'IN_USE', is_selectable_for_production: false, is_selectable_for_critical_downtime: false, ui_status_token: 'critical' },
      ] });
      if (path === '/operator/skus') return json({ skus: [
        { sku_id: '21', sku_code: 'SKU-021', sku_name: 'Деталь производственная контрольная', unit_name: 'шт.', current_sku_tariff_uzs: '1250', is_active: true },
      ] });
      if (path === '/operator/break-types') return json({ break_types: [
        { break_type_id: '41', display_name: 'Обеденный перерыв', break_type_name: 'Обед', is_active: true },
      ] });
      if (path === '/operator/downtime-types/available') return json({ active_production_operation_id: '31', available_downtime_types: [
        { downtime_type_id: '62', display_name: 'Наладка оборудования', downtime_class: 'OPERATIONAL', ui_color_token: 'yellow', requires_production_operation: true, requires_comment: false },
        { downtime_type_id: '61', display_name: 'Поломка электропривода', downtime_class: 'CRITICAL', ui_color_token: 'scarlet', requires_production_operation: true, requires_comment: true },
      ] });
      if (path === '/operator/additional-work-state') return json(options.additionalWorkStateOverride ?? {
        actor_employee_id: '201',
        active_additional_works: [{ additional_work_id: '71', additional_work_type_id: '81', display_name: 'Инвентаризация материалов', ui_group: 'ACTIVE', ui_color_token: 'green', action: 'FINISH_ADDITIONAL_WORK' }],
        approved_additional_works: [
          { additional_work_id: '72', additional_work_type_id: '82', display_name: 'Помощь упаковке', origin: 'OPERATOR_REQUEST_APPROVED', ui_group: 'APPROVED', ui_color_token: 'gray_green', action: 'START_ADDITIONAL_WORK' },
          { additional_work_id: '73', additional_work_type_id: '83', display_name: 'Пересчёт материалов', origin: 'MANAGER_ASSIGNED', ui_group: 'APPROVED', ui_color_token: 'gray_green', action: 'START_ADDITIONAL_WORK' },
        ],
        pending_approval_additional_works: [{ additional_work_id: '74', additional_work_type_id: '84', display_name: 'Ожидающая заявка', ui_group: 'PENDING_APPROVAL', ui_color_token: 'white_gray_inactive', action: null }],
      });
      if (path === '/operator/additional-work-types/available') return json({ additional_work_types: [
        { additional_work_type_id: '81', display_name: 'Инвентаризация материалов' },
        { additional_work_type_id: '82', display_name: 'Помощь упаковке' },
      ] });
      if (path === '/operator/salary') return json({ totals: { today_uzs: '125000', week_uzs: '750000', month_uzs: '3250000' } });
      if (path === '/operator/salary/history') return json({ months: [
        { month: 'Август 2026', production_uzs: '2500000', additional_work_uzs: '500000', corrections_uzs: '300000', reversals_uzs: null, total_uzs: '3300000' },
        { month: 'Июль 2026', production_uzs: '2300000', additional_work_uzs: '450000', corrections_uzs: null, reversals_uzs: '-50000', total_uzs: '2700000' },
      ] });
      return json({ error: 'fixture route missing' }, 404);
    },
  });
}

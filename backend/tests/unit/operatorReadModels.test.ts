import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import {
  getAvailableAdditionalWorkTypes,
  getAvailableDowntimeTypes,
  getOperatorAdditionalWorkState,
  getOperatorBreakTypes,
  getOperatorMachineByQr,
  getOperatorMachines,
  getOperatorSalaryHistory,
  getOperatorSalaryTotals,
  getOperatorSkuByQr,
  getOperatorSkus,
  getOperatorWorkplaceState
} from '../../src/readModels/operatorReadModels.js';
import {
  resolveAdditionalWorkState,
  resolveAdditionalWorkStartBlockers,
  resolveAvailablePipelines,
  resolveDowntimeClass,
  resolveFinishShiftBlockers,
  resolveFinishShiftNextPipeline,
  resolveFinishShiftWarnings,
  resolveMachineUiStatus
} from '../../src/readModels/resolvers.js';
import type { MachineQrLookupResponse, OperatorWorkplaceStateResponse, SkuQrLookupResponse } from '../../src/readModels/types.js';

const actor: ActorContext = {
  employeeId: 7n,
  telegramUserId: 1000n
};

function createPool(results: Array<readonly Record<string, unknown>[]>): DbPool {
  const queue = [...results];
  return {
    query: async (sql: string, params?: readonly unknown[]) => {
      expect(sql.trim()).toMatch(/^(select|with)\b/i);
      expect(sql).not.toMatch(/\binsert\s+into\b|\bupdate\s+app\.|\bdelete\s+from\b/i);
      if (params) {
        expect(params).not.toContain('99');
      }
      const rows = queue.shift();
      if (!rows) {
        throw new Error(`Unexpected query: ${sql}`);
      }
      return { rows };
    }
  } as unknown as DbPool;
}

function workplaceRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    employee_full_name: 'Иванов Иван Иванович',
    employee_shift_id: null,
    shift_started_at: null,
    production_operation_id: null,
    production_machine_id: null,
    production_machine_name: null,
    sku_id: null,
    sku_code: null,
    sku_name: null,
    linked_downtime_id: null,
    linked_downtime_production_operation_id: null,
    linked_downtime_machine_id: null,
    linked_downtime_machine_name: null,
    linked_downtime_type_id: null,
    linked_downtime_type_name: null,
    linked_downtime_class: null,
    operator_break_id: null,
    break_type_id: null,
    break_type_name: null,
    active_additional_work_id: null,
    active_additional_work_name: null,
    approved_unstarted_count: '0',
    ...overrides
  };
}

describe('shared read-model resolvers', () => {
  it('accepts the database-projected downtime class only', () => {
    expect(resolveDowntimeClass('OPERATIONAL')).toBe('OPERATIONAL');
    expect(resolveDowntimeClass('CRITICAL')).toBe('CRITICAL');
  });

  it('fails closed for an invalid downtime class projection', () => {
    for (const downtimeClass of [null, '', 'operational', 'UNKNOWN']) {
      expect(() => resolveDowntimeClass(downtimeClass)).toThrow('Invalid downtime class projection');
    }
  });

  it('uses accepted finish-shift blocker matrix', () => {
    expect(
      resolveFinishShiftBlockers({
        has_active_shift: true,
        has_active_production: true,
        has_active_break: true,
        has_running_additional_work: true,
        has_approved_unstarted_additional_work: true,
        operational_downtime_active: true,
        can_start_downtime: false,
        can_finish_downtime: true,
        can_finish_production: false
      })
    ).toEqual(['OPERATIONAL_DOWNTIME', 'BREAK', 'ADDITIONAL_WORK', 'PRODUCTION']);
    expect(
      resolveFinishShiftBlockers({
        has_active_shift: true,
        has_active_production: false,
        has_active_break: false,
        has_running_additional_work: false,
        has_approved_unstarted_additional_work: false,
        operational_downtime_active: false,
        can_start_downtime: true,
        can_finish_downtime: false,
        can_finish_production: false
      })
    ).not.toContain('OPERATIONAL_DOWNTIME');
    expect(
      resolveFinishShiftBlockers({
        has_active_shift: false,
        has_active_production: true,
        has_active_break: true,
        has_running_additional_work: true,
        has_approved_unstarted_additional_work: true,
        operational_downtime_active: true,
        can_start_downtime: false,
        can_finish_downtime: true,
        can_finish_production: false
      })
    ).toEqual([]);
    expect(
      resolveFinishShiftWarnings({
        has_active_shift: false,
        has_active_production: false,
        has_active_break: false,
        has_running_additional_work: false,
        has_approved_unstarted_additional_work: true,
        operational_downtime_active: false,
        can_start_downtime: false,
        can_finish_downtime: false,
        can_finish_production: false
      })
    ).toEqual([]);
  });

  it('uses accepted next pipeline precedence', () => {
    expect(resolveFinishShiftNextPipeline(['OPERATIONAL_DOWNTIME'], [])).toBe('FINISH_DOWNTIME');
    expect(resolveFinishShiftNextPipeline(['BREAK'], [])).toBe('FINISH_BREAK');
    expect(resolveFinishShiftNextPipeline(['ADDITIONAL_WORK'], [])).toBe('FINISH_ADDITIONAL_WORK');
    expect(resolveFinishShiftNextPipeline(['PRODUCTION'], [])).toBe('FINISH_PRODUCTION');
    expect(resolveFinishShiftNextPipeline([], ['APPROVED_ADDITIONAL_WORKS_NOT_STARTED'])).toBe(
      'CONFIRM_FINISH_SHIFT_WITH_WARNING'
    );
    expect(resolveFinishShiftNextPipeline([], [], false)).toBeNull();
  });

  it('uses accepted available-pipeline downtime rules', () => {
    const operationalPipelines = resolveAvailablePipelines({
      has_active_shift: true,
      has_active_production: true,
      has_active_break: false,
      has_running_additional_work: false,
      has_approved_unstarted_additional_work: false,
      operational_downtime_active: true,
      can_start_downtime: false,
      can_finish_downtime: true,
      can_finish_production: false
    });
    expect(operationalPipelines).toContain('FINISH_DOWNTIME');
    expect(operationalPipelines).toContain('START_BREAK');
    expect(operationalPipelines).not.toContain('START_DOWNTIME');
    expect(operationalPipelines).not.toContain('FINISH_PRODUCTION');

    const criticalPipelines = resolveAvailablePipelines({
      has_active_shift: true,
      has_active_production: true,
      has_active_break: false,
      has_running_additional_work: false,
      has_approved_unstarted_additional_work: false,
      operational_downtime_active: false,
      can_start_downtime: false,
      can_finish_downtime: true,
      can_finish_production: true
    });
    expect(criticalPipelines).toContain('FINISH_DOWNTIME');
    expect(criticalPipelines).toContain('FINISH_PRODUCTION');
    expect(criticalPipelines).toContain('START_BREAK');
    expect(criticalPipelines).not.toContain('START_DOWNTIME');
  });

  it('matches current PostgreSQL start preconditions for concurrent employee states', () => {
    const activeProduction = resolveAvailablePipelines({
      has_active_shift: true,
      has_active_production: true,
      has_active_break: false,
      has_running_additional_work: false,
      has_approved_unstarted_additional_work: false,
      operational_downtime_active: false,
      can_start_downtime: true,
      can_finish_downtime: false,
      can_finish_production: true
    });
    expect(activeProduction).toContain('START_BREAK');
    expect(activeProduction).toContain('START_DOWNTIME');

    const activeBreakWithoutProduction = resolveAvailablePipelines({
      has_active_shift: true,
      has_active_production: false,
      has_active_break: true,
      has_running_additional_work: false,
      has_approved_unstarted_additional_work: true,
      operational_downtime_active: false,
      can_start_downtime: true,
      can_finish_downtime: false,
      can_finish_production: false
    });
    expect(activeBreakWithoutProduction).toContain('FINISH_BREAK');
    expect(activeBreakWithoutProduction).toContain('START_PRODUCTION');
    expect(activeBreakWithoutProduction).toContain('START_DOWNTIME');
    expect(activeBreakWithoutProduction).not.toContain('START_BREAK');
    expect(activeBreakWithoutProduction).not.toContain('START_ADDITIONAL_WORK');

    const runningAdditionalWork = resolveAvailablePipelines({
      has_active_shift: true,
      has_active_production: false,
      has_active_break: false,
      has_running_additional_work: true,
      has_approved_unstarted_additional_work: true,
      operational_downtime_active: false,
      can_start_downtime: true,
      can_finish_downtime: false,
      can_finish_production: false
    });
    expect(runningAdditionalWork).toContain('FINISH_ADDITIONAL_WORK');
    expect(runningAdditionalWork).toContain('START_PRODUCTION');
    expect(runningAdditionalWork).toContain('START_DOWNTIME');
    expect(runningAdditionalWork).not.toContain('START_BREAK');
    expect(runningAdditionalWork).not.toContain('START_ADDITIONAL_WORK');
  });

  it('does not expose START_ADDITIONAL_WORK while mutation preconditions would reject it', () => {
    expect(
      resolveAvailablePipelines({
        has_active_shift: true,
        has_active_production: true,
        has_active_break: false,
        has_running_additional_work: false,
        has_approved_unstarted_additional_work: true,
        operational_downtime_active: false,
        can_start_downtime: true,
        can_finish_downtime: false,
        can_finish_production: true
      })
    ).not.toContain('START_ADDITIONAL_WORK');

    expect(
      resolveAvailablePipelines({
        has_active_shift: true,
        has_active_production: false,
        has_active_break: true,
        has_running_additional_work: false,
        has_approved_unstarted_additional_work: true,
        operational_downtime_active: false,
        can_start_downtime: false,
        can_finish_downtime: false,
        can_finish_production: false
      })
    ).not.toContain('START_ADDITIONAL_WORK');

    expect(
      resolveAvailablePipelines({
        has_active_shift: true,
        has_active_production: false,
        has_active_break: false,
        has_running_additional_work: true,
        has_approved_unstarted_additional_work: true,
        operational_downtime_active: false,
        can_start_downtime: false,
        can_finish_downtime: false,
        can_finish_production: false
      })
    ).not.toContain('START_ADDITIONAL_WORK');

    expect(
      resolveAvailablePipelines({
        has_active_shift: true,
        has_active_production: false,
        has_active_break: false,
        has_running_additional_work: false,
        has_approved_unstarted_additional_work: true,
        operational_downtime_active: false,
        can_start_downtime: true,
        can_finish_downtime: false,
        can_finish_production: false
      })
    ).toContain('START_ADDITIONAL_WORK');
  });

  it('keeps higher-priority operational downtime available when a break is active', () => {
    const input = {
      has_active_shift: true,
      has_active_production: true,
      has_active_break: true,
      has_running_additional_work: false,
      has_approved_unstarted_additional_work: false,
      operational_downtime_active: true,
      can_start_downtime: false,
      can_finish_downtime: true,
      can_finish_production: false
    };
    const blockers = resolveFinishShiftBlockers(input);
    const pipelines = resolveAvailablePipelines(input);

    expect(blockers).toEqual(['OPERATIONAL_DOWNTIME', 'BREAK', 'PRODUCTION']);
    expect(resolveFinishShiftNextPipeline(blockers, [])).toBe('FINISH_DOWNTIME');
    expect(pipelines).toContain('FINISH_DOWNTIME');
    expect(pipelines).toContain('FINISH_BREAK');
    expect(pipelines).not.toContain('START_DOWNTIME');
    expect(pipelines).not.toContain('FINISH_PRODUCTION');
  });

  it('keeps higher-priority operational downtime available when additional work is active', () => {
    const input = {
      has_active_shift: true,
      has_active_production: true,
      has_active_break: false,
      has_running_additional_work: true,
      has_approved_unstarted_additional_work: false,
      operational_downtime_active: true,
      can_start_downtime: false,
      can_finish_downtime: true,
      can_finish_production: false
    };
    const blockers = resolveFinishShiftBlockers(input);
    const pipelines = resolveAvailablePipelines(input);

    expect(blockers).toEqual(['OPERATIONAL_DOWNTIME', 'ADDITIONAL_WORK', 'PRODUCTION']);
    expect(resolveFinishShiftNextPipeline(blockers, [])).toBe('FINISH_DOWNTIME');
    expect(pipelines).toContain('FINISH_DOWNTIME');
    expect(pipelines).toContain('FINISH_ADDITIONAL_WORK');
    expect(pipelines).not.toContain('START_DOWNTIME');
    expect(pipelines).not.toContain('START_PRODUCTION');
    expect(pipelines).not.toContain('START_BREAK');
  });

  it('keeps critical linked downtime and break on their accepted priorities', () => {
    const input = {
      has_active_shift: true,
      has_active_production: true,
      has_active_break: true,
      has_running_additional_work: false,
      has_approved_unstarted_additional_work: false,
      operational_downtime_active: false,
      can_start_downtime: false,
      can_finish_downtime: true,
      can_finish_production: false
    };
    const blockers = resolveFinishShiftBlockers(input);
    const pipelines = resolveAvailablePipelines(input);

    expect(blockers).toEqual(['BREAK', 'PRODUCTION']);
    expect(resolveFinishShiftNextPipeline(blockers, [])).toBe('FINISH_BREAK');
    expect(pipelines).toContain('FINISH_DOWNTIME');
    expect(pipelines).toContain('FINISH_BREAK');
    expect(pipelines).not.toContain('START_DOWNTIME');
    expect(pipelines).not.toContain('FINISH_PRODUCTION');
  });

  it('uses accepted machine ui status precedence', () => {
    expect(
      resolveMachineUiStatus({
        is_available_for_operations: false,
        is_decommissioned: false,
        is_available_for_start: true,
        is_running_status: false,
        is_downtime_status: false,
        is_broken_status: false,
        has_open_production: false,
        has_open_downtime: false,
        has_open_critical_downtime: false
      })
    ).toBe('unavailable');
    expect(
      resolveMachineUiStatus({
        is_available_for_operations: true,
        is_decommissioned: false,
        is_available_for_start: false,
        is_running_status: false,
        is_downtime_status: true,
        is_broken_status: false,
        has_open_production: false,
        has_open_downtime: true,
        has_open_critical_downtime: true
      })
    ).toBe('critical');
  });

  it('derives additional-work groups and actions in the shared resolver', () => {
    const resolved = resolveAdditionalWorkState([
      {
        additional_work_id: '1',
        additional_work_type_id: '10',
        display_name: 'Run',
        assigned_by_employee_id: '7',
        employee_id: '7',
        is_pending: false,
        is_approved: true,
        started_at: '2026-06-09T08:00:00.000Z'
      },
      {
        additional_work_id: '2',
        additional_work_type_id: '20',
        display_name: 'Approved',
        assigned_by_employee_id: '9',
        employee_id: '7',
        is_pending: false,
        is_approved: true,
        started_at: null
      },
      {
        additional_work_id: '3',
        additional_work_type_id: '30',
        display_name: 'Pending',
        assigned_by_employee_id: '7',
        employee_id: '7',
        is_pending: true,
        is_approved: false,
        started_at: null
      }
    ]);

    expect(resolved.active_additional_works[0]).toMatchObject({
      ui_group: 'ACTIVE',
      ui_color_token: 'green',
      action: 'FINISH_ADDITIONAL_WORK'
    });
    expect(resolved.approved_additional_works[0]).toMatchObject({
      origin: 'MANAGER_ASSIGNED',
      ui_group: 'APPROVED',
      ui_color_token: 'gray_green',
      action: 'START_ADDITIONAL_WORK'
    });
    expect(resolved.pending_approval_additional_works[0]).toMatchObject({
      ui_group: 'PENDING_APPROVAL',
      ui_color_token: 'white_gray_inactive',
      action: null
    });
  });
});

describe('operator workplace state read model', () => {
  it('returns exact wrapper fields for no-shift state', async () => {
    const result = await getOperatorWorkplaceState(createPool([[workplaceRow()]]), actor);
    expect(Object.keys(result).sort()).toEqual([
      'actor_employee_id',
      'actor_full_name',
      'additional_work_start',
      'additional_work_summary',
      'available_pipelines',
      'break',
      'downtime',
      'finish_shift',
      'production',
      'salary',
      'shift'
    ]);
    expect(result.actor_employee_id).toBe('7');
    expect(result.actor_full_name).toBe('Иванов Иван Иванович');
    expect(result.shift.is_active).toBe(false);
    expect(result.finish_shift).toEqual({
      can_finish_now: false,
      blockers: [],
      warnings: [],
      next_required_pipeline: null
    });
    expect(result.additional_work_start.blockers).toEqual(['NO_OPEN_SHIFT']);
    expect(result.available_pipelines).toEqual(['START_SHIFT', 'VIEW_SALARY']);
    expect(result.available_pipelines).not.toContain('FINISH_SHIFT');
  });

  it('publishes deterministic typed additional-work start blockers', () => {
    const all = {
      has_active_shift: false,
      has_active_production: true,
      has_active_break: true,
      has_running_additional_work: true,
      has_approved_unstarted_additional_work: true,
      operational_downtime_active: false,
      can_start_downtime: false,
      can_finish_downtime: false,
      can_finish_production: false
    };
    expect(resolveAdditionalWorkStartBlockers(all)).toEqual([
      'NO_OPEN_SHIFT',
      'ACTIVE_PRODUCTION',
      'ACTIVE_BREAK',
      'OTHER_ADDITIONAL_WORK_RUNNING'
    ]);
    expect(resolveAvailablePipelines(all)).not.toContain('START_ADDITIONAL_WORK');
    expect(resolveAdditionalWorkStartBlockers({ ...all, has_active_shift: true, has_active_production: false,
      has_active_break: false, has_running_additional_work: false })).toEqual([]);
  });

  it('maps active production state and accepted available pipeline tokens', async () => {
    const result = await getOperatorWorkplaceState(
      createPool([
        [
          workplaceRow({
            employee_shift_id: '11',
            shift_started_at: '2026-06-09T08:00:00.000Z',
            production_operation_id: '22',
            production_machine_id: '33',
            production_machine_name: 'Machine A',
            sku_id: '44',
            sku_code: 'SKU-1',
            sku_name: null
          })
        ]
      ]),
      actor
    );
    expect(result.production).toMatchObject({
      is_active: true,
      production_operation_id: '22',
      machine_id: '33',
      machine_name: 'Machine A',
      sku_id: '44',
      sku_code: 'SKU-1',
      sku_name: 'SKU-1',
      can_finish_production: true
    });
    expect(result.available_pipelines).toContain('FINISH_PRODUCTION');
    expect(result.available_pipelines).toContain('START_DOWNTIME');
    expect(result.available_pipelines).toContain('START_BREAK');
  });

  it('does not offer START_ADDITIONAL_WORK with active production plus approved unstarted work', async () => {
    const result = await getOperatorWorkplaceState(
      createPool([
        [
          workplaceRow({
            employee_shift_id: '11',
            shift_started_at: '2026-06-09T08:00:00.000Z',
            production_operation_id: '22',
            production_machine_id: '33',
            production_machine_name: 'Machine A',
            sku_id: '44',
            sku_code: 'SKU-1',
            sku_name: 'Part',
            approved_unstarted_count: '1'
          })
        ]
      ]),
      actor
    );

    expect(result.available_pipelines).toContain('FINISH_PRODUCTION');
    expect(result.available_pipelines).toContain('START_DOWNTIME');
    expect(result.available_pipelines).toContain('START_BREAK');
    expect(result.finish_shift.warnings).toEqual(['APPROVED_ADDITIONAL_WORKS_NOT_STARTED']);
    expect(result.available_pipelines).not.toContain('START_ADDITIONAL_WORK');
  });

  it('creates OPERATIONAL_DOWNTIME blocker for linked operational downtime', async () => {
    const result = await getOperatorWorkplaceState(
      createPool([
        [
          workplaceRow({
            employee_shift_id: '11',
            production_operation_id: '22',
            production_machine_id: '33',
            production_machine_name: 'Machine A',
            sku_id: '44',
            sku_code: 'SKU-1',
            sku_name: 'Part',
            linked_downtime_id: '55',
            linked_downtime_production_operation_id: '22',
            linked_downtime_machine_id: '33',
            linked_downtime_machine_name: 'Machine A',
            linked_downtime_type_id: '66',
            linked_downtime_type_name: 'Any display',
            linked_downtime_class: 'OPERATIONAL'
          })
        ]
      ]),
      actor
    );
    expect(result.downtime.slot_state).toBe('OPERATIONAL_ACTIVE');
    expect(result.downtime.can_finish_downtime).toBe(true);
    expect(result.downtime.can_start_downtime).toBe(false);
    expect(result.finish_shift.blockers).toContain('OPERATIONAL_DOWNTIME');
    expect(result.finish_shift.warnings).toEqual([]);
    expect(result.finish_shift.next_required_pipeline).toBe('FINISH_DOWNTIME');
    expect(result.production.can_finish_production).toBe(false);
    expect(result.available_pipelines).toContain('FINISH_DOWNTIME');
    expect(result.available_pipelines).toContain('START_BREAK');
    expect(result.available_pipelines).not.toContain('START_DOWNTIME');
    expect(result.available_pipelines).not.toContain('FINISH_PRODUCTION');
  });

  it('projects operational downtime plus active break without hiding FINISH_DOWNTIME', async () => {
    const result = await getOperatorWorkplaceState(
      createPool([
        [
          workplaceRow({
            employee_shift_id: '11',
            production_operation_id: '22',
            production_machine_id: '33',
            production_machine_name: 'Machine A',
            sku_id: '44',
            sku_code: 'SKU-1',
            sku_name: 'Part',
            linked_downtime_id: '55',
            linked_downtime_production_operation_id: '22',
            linked_downtime_machine_id: '33',
            linked_downtime_machine_name: 'Machine A',
            linked_downtime_type_id: '66',
            linked_downtime_type_name: 'Operational',
            linked_downtime_class: 'OPERATIONAL',
            operator_break_id: '77',
            break_type_id: '88',
            break_type_name: 'Break'
          })
        ]
      ]),
      actor
    );

    expect(result.downtime.slot_state).toBe('OPERATIONAL_ACTIVE');
    expect(result.downtime.can_finish_downtime).toBe(true);
    expect(result.downtime.can_start_downtime).toBe(false);
    expect(result.finish_shift.blockers).toEqual(['OPERATIONAL_DOWNTIME', 'BREAK', 'PRODUCTION']);
    expect(result.finish_shift.next_required_pipeline).toBe('FINISH_DOWNTIME');
    expect(result.available_pipelines).toContain('FINISH_DOWNTIME');
    expect(result.available_pipelines).toContain('FINISH_BREAK');
    expect(result.available_pipelines).not.toContain('START_DOWNTIME');
    expect(result.available_pipelines).not.toContain('FINISH_PRODUCTION');
  });

  it('does not make linked critical downtime a finish-shift blocker', async () => {
    const result = await getOperatorWorkplaceState(
      createPool([
        [
          workplaceRow({
            employee_shift_id: '11',
            production_operation_id: '22',
            production_machine_id: '33',
            production_machine_name: 'Machine A',
            sku_id: '44',
            sku_code: 'SKU-1',
            sku_name: 'Part',
            linked_downtime_id: '55',
            linked_downtime_production_operation_id: '22',
            linked_downtime_class: 'CRITICAL'
          })
        ]
      ]),
      actor
    );
    expect(result.downtime.slot_state).toBe('CRITICAL_ACTIVE');
    expect(result.downtime.can_finish_downtime).toBe(true);
    expect(result.production.can_finish_production).toBe(true);
    expect(result.finish_shift.blockers).toEqual(['PRODUCTION']);
    expect(result.finish_shift.warnings).toEqual([]);
    expect(result.finish_shift.next_required_pipeline).toBe('FINISH_PRODUCTION');
    expect(result.finish_shift.blockers).not.toContain('OPERATIONAL_DOWNTIME');
    expect(result.available_pipelines).toContain('FINISH_DOWNTIME');
    expect(result.available_pipelines).toContain('FINISH_PRODUCTION');
    expect(result.available_pipelines).toContain('START_BREAK');
  });

  it('blocks self production finish during active break while preserving runtime-allowed start actions', async () => {
    const result = await getOperatorWorkplaceState(
      createPool([[
        workplaceRow({
          employee_shift_id: '11',
          production_operation_id: '22',
          production_machine_id: '33',
          production_machine_name: 'Machine A',
          sku_id: '44',
          sku_code: 'SKU-1',
          sku_name: 'Part',
          operator_break_id: '77',
          break_type_id: '88',
          break_type_name: 'Break'
        })
      ]]),
      actor
    );

    expect(result.production.can_finish_production).toBe(false);
    expect(result.available_pipelines).toContain('FINISH_BREAK');
    expect(result.available_pipelines).toContain('START_DOWNTIME');
    expect(result.available_pipelines).not.toContain('FINISH_PRODUCTION');
  });

  it('excludes machine-level critical downtime without production operation from operator-active slot', async () => {
    const workplace = await getOperatorWorkplaceState(
      createPool([[workplaceRow({ employee_shift_id: '11' })]]),
      actor
    );
    expect(workplace.downtime.slot_state).toBe('NONE');
    expect(workplace.downtime.downtime_id).toBeNull();
    expect(workplace.downtime.can_finish_downtime).toBe(false);
    expect(workplace.finish_shift.blockers).toEqual([]);
    expect(workplace.finish_shift.warnings).toEqual([]);
    expect(workplace.available_pipelines).not.toContain('FINISH_DOWNTIME');

    const machines = await getOperatorMachines(
      createPool([
        [
          {
            machine_id: '33',
            machine_name: 'Machine A',
            workshop_name: 'Workshop',
            machine_status: 'Display',
            machine_use_status: 'Use',
            is_available_for_operations: true,
            is_decommissioned: false,
            is_available_for_start: true,
            is_running_status: false,
            is_downtime_status: false,
            is_broken_status: false,
            has_open_production: false,
            has_open_production_by_actor: false,
            has_open_downtime: true,
            has_open_critical_downtime: true
          }
        ]
      ]),
      actor
    );
    expect(machines.machines[0]).toMatchObject({
      machine_id: '33',
      ui_status_token: 'critical',
      is_selectable_for_production: false,
      is_selectable_for_critical_downtime: false
    });
  });

  it('sets break and running additional work blockers without warning for pending work', async () => {
    const result = await getOperatorWorkplaceState(
      createPool([
        [
          workplaceRow({
            employee_shift_id: '11',
            operator_break_id: '77',
            break_type_id: '88',
            break_type_name: 'Break',
            active_additional_work_id: '99',
            approved_unstarted_count: '0'
          })
        ]
      ]),
      actor
    );
    expect(result.break.can_finish_break).toBe(true);
    expect(result.additional_work_summary.has_active_additional_work).toBe(true);
    expect(result.finish_shift.blockers).toEqual(['BREAK', 'ADDITIONAL_WORK']);
    expect(result.finish_shift.warnings).toEqual([]);
  });
});

describe('operator additional work state read model', () => {
  it('groups only active approved and pending work without historical group', async () => {
    const result = await getOperatorAdditionalWorkState(
      createPool([
        [
          {
            additional_work_id: '1',
            additional_work_type_id: '10',
            display_name: 'Run',
            assigned_by_employee_id: '7',
            employee_id: '7',
            is_pending: false,
            is_approved: true,
            started_at: '2026-06-09T08:00:00.000Z',
            finished_at: null,
            cancelled_at: null,
            is_assignment_finished: false
          },
          {
            additional_work_id: '2',
            additional_work_type_id: '20',
            display_name: 'Approved',
            assigned_by_employee_id: '9',
            employee_id: '7',
            is_pending: false,
            is_approved: true,
            started_at: null,
            finished_at: null,
            cancelled_at: null,
            is_assignment_finished: false
          },
          {
            additional_work_id: '3',
            additional_work_type_id: '30',
            display_name: 'Pending',
            assigned_by_employee_id: '7',
            employee_id: '7',
            is_pending: true,
            is_approved: false,
            started_at: null,
            finished_at: null,
            cancelled_at: null,
            is_assignment_finished: false
          }
        ]
      ]),
      actor
    );
    expect(result.active_additional_works[0]).toMatchObject({
      ui_group: 'ACTIVE',
      ui_color_token: 'green',
      action: 'FINISH_ADDITIONAL_WORK'
    });
    expect(result.approved_additional_works[0]).toMatchObject({
      origin: 'MANAGER_ASSIGNED',
      ui_group: 'APPROVED',
      ui_color_token: 'gray_green',
      action: 'START_ADDITIONAL_WORK'
    });
    expect(result.pending_approval_additional_works[0]).toMatchObject({
      ui_group: 'PENDING_APPROVAL',
      ui_color_token: 'white_gray_inactive',
      action: null
    });
    expect(result).not.toHaveProperty('historical_additional_works');
  });
});

describe('operator dictionary and salary read models', () => {
  it('returns available downtime types with accepted comment and operation requirements', async () => {
    const resultWithoutProduction = await getAvailableDowntimeTypes(
      createPool([
        [],
        [
          {
            downtime_type_id: '1',
            display_name: 'Operational display',
            downtime_class: 'OPERATIONAL',
            ui_color_token: 'yellow',
            requires_production_operation: true,
            operator_requires_start_comment: false
          },
          {
            downtime_type_id: '2',
            display_name: 'Critical display',
            downtime_class: 'CRITICAL',
            ui_color_token: 'scarlet',
            requires_production_operation: false,
            operator_requires_start_comment: true
          }
        ]
      ]),
      actor
    );
    expect(resultWithoutProduction.active_production_operation_id).toBeNull();
    expect(resultWithoutProduction.available_downtime_types).toEqual([
      {
        downtime_type_id: '2',
        display_name: 'Critical display',
        downtime_class: 'CRITICAL',
        ui_color_token: 'scarlet',
        requires_production_operation: false,
        requires_comment: true
      }
    ]);

    const resultWithProduction = await getAvailableDowntimeTypes(
      createPool([
        [{ production_operation_id: '22' }],
        [
          {
            downtime_type_id: '1',
            display_name: 'Operational display',
            downtime_class: 'OPERATIONAL',
            ui_color_token: 'yellow',
            requires_production_operation: true,
            operator_requires_start_comment: false
          }
        ]
      ]),
      actor
    );
    expect(resultWithProduction.available_downtime_types[0]).toMatchObject({
      downtime_class: 'OPERATIONAL',
      ui_color_token: 'yellow',
      requires_production_operation: true,
      requires_comment: false
    });
  });

  it('returns machine list and exact QR not-found shape', async () => {
    const machines = await getOperatorMachines(
      createPool([
        [
          {
            machine_id: '1',
            machine_name: 'Machine',
            workshop_name: 'Workshop',
            machine_status: 'Display',
            machine_use_status: 'Use',
            is_available_for_operations: true,
            is_decommissioned: false,
            is_available_for_start: true,
            is_running_status: false,
            is_downtime_status: false,
            is_broken_status: false,
            has_open_production: false,
            has_open_production_by_actor: false,
            has_open_downtime: false,
            has_open_critical_downtime: false,
            active_production_employee_full_name: null
          }
        ]
      ]),
      actor
    );
    expect(machines.machines[0]).toMatchObject({
      machine_id: '1',
      is_selectable_for_production: true,
      is_selectable_for_critical_downtime: true,
      ui_status_token: 'normal'
    });

    const notFound: MachineQrLookupResponse = await getOperatorMachineByQr(createPool([[]]), actor, 'missing');
    expect(notFound).toEqual({ found: false, error_code: 'MACHINE_QR_NOT_FOUND' });
  });

  it('resolves active and inactive SKU QR projections without exposing tokens', async () => {
    const base = {
      sku_id: '44', sku_code: 'SKU-1', sku_name: null, sku_unit_name: 'шт.',
      current_sku_tariff_uzs: '12.5', is_active: true, sku_unit_is_active: true
    };
    const active: SkuQrLookupResponse = await getOperatorSkuByQr(createPool([[base]]), 'token');
    expect(active).toMatchObject({
      found: true,
      sku: { sku_name: 'SKU-1', is_selectable_for_production: true, production_unavailability: null }
    });
    expect(JSON.stringify(active)).not.toContain('token');

    const inactive = await getOperatorSkuByQr(createPool([[{ ...base, sku_unit_is_active: false }]]), 'token');
    expect(inactive).toMatchObject({
      found: true,
      sku: { is_selectable_for_production: false, production_unavailability: { code: 'SKU_INACTIVE' } }
    });
    await expect(getOperatorSkuByQr(createPool([[]]), 'missing')).resolves.toEqual({
      found: false,
      error_code: 'SKU_QR_NOT_FOUND'
    });
  });

  it('explains occupied and broken QR machines from authoritative read state', async () => {
    const base = {
      machine_id: '1', machine_name: 'Machine', workshop_name: 'Workshop',
      machine_status: 'Running', machine_use_status: 'Use',
      is_available_for_operations: true, is_decommissioned: false, is_available_for_start: false,
      is_running_status: true, is_downtime_status: false, is_broken_status: false,
      has_open_production: true, has_open_production_by_actor: false,
      has_open_downtime: false, has_open_critical_downtime: false,
      active_production_employee_full_name: 'Петров Пётр Сергеевич'
    };
    const occupied = await getOperatorMachineByQr(createPool([[base]]), actor, 'occupied');
    expect(occupied).toMatchObject({
      found: true,
      machine: {
        is_selectable_for_production: false,
        production_unavailability: {
          code: 'OCCUPIED_BY_OPERATOR',
          operator_full_name: 'Петров Пётр Сергеевич'
        }
      }
    });

    const broken = await getOperatorMachineByQr(createPool([[
      {
        ...base,
        machine_status: 'Broken',
        is_running_status: false,
        is_broken_status: true,
        has_open_production: false,
        active_production_employee_full_name: null
      }
    ]]), actor, 'broken');
    expect(broken).toMatchObject({
      found: true,
      machine: {
        is_selectable_for_production: false,
        production_unavailability: { code: 'MACHINE_BROKEN' }
      }
    });
  });

  it('allows critical downtime only on idle or actor-owned production machines', async () => {
    const base = {
      workshop_name: 'Workshop', machine_status: 'Running', machine_use_status: 'Use',
      is_available_for_operations: true, is_decommissioned: false, is_available_for_start: false,
      is_running_status: true, is_downtime_status: false, is_broken_status: false,
      has_open_production: true, has_open_downtime: false, has_open_critical_downtime: false,
    };
    const machines = await getOperatorMachines(
      createPool([[
        { ...base, machine_id: '1', machine_name: 'Own machine', has_open_production_by_actor: true },
        { ...base, machine_id: '2', machine_name: 'Other operator machine', has_open_production_by_actor: false },
        {
          ...base, machine_id: '3', machine_name: 'Idle machine', is_available_for_start: true,
          is_running_status: false, has_open_production: false, has_open_production_by_actor: false,
        },
      ]]),
      actor,
    );

    expect(machines.machines.map((machine) => [
      machine.machine_id,
      machine.is_selectable_for_critical_downtime,
    ])).toEqual([
      ['1', true],
      ['2', false],
      ['3', true],
    ]);
  });

  it('returns exact skus, break type, and additional work type wrappers', async () => {
    await expect(
      getOperatorSkus(
        createPool([
          [
            {
              sku_id: '1',
              sku_code: 'SKU',
              sku_name: 'Part',
              sku_unit_name: 'pcs',
              current_sku_tariff_uzs: '100.0000',
              is_active: true
            }
          ]
        ])
      )
    ).resolves.toEqual({
      skus: [
        {
          sku_id: '1',
          sku_code: 'SKU',
          sku_name: 'Part',
          sku_unit_name: 'pcs',
          current_sku_tariff_uzs: 100,
          is_active: true
        }
      ]
    });

    await expect(
      getOperatorBreakTypes(createPool([[{ break_type_id: '1', display_name: 'Break' }]]))
    ).resolves.toEqual({ break_types: [{ break_type_id: '1', display_name: 'Break' }] });

    await expect(
      getAvailableAdditionalWorkTypes(
        createPool([[{ additional_work_type_id: '10', display_name: 'Packing' }]]),
        actor
      )
    ).resolves.toEqual({
      additional_work_types: [{ additional_work_type_id: '10', display_name: 'Packing' }]
    });
  });

  it('normalizes nullable DB sku names and preserves nullable numeric tariff', async () => {
    await expect(
      getOperatorSkus(
        createPool([
          [
            {
              sku_id: '1',
              sku_code: 'SKU-FALLBACK',
              sku_name: null,
              sku_unit_name: 'pcs',
              current_sku_tariff_uzs: null,
              is_active: true
            }
          ]
        ])
      )
    ).resolves.toEqual({
      skus: [
        {
          sku_id: '1',
          sku_code: 'SKU-FALLBACK',
          sku_name: 'SKU-FALLBACK',
          sku_unit_name: 'pcs',
          current_sku_tariff_uzs: null,
          is_active: true
        }
      ]
    });
  });

  it('preserves accepted nullable display/read fields', async () => {
    const machines = await getOperatorMachines(
      createPool([
        [
          {
            machine_id: '1',
            machine_name: 'Machine',
            workshop_name: null,
            machine_status: null,
            machine_use_status: null,
            is_available_for_operations: true,
            is_decommissioned: false,
            is_available_for_start: true,
            is_running_status: false,
            is_downtime_status: false,
            is_broken_status: false,
            has_open_production: false,
            has_open_production_by_actor: false,
            has_open_downtime: false,
            has_open_critical_downtime: false
          }
        ]
      ]),
      actor
    );
    expect(machines.machines[0]).toMatchObject({
      workshop_name: null,
      machine_status: null,
      machine_use_status: null
    });

    const skus = await getOperatorSkus(
      createPool([
        [
          {
            sku_id: '1',
            sku_code: 'SKU-FALLBACK',
            sku_name: null,
            sku_unit_name: null,
            current_sku_tariff_uzs: null,
            is_active: true
          }
        ]
      ])
    );
    expect(skus.skus[0]).toMatchObject({
      sku_name: 'SKU-FALLBACK',
      sku_unit_name: null,
      current_sku_tariff_uzs: null
    });
  });

  it('returns actor-scoped salary totals and history exact fields', async () => {
    await expect(
      getOperatorSalaryTotals(
        createPool([
          [
            {
              today_uzs: '10',
              week_uzs: '20',
              month_uzs: '30'
            }
          ]
        ]),
        actor
      )
    ).resolves.toEqual({
      employee_id: '7',
      totals: { today_uzs: 10, week_uzs: 20, month_uzs: 30 }
    });

    await expect(
      getOperatorSalaryHistory(
        createPool([
          [
            {
              month: '2026-06-01',
              total_uzs: '30',
              production_uzs: '11',
              additional_work_uzs: '12',
              corrections_uzs: '13',
              reversals_uzs: '-1'
            }
          ]
        ]),
        actor
      )
    ).resolves.toEqual({
      employee_id: '7',
      months: [
        {
          month: '2026-06-01',
          total_uzs: 30,
          production_uzs: 11,
          additional_work_uzs: 12,
          corrections_uzs: 13,
          reversals_uzs: -1
        }
      ]
    });
  });

  it('returns salary and tariff DTO numeric fields as numbers', async () => {
    const skus = await getOperatorSkus(
      createPool([
        [
          {
            sku_id: '1',
            sku_code: 'SKU',
            sku_name: 'Part',
            sku_unit_name: 'pcs',
            current_sku_tariff_uzs: '100.5000',
            is_active: true
          }
        ]
      ])
    );
    expect(typeof skus.skus[0]?.current_sku_tariff_uzs).toBe('number');
    expect(skus.skus[0]?.current_sku_tariff_uzs).toBe(100.5);

    const totals = await getOperatorSalaryTotals(
      createPool([
        [
          {
            today_uzs: '10.0000',
            week_uzs: '20.0000',
            month_uzs: '30.0000'
          }
        ]
      ]),
      actor
    );
    expect(Object.values(totals.totals).every((value) => typeof value === 'number')).toBe(true);
    expect(totals).not.toHaveProperty('breakdown');

    const history = await getOperatorSalaryHistory(
      createPool([
        [
          {
            month: '2026-06-01',
            total_uzs: '30.0000',
            production_uzs: '11.0000',
            additional_work_uzs: '12.0000',
            corrections_uzs: '13.0000',
            reversals_uzs: '-1.0000'
          }
        ]
      ]),
      actor
    );
    expect(
      Object.entries(history.months[0] ?? {})
        .filter(([key]) => key.endsWith('_uzs'))
        .every(([, value]) => typeof value === 'number')
    ).toBe(true);
  });

  it('keeps salary UZS DTO values integer-safe for MVP', async () => {
    await expect(
      getOperatorSalaryTotals(
        createPool([
          [
            {
              today_uzs: '10.5000',
              week_uzs: '20.0000',
              month_uzs: '30.0000'
            }
          ]
        ]),
        actor
      )
    ).rejects.toMatchObject({ statusCode: 500, code: 'database_error' });
  });
});

describe('operator read-model route candidate', () => {
  it('keeps route handlers thin and registers accepted paths', () => {
    const routeSource = readFileSync(new URL('../../src/routes/operatorReadModels.ts', import.meta.url), 'utf8');
    for (const path of [
      '/operator/workplace-state',
      '/operator/additional-work-state',
      '/operator/additional-work-types/available',
      '/operator/downtime-types/available',
      '/operator/machines',
      '/operator/machines/resolve-qr',
      '/operator/skus',
      '/operator/break-types',
      '/operator/salary',
      '/operator/salary/history'
    ]) {
      expect(routeSource).toContain(path);
    }
    expect(routeSource).not.toContain('/operator/machines/by-qr/');

    expect(routeSource).not.toMatch(/is_material_waiting|is_other|is_repair_required|is_setup_required/);
    expect(routeSource).not.toMatch(/OPERATIONAL_DOWNTIME|APPROVED_ADDITIONAL_WORKS_NOT_STARTED/);
  });

  it('keeps reusable read/query boundaries outside operator projection', () => {
    const operatorSource = readFileSync(new URL('../../src/readModels/operatorReadModels.ts', import.meta.url), 'utf8');
    const sharedQuerySource = readFileSync(new URL('../../src/readModels/sharedQueries.ts', import.meta.url), 'utf8');

    for (const functionName of [
      'readEmployeeWorkplaceSnapshot',
      'readEmployeeAdditionalWorkStateRows',
      'readOperatorAvailableAdditionalWorkTypeRows',
      'readEmployeeActiveProduction',
      'readActiveDowntimeTypes',
      'readMachineStateRows',
      'readActiveSkuRows',
      'readActiveBreakTypeRows',
      'readEmployeeSalaryTotals',
      'readEmployeeSalaryHistory'
    ]) {
      expect(sharedQuerySource).toContain(`function ${functionName}`);
      expect(operatorSource).toContain(functionName);
    }

    const domainStateSource = readFileSync(new URL('../../src/readModels/domainState.ts', import.meta.url), 'utf8');

    expect(operatorSource).not.toMatch(/from app\.employee_shifts|from app\.machine_downtimes|from app\.salary_summary/);
    expect(operatorSource).not.toMatch(/resolveFinishShiftBlockers|resolveDowntimeClass|resolveMachineUiStatus/);
    expect(operatorSource).not.toMatch(/row\.is_approved|row\.is_pending|assigned_by_employee_id === row\.employee_id/);
    expect(domainStateSource).toContain('resolveAdditionalWorkState');
    expect(domainStateSource).toContain('resolveEmployeeWorkplaceState');
    expect(sharedQuerySource).toContain('join active_production ap on ap.production_machine_id = md.machine_id::text');
    expect(sharedQuerySource).toContain('po.employee_id = $1');
    expect(domainStateSource).toContain('row.has_open_production_by_actor');
  });

  it('does not expose forbidden DTO groups or generic tokens in workplace response', async () => {
    const result: OperatorWorkplaceStateResponse = await getOperatorWorkplaceState(createPool([[workplaceRow()]]), actor);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('HISTORICAL');
    expect(serialized).not.toContain('ACTIVE_DOWNTIME');
    expect(serialized).not.toContain('DANGER');
    expect(serialized).not.toContain('SUCCESS');
  });

  it('keeps exact accepted token literals and excludes forbidden legacy tokens from source', () => {
    const source = [
      readFileSync(new URL('../../src/readModels/types.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../../src/readModels/resolvers.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../../src/readModels/operatorReadModels.ts', import.meta.url), 'utf8')
    ].join('\n');

    for (const token of [
      'OPERATIONAL',
      'CRITICAL',
      'NONE',
      'OPERATIONAL_ACTIVE',
      'CRITICAL_ACTIVE',
      'ACTIVE',
      'APPROVED',
      'PENDING_APPROVAL',
      'OPERATIONAL_DOWNTIME',
      'BREAK',
      'ADDITIONAL_WORK',
      'PRODUCTION',
      'APPROVED_ADDITIONAL_WORKS_NOT_STARTED',
      'START_SHIFT',
      'FINISH_SHIFT',
      'START_PRODUCTION',
      'FINISH_PRODUCTION',
      'START_DOWNTIME',
      'FINISH_DOWNTIME',
      'START_BREAK',
      'FINISH_BREAK',
      'OPEN_ADDITIONAL_WORK',
      'START_ADDITIONAL_WORK',
      'FINISH_ADDITIONAL_WORK',
      'REQUEST_ADDITIONAL_WORK',
      'VIEW_SALARY'
    ]) {
      expect(source).toContain(token);
    }

    for (const forbidden of [
      'NO_DOWNTIME',
      'ACTIVE_CRITICAL_DOWNTIME',
      'ACTIVE_OPERATIONAL_DOWNTIME',
      'APPROVED_NOT_STARTED',
      'HAS_PENDING_ADDITIONAL_WORK',
      'CAN_FINISH_SHIFT',
      'FINISH_PRODUCTION_FIRST',
      'BLOCKED_BY_BACKEND_STATE'
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('does not classify read-model tokens from localized names or numeric ids', () => {
    const resolverSource = readFileSync(new URL('../../src/readModels/resolvers.ts', import.meta.url), 'utf8');
    expect(resolverSource).not.toMatch(/downtime_type_name|machine_downtime_type_name|machine_status_id|machine_use_status_id/);
    expect(resolverSource).not.toMatch(/display_name.*OPERATIONAL|display_name.*CRITICAL/);
  });
});

describe('salary query date boundaries', () => {
  it('excludes future ledger rows from current totals and history', () => {
    const source = readFileSync(new URL('../../src/readModels/sharedQueries.ts', import.meta.url), 'utf8');
    const upperBounds = source.match(/event_date <= timezone\('Asia\/Tashkent', now\(\)\)::date/g) ?? [];
    expect(upperBounds).toHaveLength(3);
  });
});

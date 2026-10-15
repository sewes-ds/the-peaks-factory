import { describe, expect, it } from 'vitest';
import type { ActorContext } from '../../src/auth/actorContext.js';
import { ApiError } from '../../src/db/errors.js';
import type { DbPool } from '../../src/db/pool.js';
import {
  formatElapsedMinutesClock,
  getManagerAdditionalWorks,
  getManagerAdditionalWorkTypesAvailable,
  getManagerDowntimes,
  getManagerEmployeeCard,
  getManagerEmployeeSalary,
  getManagerEmployeeSalaryHistory,
  getManagerEmployees,
  getManagerMachineCard,
  getManagerMachines,
  getManagerOpenTasks,
  getManagerWorkplaceState,
  resolveManagerDowntimeItem,
  resolveManagerAdditionalWorkItem,
  resolveManagerCanonicalOpenTaskSourceItem,
  resolveManagerEmployeeListItem,
  resolveManagerMachineListItem,
  resolveManagerOpenTaskItem,
  resolveManagerWorkplaceState
} from '../../src/readModels/managerReadModels.js';
import type {
  ManagerAdditionalWorkRow,
  ManagerCanonicalOpenTaskSourceRow,
  ManagerEmployeeReadModelRow,
  ManagerMachineReadModelRow,
  ManagerOpenTaskRow,
  ManagerWorkplaceStateRow
} from '../../src/readModels/sharedQueries.js';

const managerActor: ActorContext = {
  employeeId: 2n,
  telegramUserId: 2000n
};

function managerRow(overrides: Partial<ManagerWorkplaceStateRow> = {}): ManagerWorkplaceStateRow {
  return {
    manager_employee_id: '2',
    manager_full_name: 'Production Manager',
    machine_running_count: '3',
    machine_downtime_count: '2',
    machine_idle_count: '4',
    machine_critical_downtime_count: '1',
    machine_operational_downtime_count: '1',
    employee_open_shift_count: '10',
    employee_production_active_clear_count: '3',
    employee_production_break_count: '2',
    employee_production_downtime_count: '1',
    employee_production_critical_downtime_count: '0',
    employee_production_operational_downtime_count: '1',
    employee_additional_work_active_clear_count: '2',
    employee_additional_work_break_count: '1',
    employee_open_shift_without_work_count: '4',
    downtime_critical_count: '1',
    downtime_operational_count: '1',
    additional_work_requested_count: '5',
    additional_work_approved_count: '6',
    additional_work_active_count: '7',
    open_tasks_count: '8',
    ...overrides
  } as ManagerWorkplaceStateRow;
}

function managerIdentityRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    manager_employee_id: '2',
    manager_full_name: 'Production Manager',
    ...overrides
  };
}

function machineRow(overrides: Partial<ManagerMachineReadModelRow> = {}): ManagerMachineReadModelRow {
  return {
    machine_id: '10',
    machine_name: '180 автомат',
    active_production_operation_id: null,
    active_employee_id: null,
    active_employee_full_name: null,
    active_sku_id: null,
    active_sku_code: null,
    active_sku_name: null,
    active_break_id: null,
    active_break_name: null,
    active_downtime_id: null,
    downtime_type: null,
    downtime_name: null,
    downtime_comment: null,
    downtime_started_at: null,
    ...overrides
  } as ManagerMachineReadModelRow;
}

function employeeRow(overrides: Partial<ManagerEmployeeReadModelRow> = {}): ManagerEmployeeReadModelRow {
  return {
    employee_id: '20',
    full_name: 'Operator',
    open_shift_id: null,
    active_production_operation_id: null,
    active_machine_id: null,
    active_machine_name: null,
    active_sku_id: null,
    active_sku_code: null,
    active_sku_name: null,
    active_break_id: null,
    active_break_name: null,
    active_downtime_id: null,
    downtime_type: null,
    downtime_name: null,
    downtime_comment: null,
    active_additional_work_id: null,
    active_additional_work_name: null,
    ...overrides
  } as ManagerEmployeeReadModelRow;
}

function additionalWorkRow(overrides: Partial<ManagerAdditionalWorkRow> = {}): ManagerAdditionalWorkRow {
  return {
    additional_work_id: '700',
    additional_work_type_id: '10',
    additional_work_name: 'Упаковка',
    employee_id: '20',
    employee_full_name: 'Operator',
    requested_at: '2026-07-01 08:00:00+03',
    created_at: '2026-07-01 08:00:00+03',
    started_at: null,
    finished_at: null,
    status: 'requested',
    ...overrides
  } as ManagerAdditionalWorkRow;
}

function openTaskRow(overrides: Partial<ManagerOpenTaskRow> = {}): ManagerOpenTaskRow {
  return {
    notification_id: '900',
    created_at: '2026-07-01 08:00:00+03',
    source_table: 'additional_works',
    source_id: '700',
    task_type: 'additional_work_request',
    title: 'Запрошена доп. работа',
    description: 'Нужно согласовать',
    ...overrides
  } as ManagerOpenTaskRow;
}

function canonicalTaskRow(
  overrides: Partial<ManagerCanonicalOpenTaskSourceRow> = {}
): ManagerCanonicalOpenTaskSourceRow {
  return {
    task_kind: 'ADDITIONAL_WORK_REQUESTED',
    source_table: 'additional_works',
    source_id: '700',
    source_started_at: '2026-07-01 08:00:00+03',
    sort_group: '4',
    additional_work_name: 'Упаковка',
    employee_full_name: 'Operator',
    machine_id: null,
    machine_name: null,
    downtime_name: null,
    elapsed_minutes: null,
    ...overrides
  } as ManagerCanonicalOpenTaskSourceRow;
}

function createPool(rows: readonly Record<string, unknown>[], sqlAssertions?: (sql: string, params: readonly unknown[]) => void): DbPool {
  return {
    query: async (sql: string, params: readonly unknown[] = []) => {
      expect(sql.trim()).toMatch(/^(with|select)\b/i);
      expect(sql).not.toMatch(/\binsert\s+into\b|\bupdate\s+app\.|\bdelete\s+from\b|\bcreate\b|\bdrop\b/i);
      sqlAssertions?.(sql, params);
      return { rows };
    }
  } as unknown as DbPool;
}

function createSequentialPool(
  queryResults: Array<readonly Record<string, unknown>[]>,
  sqlAssertions?: (sql: string, params: readonly unknown[]) => void
): DbPool {
  return {
    query: async (sql: string, params: readonly unknown[] = []) => {
      expect(sql.trim()).toMatch(/^(with|select)\b/i);
      expect(sql).not.toMatch(/\binsert\s+into\b|\bupdate\s+app\.|\bdelete\s+from\b|\bcreate\b|\bdrop\b|\balter\b|\bgrant\b|\brevoke\b|\bcall\b/i);
      sqlAssertions?.(sql, params);
      return { rows: queryResults.shift() ?? [] };
    }
  } as unknown as DbPool;
}

describe('manager workplace read model', () => {
  it('returns the S03-N01 contract with backend-owned counters, variants and actions', async () => {
    const response = await getManagerWorkplaceState(createPool([managerRow()]), managerActor);

    expect(response).toMatchObject({
      section: 'S03',
      screen: 'S03-N01',
      manager: {
        employee_id: '2',
        full_name: 'Production Manager'
      },
      sections: {
        machines: {
          title: 'Станки',
          running_count: 3,
          downtime_count: 2,
          idle_count: 4,
          downtime_severity: 'critical',
          ui_variant: 'light_blue',
          available_actions: expect.arrayContaining(['OPEN_MACHINES'])
        },
        employees: {
          title: 'Сотрудники',
          open_shift_count: 10,
          production_active_clear_count: 3,
          production_break_count: 2,
          production_downtime_count: 1,
          production_downtime_severity: 'operational',
          additional_work_active_clear_count: 2,
          additional_work_break_count: 1,
          open_shift_without_work_count: 4,
          ui_variant: 'light_blue',
          available_actions: expect.arrayContaining(['OPEN_EMPLOYEES'])
        },
        downtimes: {
          title: 'Простои',
          critical_count: 1,
          operational_count: 1,
          ui_variant: 'light_blue',
          available_actions: expect.arrayContaining(['OPEN_DOWNTIMES', 'START_CRITICAL_DOWNTIME'])
        },
        additional_works: {
          title: 'Доп. работы',
          requested_count: 5,
          approved_count: 6,
          active_count: 7,
          ui_variant: 'grey',
          available_actions: expect.arrayContaining(['OPEN_ADDITIONAL_WORKS'])
        },
        corrections: {
          title: 'Корректировки',
          ui_variant: 'light_blue',
          available_actions: expect.arrayContaining(['OPEN_CORRECTIONS'])
        },
        notifications: {
          title: 'Уведомления',
          open_tasks_count: 8,
          ui_variant: 'light_blue',
          available_actions: expect.arrayContaining(['OPEN_NOTIFICATIONS'])
        },
        reports: {
          title: 'Отчёты',
          ui_variant: 'light_blue',
          is_placeholder: true,
          available_actions: []
        }
      }
    });
  });

  it('uses constrained severity and UI variant enums', () => {
    const none = resolveManagerWorkplaceState(
      managerRow({
        machine_critical_downtime_count: '0',
        machine_operational_downtime_count: '0',
        employee_production_critical_downtime_count: '0',
        employee_production_operational_downtime_count: '0'
      })
    );
    const operational = resolveManagerWorkplaceState(
      managerRow({
        machine_critical_downtime_count: '0',
        machine_operational_downtime_count: '2'
      })
    );

    expect(none.sections.machines.downtime_severity).toBe('none');
    expect(none.sections.employees.production_downtime_severity).toBe('none');
    expect(operational.sections.machines.downtime_severity).toBe('operational');

    for (const section of Object.values(resolveManagerWorkplaceState(managerRow()).sections)) {
      expect(['light_blue', 'grey']).toContain(section.ui_variant);
    }
  });

  it('throws forbidden when the actor has no active can_manage_production role', async () => {
    await expect(getManagerWorkplaceState(createPool([]), managerActor)).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden'
    } satisfies Partial<ApiError>);
  });

  it('guards by boolean production-manager permission and production-operator booleans, not role names', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    await getManagerWorkplaceState(
      createPool([managerRow()], (sql, params) => {
        seenParams.push(params);
        expect(sql).toContain('r.can_manage_production = true');
        expect(sql).toContain('r.can_work_as_operator = true');
        expect(sql).toContain('es.is_active_for_login = true');
        expect(sql).toContain('p.is_production_position = true');
        expect(sql).not.toMatch(/role_name\s*=/i);
      }),
      managerActor
    );

    expect(seenParams).toEqual([['2']]);
  });

  it('counts production employee summaries by distinct employee, not by operation row', async () => {
    await getManagerWorkplaceState(
      createPool([managerRow()], (sql) => {
        expect(sql).toMatch(
          /select\s+count\(distinct\s+ap\.employee_id\)::text\s+from\s+active_productions\s+ap\s+where\s+not exists[\s\S]+as employee_production_active_clear_count/i
        );
        expect(sql).toMatch(
          /select\s+count\(distinct\s+ap\.employee_id\)::text\s+from\s+active_productions\s+ap\s+where\s+exists[\s\S]+as employee_production_break_count/i
        );
        expect(sql).toMatch(
          /select\s+count\(distinct\s+ap\.employee_id\)::text\s+from\s+active_productions\s+ap\s+where\s+exists[\s\S]+as employee_production_downtime_count/i
        );
      }),
      managerActor
    );
  });

  it('rejects invalid numeric counts instead of returning strings or unsafe numbers', () => {
    expect(() => resolveManagerWorkplaceState(managerRow({ machine_running_count: 'bad' }))).toThrow(
      'machine_running_count is not a valid count'
    );
  });

  it('returns S03-M01 machines with backend-owned ui state, variants, actions and nullable fields', async () => {
    const response = await getManagerMachines(
      createSequentialPool([
        [managerIdentityRow()],
        [
          machineRow({
            active_production_operation_id: '100',
            active_employee_id: '20',
            active_employee_full_name: 'Operator',
            active_sku_id: '30',
            active_sku_code: 'SKU-30',
            active_sku_name: 'Part'
          }),
          machineRow({ machine_id: '11', machine_name: 'Idle machine' })
        ]
      ]),
      managerActor
    );

    expect(response).toMatchObject({
      section: 'S03',
      screen: 'S03-M01',
      title: 'Станки',
      machines: [
        {
          machine_id: '10',
          machine_name: '180 автомат',
          ui_state: 'running',
          ui_variant: 'green',
          active_production_operation_id: '100',
          active_employee_id: '20',
          active_employee_full_name: 'Operator',
          active_sku_id: '30',
          active_sku_code: 'SKU-30',
          active_sku_name: 'Part',
          active_break_id: null,
          active_break_name: null,
          active_downtime_id: null,
          downtime_type: null,
          downtime_name: null,
          downtime_comment: null,
          available_actions: expect.arrayContaining(['OPEN_MACHINE_CARD'])
        },
        {
          machine_id: '11',
          machine_name: 'Idle machine',
          ui_state: 'idle',
          ui_variant: 'light_blue',
          active_production_operation_id: null,
          active_employee_id: null,
          active_employee_full_name: null,
          active_sku_id: null,
          active_sku_code: null,
          active_sku_name: null,
          active_break_id: null,
          active_break_name: null,
          active_downtime_id: null,
          downtime_type: null,
          downtime_name: null,
          downtime_comment: null,
          available_actions: expect.arrayContaining(['OPEN_MACHINE_CARD'])
        }
      ],
      available_actions: expect.arrayContaining(['BACK'])
    });
  });

  it('returns S03-M02 machine card and exposes FINISH_DOWNTIME only for active downtime', async () => {
    const downtimeCard = await getManagerMachineCard(
      createSequentialPool([
        [managerIdentityRow()],
        [
          machineRow({
            active_downtime_id: '500',
            downtime_type: 'critical',
            downtime_name: 'Требуется ремонт',
            downtime_comment: null,
            downtime_started_at: '2026-07-01 05:00:00+03'
          })
        ]
      ]),
      managerActor,
      '10'
    );
    const idleCard = await getManagerMachineCard(
      createSequentialPool([[managerIdentityRow()], [machineRow()]]),
      managerActor,
      '10'
    );

    expect(downtimeCard).toMatchObject({
      section: 'S03',
      screen: 'S03-M02',
      machine: {
        active_downtime_id: '500',
        downtime_type: 'critical',
        downtime_started_at: '2026-07-01 05:00:00+03',
        ui_state: 'critical',
        ui_variant: 'red',
        available_actions: expect.arrayContaining(['FINISH_DOWNTIME'])
      },
      available_actions: expect.arrayContaining(['BACK'])
    });
    expect(idleCard.machine.available_actions).toEqual(['START_CRITICAL_DOWNTIME']);
  });

  it('returns S03-D01 with only active downtime machines', async () => {
    const response = await getManagerDowntimes(
      createSequentialPool([
        [managerIdentityRow()],
        [
          machineRow(),
          machineRow({
            active_downtime_id: '501',
            downtime_type: 'operational',
            downtime_name: 'Ожидание материала',
            downtime_started_at: '2026-07-01 05:00:00+03'
          })
        ]
      ]),
      managerActor
    );

    expect(response).toMatchObject({
      section: 'S03',
      screen: 'S03-D01',
      title: 'Простои',
      downtimes: [
        {
          machine_id: '10',
          machine_name: '180 автомат',
          active_downtime_id: '501',
          downtime_type: 'operational',
          downtime_name: 'Ожидание материала',
          downtime_comment: null,
          downtime_started_at: '2026-07-01 05:00:00+03',
          active_production_operation_id: null,
          active_employee_id: null,
          active_employee_full_name: null,
          active_sku_id: null,
          active_sku_code: null,
          active_sku_name: null,
          ui_state: 'warning',
          ui_variant: 'yellow',
          available_actions: expect.arrayContaining(['OPEN_MACHINE_CARD'])
        }
      ],
      available_actions: expect.arrayContaining(['START_CRITICAL_DOWNTIME', 'BACK'])
    });
  });

  it('resolves machine state precedence critical, operational, break, production, idle', () => {
    expect(
      resolveManagerMachineListItem(
        machineRow({
          active_production_operation_id: '100',
          active_break_id: '300',
          active_downtime_id: '500',
          downtime_type: 'critical',
          downtime_name: 'Требуется ремонт'
        })
      )
    ).toMatchObject({ ui_state: 'critical', ui_variant: 'red' });
    expect(
      resolveManagerMachineListItem(
        machineRow({
          active_production_operation_id: '100',
          active_downtime_id: '501',
          downtime_type: 'operational',
          downtime_name: 'Ожидание материала'
        })
      )
    ).toMatchObject({ ui_state: 'warning', ui_variant: 'yellow' });
    expect(
      resolveManagerMachineListItem(machineRow({ active_production_operation_id: '100', active_break_id: '300' }))
    ).toMatchObject({ ui_state: 'warning', ui_variant: 'yellow' });
    expect(resolveManagerMachineListItem(machineRow({ active_production_operation_id: '100' }))).toMatchObject({
      ui_state: 'running',
      ui_variant: 'green'
    });
    expect(resolveManagerMachineListItem(machineRow())).toMatchObject({
      ui_state: 'idle',
      ui_variant: 'light_blue'
    });
  });

  it('guards new endpoints by can_manage_production and rejects missing manager permission', async () => {
    await expect(getManagerMachines(createSequentialPool([[]]), managerActor)).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden'
    } satisfies Partial<ApiError>);
    await expect(getManagerMachineCard(createSequentialPool([[managerIdentityRow()], []]), managerActor, '10')).rejects.toMatchObject({
      statusCode: 404,
      code: 'not_found'
    } satisfies Partial<ApiError>);
  });

  it('uses read-only SQL, manager boolean guard, factual downtime classification and no role_name guard', async () => {
    const seenSql: string[] = [];
    const seenParams: Array<readonly unknown[]> = [];

    await getManagerMachines(
      createSequentialPool(
        [[managerIdentityRow()], [machineRow()]],
        (sql, params) => {
          seenSql.push(sql);
          seenParams.push(params);
        }
      ),
      managerActor
    );

    expect(seenParams).toEqual([['2'], []]);
    expect(seenSql[0]).toContain('r.can_manage_production = true');
    expect(seenSql[0]).toContain('es.is_active_for_login = true');
    expect(seenSql.join('\n')).not.toMatch(/role_name\s*=/i);
    expect(seenSql[1]).toContain('po.is_open = true');
    expect(seenSql[1]).toContain('ob.is_open = true');
    expect(seenSql[1]).toContain('md.is_open = true');
    expect(seenSql[1]).toContain('mus.is_available_for_operations = true');
    expect(seenSql[1]).toContain('mus.is_decommissioned = false');
    expect(seenSql[1]).toContain("mdbp.downtime_class = 'CRITICAL'");
    expect(seenSql[1]).toContain("mdbp.downtime_class = 'OPERATIONAL'");
  });

  it('fails closed when an active downtime has no factual classification', () => {
    expect(() =>
      resolveManagerMachineListItem(machineRow({ active_downtime_id: '500', downtime_type: null, downtime_name: 'Unknown' }))
    ).toThrow('Active downtime is not classifiable');
    expect(() =>
      resolveManagerDowntimeItem(machineRow({ active_downtime_id: '500', downtime_type: null, downtime_name: 'Unknown' }))
    ).toThrow('Active downtime is not classifiable');
  });

  it('returns S03-E01 employees with backend-owned state, variants, actions and nullable fields', async () => {
    const response = await getManagerEmployees(
      createSequentialPool([
        [managerIdentityRow()],
        [
          employeeRow({
            open_shift_id: '900',
            active_production_operation_id: '100',
            active_machine_id: '10',
            active_machine_name: '180 автомат',
            active_sku_id: '30',
            active_sku_code: 'SKU-30',
            active_sku_name: 'Part'
          }),
          employeeRow({ employee_id: '21', full_name: 'No shift' })
        ]
      ]),
      managerActor
    );

    expect(response).toMatchObject({
      section: 'S03',
      screen: 'S03-E01',
      title: 'Сотрудники',
      employees: [
        {
          employee_id: '20',
          full_name: 'Operator',
          ui_state: 'production',
          ui_variant: 'green',
          open_shift_id: '900',
          active_production_operation_id: '100',
          active_machine_id: '10',
          active_machine_name: '180 автомат',
          active_sku_id: '30',
          active_sku_code: 'SKU-30',
          active_sku_name: 'Part',
          active_break_id: null,
          active_break_name: null,
          active_downtime_id: null,
          downtime_type: null,
          downtime_name: null,
          downtime_comment: null,
          active_additional_work_id: null,
          active_additional_work_name: null,
          available_actions: expect.arrayContaining(['OPEN_EMPLOYEE_CARD'])
        },
        {
          employee_id: '21',
          full_name: 'No shift',
          ui_state: 'shift_not_started',
          ui_variant: 'white',
          open_shift_id: null,
          active_production_operation_id: null,
          active_machine_id: null,
          active_machine_name: null,
          active_sku_id: null,
          active_sku_code: null,
          active_sku_name: null,
          active_break_id: null,
          active_break_name: null,
          active_downtime_id: null,
          downtime_type: null,
          downtime_name: null,
          downtime_comment: null,
          active_additional_work_id: null,
          active_additional_work_name: null,
          available_actions: expect.arrayContaining(['OPEN_EMPLOYEE_CARD'])
        }
      ],
      available_actions: expect.arrayContaining(['BACK'])
    });
  });

  it('returns S03-E02 employee card with salary action and emergency action only for open shift', async () => {
    const openShiftCard = await getManagerEmployeeCard(
      createSequentialPool([[managerIdentityRow()], [employeeRow({ open_shift_id: '900' })]]),
      managerActor,
      '20'
    );
    const noShiftCard = await getManagerEmployeeCard(
      createSequentialPool([[managerIdentityRow()], [employeeRow()]]),
      managerActor,
      '20'
    );

    expect(openShiftCard).toMatchObject({
      section: 'S03',
      screen: 'S03-E02',
      employee: {
        employee_id: '20',
        ui_state: 'shift_idle',
        ui_variant: 'light_blue',
        available_actions: expect.arrayContaining(['VIEW_SALARY', 'VIEW_COMPLETED_WORKS', 'FINISH_EMPLOYEE_SHIFT_BY_MANAGER'])
      },
      available_actions: expect.arrayContaining(['BACK'])
    });
    expect(noShiftCard.employee.available_actions).toEqual(['VIEW_SALARY', 'VIEW_COMPLETED_WORKS']);
  });

  it('resolves employee state precedence critical, operational, break, production, additional work, idle, no shift', () => {
    expect(
      resolveManagerEmployeeListItem(
        employeeRow({
          open_shift_id: '900',
          active_production_operation_id: '100',
          active_break_id: '300',
          active_additional_work_id: '700',
          active_downtime_id: '500',
          downtime_type: 'critical',
          downtime_name: 'Требуется ремонт'
        })
      )
    ).toMatchObject({ ui_state: 'critical_down', ui_variant: 'red' });
    expect(
      resolveManagerEmployeeListItem(
        employeeRow({
          open_shift_id: '900',
          active_production_operation_id: '100',
          active_break_id: '300',
          active_downtime_id: '501',
          downtime_type: 'operational',
          downtime_name: 'Ожидание материала'
        })
      )
    ).toMatchObject({ ui_state: 'operational_down', ui_variant: 'yellow' });
    expect(
      resolveManagerEmployeeListItem(
        employeeRow({ open_shift_id: '900', active_production_operation_id: '100', active_break_id: '300' })
      )
    ).toMatchObject({ ui_state: 'break', ui_variant: 'yellow' });
    expect(
      resolveManagerEmployeeListItem(employeeRow({ open_shift_id: '900', active_production_operation_id: '100' }))
    ).toMatchObject({ ui_state: 'production', ui_variant: 'green' });
    expect(
      resolveManagerEmployeeListItem(
        employeeRow({ open_shift_id: '900', active_additional_work_id: '700', active_additional_work_name: 'Packing' })
      )
    ).toMatchObject({ ui_state: 'additional_work', ui_variant: 'grey' });
    expect(resolveManagerEmployeeListItem(employeeRow({ open_shift_id: '900' }))).toMatchObject({
      ui_state: 'shift_idle',
      ui_variant: 'light_blue'
    });
    expect(resolveManagerEmployeeListItem(employeeRow())).toMatchObject({
      ui_state: 'shift_not_started',
      ui_variant: 'white'
    });
  });

  it('returns selected employee salary totals and history using route employee_id, not actor employeeId', async () => {
    const seenParams: Array<readonly unknown[]> = [];
    const salary = await getManagerEmployeeSalary(
      createSequentialPool(
        [
          [managerIdentityRow()],
          [employeeRow()],
          [{ today_uzs: '10.0000', week_uzs: '20.0000', month_uzs: '30.0000' }]
        ],
        (_sql, params) => {
          seenParams.push(params);
        }
      ),
      managerActor,
      '20'
    );
    const history = await getManagerEmployeeSalaryHistory(
      createSequentialPool(
        [
          [managerIdentityRow()],
          [employeeRow()],
          [
            {
              month: '2026-06-01',
              total_uzs: '30.0000',
              production_uzs: '11.0000',
              additional_work_uzs: '12.0000',
              corrections_uzs: null,
              reversals_uzs: null
            }
          ]
        ],
        (_sql, params) => {
          seenParams.push(params);
        }
      ),
      managerActor,
      '20'
    );

    expect(salary).toEqual({
      section: 'S03',
      screen: 'S03-SAL01',
      employee: { employee_id: '20', full_name: 'Operator' },
      employee_id: '20',
      totals: { today_uzs: 10, week_uzs: 20, month_uzs: 30 }
    });
    expect(history).toEqual({
      section: 'S03',
      screen: 'S03-SAL02',
      employee: { employee_id: '20', full_name: 'Operator' },
      employee_id: '20',
      months: [
        {
          month: '2026-06-01',
          total_uzs: 30,
          production_uzs: 11,
          additional_work_uzs: 12,
          corrections_uzs: null,
          reversals_uzs: null
        }
      ]
    });
    expect(seenParams).toEqual([['2'], ['20'], ['20'], ['2'], ['20'], ['20']]);
    expect(seenParams.flat()).not.toContain('7');
  });

  it('requires selected employee to pass the production operator filter for card and salary', async () => {
    await expect(getManagerEmployeeCard(createSequentialPool([[managerIdentityRow()], []]), managerActor, '20')).rejects.toMatchObject({
      statusCode: 404,
      code: 'not_found'
    } satisfies Partial<ApiError>);
    await expect(getManagerEmployeeSalary(createSequentialPool([[managerIdentityRow()], []]), managerActor, '20')).rejects.toMatchObject({
      statusCode: 404,
      code: 'not_found'
    } satisfies Partial<ApiError>);
  });

  it('uses read-only SQL, manager guard, production operator filter and salary summary source', async () => {
    const seenSql: string[] = [];
    const seenParams: Array<readonly unknown[]> = [];

    await getManagerEmployeeSalary(
      createSequentialPool(
        [
          [managerIdentityRow()],
          [employeeRow()],
          [{ today_uzs: '0', week_uzs: '0', month_uzs: '0' }]
        ],
        (sql, params) => {
          seenSql.push(sql);
          seenParams.push(params);
        }
      ),
      managerActor,
      '20'
    );

    expect(seenParams).toEqual([['2'], ['20'], ['20']]);
    expect(seenSql[0]).toContain('r.can_manage_production = true');
    expect(seenSql[1]).toContain('es.is_active_for_login = true');
    expect(seenSql[1]).toContain('p.is_production_position = true');
    expect(seenSql[1]).toContain('er.revoked_at is null');
    expect(seenSql[1]).toContain('r.can_work_as_operator = true');
    expect(seenSql.join('\n')).not.toMatch(/role_name\s*=/i);
    expect(seenSql[1]).toContain('esh.is_open = true');
    expect(seenSql[1]).toContain('po.is_open = true');
    expect(seenSql[1]).toContain('ob.is_open = true');
    expect(seenSql[1]).toContain('md.is_open = true');
    expect(seenSql[1]).toContain('on ad.machine_id = ap.machine_id');
    expect(seenSql[1]).not.toContain('and md.production_operation_id is not null');
    expect(seenSql[1]).toContain('aws.is_approved = true');
    expect(seenSql[2]).toContain('from app.salary_summary');
    expect(seenSql[2]).toContain('where employee_id = $1');
  });

  it('fails closed when an active employee downtime has no factual classification', () => {
    expect(() =>
      resolveManagerEmployeeListItem(
        employeeRow({ active_downtime_id: '500', downtime_type: null, downtime_name: 'Unknown' })
      )
    ).toThrow('Active downtime is not classifiable');
  });

  it('returns S03-AW01 additional works grouped by lifecycle with backend-owned actions', async () => {
    const response = await getManagerAdditionalWorks(
      createSequentialPool([
        [managerIdentityRow()],
        [
          additionalWorkRow(),
          additionalWorkRow({ additional_work_id: '701', status: 'approved', requested_at: null }),
          additionalWorkRow({
            additional_work_id: '702',
            status: 'active',
            requested_at: null,
            started_at: '2026-07-01 09:00:00+03'
          }),
          additionalWorkRow({
            additional_work_id: '703',
            status: 'waiting_accrual',
            requested_at: null,
            started_at: '2026-07-01 09:00:00+03',
            finished_at: '2026-07-01 10:00:00+03'
          })
        ]
      ]),
      managerActor
    );

    expect(response).toMatchObject({
      section: 'S03',
      screen: 'S03-AW01',
      title: 'Доп. работы',
      groups: {
        requested: [
          {
            additional_work_id: '700',
            additional_work_type_id: '10',
            additional_work_name: 'Упаковка',
            employee_id: '20',
            employee_full_name: 'Operator',
            requested_at: '2026-07-01 08:00:00+03',
            created_at: '2026-07-01 08:00:00+03',
            started_at: null,
            finished_at: null,
            status: 'requested',
            ui_state: 'requested',
            ui_variant: 'grey',
            available_actions: expect.arrayContaining(['OPEN_ADDITIONAL_WORK_CARD', 'APPROVE_ADDITIONAL_WORK_REQUEST', 'REJECT_ADDITIONAL_WORK_REQUEST'])
          }
        ],
        approved: [
          expect.objectContaining({
            additional_work_id: '701',
            status: 'approved',
            ui_state: 'approved',
            ui_variant: 'grey',
            available_actions: expect.arrayContaining(['OPEN_ADDITIONAL_WORK_CARD'])
          })
        ],
        active: [
          expect.objectContaining({
            additional_work_id: '702',
            status: 'active',
            ui_variant: 'green',
            available_actions: expect.arrayContaining(['OPEN_ADDITIONAL_WORK_CARD'])
          })
        ],
        waiting_accrual: [
          expect.objectContaining({
            additional_work_id: '703',
            status: 'waiting_accrual',
            ui_variant: 'green',
            available_actions: expect.arrayContaining(['OPEN_ADDITIONAL_WORK_CARD'])
          })
        ]
      },
      available_actions: expect.arrayContaining(['BACK'])
    });
  });

  it('returns pair-specific assignment eligibility from one read-only PostgreSQL snapshot', async () => {
    const seenSql: string[] = [];
    const seenParams: Array<readonly unknown[]> = [];
    const response = await getManagerAdditionalWorkTypesAvailable(
      createSequentialPool([
        [managerIdentityRow()],
        [
          {
            additional_work_type_id: '10',
            display_name: 'Упаковка',
            is_active: true,
            can_assign: true,
            blocked_code: null
          },
          {
            additional_work_type_id: '11',
            display_name: 'Маркировка',
            is_active: true,
            can_assign: false,
            blocked_code: 'additional_work_assignment_already_exists'
          }
        ]
      ], (sql, params) => {
        seenSql.push(sql);
        seenParams.push(params);
      }),
      managerActor,
      '20'
    );

    expect(response).toEqual({
      section: 'S03',
      screen: 'S03-AW41',
      assignability_employee_id: '20',
      assignability_additional_work_type_id: null,
      additional_work_types: [
        {
          additional_work_type_id: '10',
          additional_work_name: 'Упаковка',
          is_active: true,
          display_order: 1,
          can_assign: true,
          blocked_code: null,
          blocked_message: null
        },
        {
          additional_work_type_id: '11',
          additional_work_name: 'Маркировка',
          is_active: true,
          display_order: 2,
          can_assign: false,
          blocked_code: 'additional_work_assignment_already_exists',
          blocked_message: 'Такая доп. работа уже назначена этому сотруднику и ещё не завершена.'
        }
      ],
      available_actions: ['ASSIGN_ADDITIONAL_WORK', 'BACK']
    });
    expect(seenParams).toEqual([['2'], ['20', null]]);
    expect(seenSql[1]).toMatch(/es\.is_active\s*=\s*true/);
    expect(seenSql[1]).toMatch(/es\.is_active_for_login\s*=\s*true/);
    expect(seenSql[1]).toMatch(/r\.can_work_as_operator\s*=\s*true/);
    expect(seenSql[1]).toMatch(/aw\.is_assignment_finished\s*=\s*false/);
    expect(seenSql[1]).toMatch(/awt\.is_active\s*=\s*true/);
  });

  it('blocks every available type with the backend target contract when the selected target is stale', async () => {
    const response = await getManagerAdditionalWorkTypesAvailable(
      createSequentialPool([
        [managerIdentityRow()],
        [{
          additional_work_type_id: '10',
          display_name: 'Упаковка',
          is_active: true,
          can_assign: false,
          blocked_code: 'additional_work_target_not_available'
        }]
      ]),
      managerActor,
      '999'
    );

    expect(response).toMatchObject({
      assignability_employee_id: '999',
      assignability_additional_work_type_id: null,
      additional_work_types: [{
        can_assign: false,
        blocked_code: 'additional_work_target_not_available',
        blocked_message: 'Сотрудник недоступен для назначения доп. работы. Обновите список.'
      }],
      available_actions: ['BACK']
    });
  });

  it('returns a selected removed type as an explicit non-assignable pair', async () => {
    const response = await getManagerAdditionalWorkTypesAvailable(
      createSequentialPool([
        [managerIdentityRow()],
        [{
          additional_work_type_id: '404',
          display_name: 'Выбранный вид доп. работы',
          is_active: false,
          can_assign: false,
          blocked_code: 'additional_work_type_not_available'
        }]
      ]),
      managerActor,
      '20',
      '404'
    );

    expect(response).toMatchObject({
      assignability_employee_id: '20',
      assignability_additional_work_type_id: '404',
      additional_work_types: [{
        additional_work_type_id: '404',
        is_active: false,
        can_assign: false,
        blocked_code: 'additional_work_type_not_available',
        blocked_message: 'Этот вид доп. работы больше недоступен. Обновите список.'
      }],
      available_actions: ['BACK']
    });
  });

  it('resolves additional work lifecycle rows and fails closed when display data is missing', () => {
    expect(resolveManagerAdditionalWorkItem(additionalWorkRow()).available_actions).toEqual([
      'OPEN_ADDITIONAL_WORK_CARD',
      'APPROVE_ADDITIONAL_WORK_REQUEST',
      'REJECT_ADDITIONAL_WORK_REQUEST'
    ]);
    expect(resolveManagerAdditionalWorkItem(additionalWorkRow({ status: 'active' }))).toMatchObject({
      ui_state: 'active',
      ui_variant: 'green',
      available_actions: expect.arrayContaining(['OPEN_ADDITIONAL_WORK_CARD'])
    });
    expect(resolveManagerAdditionalWorkItem(additionalWorkRow({ status: 'waiting_accrual' }))).toMatchObject({
      ui_state: 'waiting_accrual',
      ui_variant: 'green'
    });
    expect(() => resolveManagerAdditionalWorkItem(additionalWorkRow({ additional_work_name: '' }))).toThrow(
      'Additional work row is missing required display data'
    );
  });

  it('returns canonical S03-NOT01 source tasks with count equal to row length', async () => {
    const response = await getManagerOpenTasks(
      createSequentialPool([
        [managerIdentityRow()],
        [
          canonicalTaskRow(),
          canonicalTaskRow({
            task_kind: 'CRITICAL_DOWNTIME_OPEN',
            source_table: 'machine_downtimes',
            source_id: '900',
            source_started_at: '2026-07-01 07:00:00+03',
            sort_group: '1',
            additional_work_name: null,
            employee_full_name: null,
            machine_id: '10',
            machine_name: '180 автомат',
            downtime_name: 'Ремонт',
            elapsed_minutes: '60'
          })
        ]
      ]),
      managerActor
    );

    expect(response).toMatchObject({
      section: 'S03',
      screen: 'S03-NOT01',
      title: 'Уведомления',
      open_tasks: expect.arrayContaining([
        expect.objectContaining({
          task_kind: 'ADDITIONAL_WORK_REQUESTED',
          source_table: 'additional_works',
          source_id: '700',
          task_type: 'additional_work_request',
          title: 'Запрошена доп. работа',
          ui_state: 'open',
          ui_variant: 'grey',
          available_actions: expect.arrayContaining(['OPEN_TASK_SOURCE'])
        }),
        expect.objectContaining({
          task_kind: 'CRITICAL_DOWNTIME_OPEN',
          source_table: 'machine_downtimes',
          source_id: '900',
          task_type: 'open_machine_downtime',
          title: 'Критический простой',
          ui_state: 'open',
          ui_variant: 'red',
          available_actions: expect.arrayContaining(['OPEN_TASK_SOURCE'])
        })
      ]),
      open_tasks_count: 2,
      available_actions: expect.arrayContaining(['BACK'])
    });
    expect(response.open_tasks_count).toBe(response.open_tasks.length);
    expect(JSON.stringify(response)).not.toMatch(/READ|HIDE|CANCEL/);
  });

  it('C4-S03-TASK-COUNT-01 includes requested work with no notification row', async () => {
    const response = await getManagerOpenTasks(
      createSequentialPool([[managerIdentityRow()], [canonicalTaskRow()]]),
      managerActor
    );

    expect(response.open_tasks).toEqual([
      expect.objectContaining({
        task_kind: 'ADDITIONAL_WORK_REQUESTED',
        entity_table: 'additional_works',
        entity_id: '700',
        target_screen_id: 'S03-AW10',
        target_context: { additional_work_id: '700' },
        display_lines: ['Запрошена доп. работа', 'Operator']
      })
    ]);
    expect(response.open_tasks_count).toBe(1);
  });

  it('C4-S03-CRITICAL-DOWNTIME-01 maps canonical critical and operational rows', () => {
    expect(resolveManagerCanonicalOpenTaskSourceItem(canonicalTaskRow({
      task_kind: 'CRITICAL_DOWNTIME_OPEN', source_table: 'machine_downtimes',
      source_id: 'D-1', sort_group: 1, additional_work_name: null,
      employee_full_name: null, machine_id: 'M-1', machine_name: 'Станок 1',
      downtime_name: 'Ремонт', elapsed_minutes: 1
    }))).toMatchObject({
      task_kind: 'CRITICAL_DOWNTIME_OPEN', ui_color_token: 'red',
      target_context: { machine_id: 'M-1' },
      display_lines: ['Ремонт', 'Станок 1', '00:01']
    });
    expect(resolveManagerCanonicalOpenTaskSourceItem(canonicalTaskRow({
      task_kind: 'OPERATIONAL_DOWNTIME_OVER_15_MIN', source_table: 'machine_downtimes',
      source_id: 'D-2', sort_group: 2, additional_work_name: null,
      employee_full_name: null, machine_id: 'M-2', machine_name: 'Станок 2',
      downtime_name: 'Ожидание материала', elapsed_minutes: 15
    }))).toMatchObject({
      task_kind: 'OPERATIONAL_DOWNTIME_OVER_15_MIN', ui_color_token: 'yellow',
      display_lines: ['Ожидание материала', 'Станок 2', '00:15']
    });
  });

  it('formats elapsed downtime minutes as an unbounded HH:MM clock', () => {
    expect([0, 5, 15, 59, 60, 65, 6000].map(formatElapsedMinutesClock)).toEqual([
      '00:00', '00:05', '00:15', '00:59', '01:00', '01:05', '100:00'
    ]);
    for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => formatElapsedMinutesClock(invalid)).toThrow(ApiError);
    }
  });

  it('projects exact Owner notification lines without hidden work or downtime class labels', () => {
    const requested = resolveManagerCanonicalOpenTaskSourceItem(canonicalTaskRow());
    const waiting = resolveManagerCanonicalOpenTaskSourceItem(canonicalTaskRow({
      task_kind: 'ADDITIONAL_WORK_WAITING_ACCRUAL',
      additional_work_name: 'Скрытое имя работы'
    }));
    expect(requested.display_lines).toEqual(['Запрошена доп. работа', 'Operator']);
    expect(waiting.display_lines).toEqual(['Доп. работа требует начисления', 'Operator']);
    expect(JSON.stringify([requested.display_lines, waiting.display_lines])).not.toContain('Скрытое имя работы');

    expect(resolveManagerOpenTaskItem(openTaskRow({
      task_type: 'additional_work_request',
      display_lines: ['Запрошена доп. работа', 'Operator']
    })).display_lines).toEqual(['Запрошена доп. работа', 'Operator']);
    expect(resolveManagerOpenTaskItem(openTaskRow({
      source_table: 'machine_downtimes',
      task_type: 'open_machine_downtime',
      ui_color_token: 'red',
      display_lines: ['Ремонт', 'Станок 1', '1 мин']
    })).display_lines).toEqual(['Ремонт', 'Станок 1', '1 мин']);
  });

  it('resolves notification task variants by factual source type', () => {
    expect(resolveManagerOpenTaskItem(openTaskRow({ task_type: 'additional_work_request' }))).toMatchObject({
      task_kind: 'ADDITIONAL_WORK_REQUESTED',
      ui_color_token: 'gray',
      ui_variant: 'grey'
    });
    expect(resolveManagerOpenTaskItem(openTaskRow({ task_type: 'additional_work_waiting_accrual' }))).toMatchObject({
      task_kind: 'ADDITIONAL_WORK_WAITING_ACCRUAL',
      ui_color_token: 'green',
      ui_variant: 'green'
    });
    expect(resolveManagerOpenTaskItem(openTaskRow({ source_table: 'machine_downtimes', task_type: 'open_machine_downtime' }))).toMatchObject({
      task_kind: 'CRITICAL_DOWNTIME_OPEN',
      ui_color_token: 'red',
      ui_variant: 'red'
    });
    expect(
      resolveManagerOpenTaskItem(
        openTaskRow({ source_table: 'machine_downtimes', task_type: 'open_machine_downtime', ui_color_token: 'yellow' })
      )
    ).toMatchObject({
      task_kind: 'OPERATIONAL_DOWNTIME_OVER_15_MIN',
      ui_color_token: 'yellow',
      ui_variant: 'yellow'
    });
  });

  it('uses read-only SQL for additional work lifecycle filtering and excludes resolved states in query', async () => {
    const seenSql: string[] = [];
    const seenParams: Array<readonly unknown[]> = [];

    await getManagerAdditionalWorks(
      createSequentialPool(
        [[managerIdentityRow()], [additionalWorkRow()]],
        (sql, params) => {
          seenSql.push(sql);
          seenParams.push(params);
        }
      ),
      managerActor
    );

    expect(seenParams).toEqual([['2'], []]);
    expect(seenSql[0]).toContain('r.can_manage_production = true');
    expect(seenSql[1]).toContain('es.is_active_for_login = true');
    expect(seenSql[1]).toContain('p.is_production_position = true');
    expect(seenSql[1]).toContain('er.revoked_at is null');
    expect(seenSql[1]).toContain('r.can_work_as_operator = true');
    expect(seenSql[1]).toContain('aws.is_pending = true');
    expect(seenSql[1]).toContain('aws.is_approved = true');
    expect(seenSql[1]).toContain('awas.is_waiting_accrual = true');
    expect(seenSql[1]).toContain('aw.cancelled_at is null');
    expect(seenSql[1]).toContain('aw.is_assignment_finished = false');
    expect(seenSql.join('\n')).not.toMatch(/role_name\s*=/i);
  });

  it('uses the shared canonical source CTE for open tasks and workplace count consistency', async () => {
    const seenSql: string[] = [];
    const seenParams: Array<readonly unknown[]> = [];

    await getManagerOpenTasks(
      createSequentialPool(
        [[managerIdentityRow()], [canonicalTaskRow()]],
        (sql, params) => {
          seenSql.push(sql);
          seenParams.push(params);
        }
      ),
      managerActor
    );
    await getManagerWorkplaceState(
      createPool([managerRow()], (sql, params) => {
        seenSql.push(sql);
        seenParams.push(params);
      }),
      managerActor
    );

    expect(seenParams).toEqual([['2'], [], ['2']]);
    for (const sql of [seenSql[1], seenSql[2]]) {
      expect(sql).toContain('canonical_open_tasks as');
      expect(sql).toContain('app.additional_works');
      expect(sql).toContain('awas.is_waiting_accrual = true');
      expect(sql).toContain('app.machine_downtimes');
      expect(sql).toContain('app.machine_downtime_profile_notification_rules');
      expect(sql).toContain("rule.threshold_minutes * interval '1 minute'");
      expect(sql).not.toContain('app.notifications');
      expect(sql).not.toContain('hidden_from_chat_at');
    }
    expect(seenSql.join('\n')).not.toMatch(/role_name\s*=/i);
  });
});

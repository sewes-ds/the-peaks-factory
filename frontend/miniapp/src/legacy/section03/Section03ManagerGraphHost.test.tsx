import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const hostSource = readFileSync(resolve(process.cwd(), 'src/legacy/section03/Section03ManagerGraphHost.tsx'), 'utf8');
const apiSource = readFileSync(resolve(process.cwd(), 'src/legacy/section03/section03Api.ts'), 'utf8');
const contractSource = readFileSync(resolve(process.cwd(), 'src/legacy/section03/section03V17Contract.ts'), 'utf8');
const cssSource = readFileSync(resolve(process.cwd(), 'src/legacy/section03/section03.css'), 'utf8');
const rendererButtonSource = readFileSync(resolve(process.cwd(), 'src/foundation/graphRenderer/PeaksActionButton.tsx'), 'utf8');
const themeSource = readFileSync(resolve(process.cwd(), 'src/foundation/peaksTheme.css'), 'utf8');

describe('Section03 v17 graph binding', () => {
  it('keeps Section03 on the shared graph renderer path and requires ApiClient injection', () => {
    expect(hostSource).toContain('PeaksGraphNodeRenderer');
    expect(hostSource).toContain('apiClient: ApiClient');
    expect(hostSource).not.toContain('SECTION03_MAIN_TILES');
    expect(hostSource).not.toContain('SECTION03_MACHINE_SCENARIOS');
  });

  it('declares v17 notifications and reports as in-scope canonical nodes', () => {
    expect(contractSource).toContain('S03.V17.WITH_NOTIFICATIONS_AND_REPORTS');
    expect(contractSource).toContain("'S03-NOT01'");
    expect(contractSource).toContain("'S03-R01'");
    expect(contractSource).toContain("'S03-R14'");
  });

  it('keeps removed preview node ids out of the active host implementation', () => {
    for (const forbidden of ['S03-NT01', 'S03-M05C', 'S03-D14', 'S03-AW13', 'S03-AW14', 'S03-AW22', 'S03-AW43']) {
      expect(hostSource).not.toContain(forbidden);
    }
  });

  it('binds manager/read-model and mutation endpoints in the Section03 API adapter', () => {
    for (const endpoint of [
      '/manager/workplace-state',
      '/manager/notifications/open-tasks',
      '/exports/google-sheets',
      '/manager/salary-correction-context',
      '/manager/downtime-types/critical',
      '/manager/additional-work-types/available'
    ]) {
      expect(apiSource).toContain(endpoint);
    }

    expect(apiSource).toContain("export_type: 'management_mvp_export'");
  });

  it('uses exact PEAKS color tokens and the white/gray requested additional-work variant', () => {
    expect(themeSource).toContain('--peaks-blue: #0861BB');
    expect(themeSource).toContain('--peaks-light-blue: #EAF4FF');
    expect(rendererButtonSource).toContain("'whiteGray'");
    expect(cssSource).toContain('var(--peaks-white)');
    expect(cssSource).toContain('var(--peaks-gray-border)');
  });
});

describe('Section03 v17 machine downtime card layout regression', () => {
  it('keeps machine screen titles fixed and formats downtime card fields as accepted labels', () => {
    expect(hostSource).toContain("fixedTopObjects: hasFixedTitle ? [firstObject] : undefined");
    expect(hostSource).toContain("['Сотрудник', machine.active_employee_full_name]");
    expect(hostSource).toContain("['Причина простоя', machine.downtime_name]");
    expect(hostSource).toContain("formatTimeHHMM(machine.downtime_started_at)");
    expect(hostSource).not.toContain("['ФИО', machine.active_employee_full_name]");
    expect(hostSource).not.toContain("[null, machine.downtime_name]");
  });

  it('shows the critical downtime start confirmation title in blue and labels the downtime type', () => {
    const criticalStartSource = hostSource.slice(
      hostSource.indexOf('function renderCriticalDowntimeStartConfirm'),
      hostSource.indexOf('function renderEmployees')
    );

    expect(criticalStartSource).toContain("info('Подтвердите начало простоя:')");
    expect(criticalStartSource).toContain("['Тип простоя', ctx.route.downtime_type_name]");
    expect(criticalStartSource).not.toContain("[null, 'Подтвердите начало простоя:']");
    expect(criticalStartSource).not.toContain('[null, ctx.route.downtime_type_name]');
    expect(hostSource).toContain("return { kind: 'infoText', text, tone: 'blue' };");
  });

  it('finishes operational downtime without sending null comment payload', () => {
    expect(apiSource).toContain('TECHNICAL_MANAGER_DOWNTIME_FINISH_COMMENT');
    expect(apiSource).toContain('TECHNICAL_MANAGER_DOWNTIME_FINISH_COMMENT');
    expect(apiSource).not.toContain('{ comment: null }');
    expect(apiSource).toContain('body: { comment: finishComment, reason: finishComment }');
  });


  it('uses compact fixed title spacing for Section03 screens', () => {
    expect(cssSource).toContain('S03 v17 compact fixed screen title');
    expect(cssSource).toContain('min-height: 46px');
    expect(cssSource).toContain('padding-bottom: 8px');
  });

  it('shows nested backend error messages instead of generic request failures', () => {
    expect(hostSource).toContain('payload?.error?.message');
    expect(hostSource).toContain('payload?.error?.code');
  });

  it('uses the underlined label/value card layout in Section03 only', () => {
    expect(cssSource).toContain('text-decoration: underline');
    expect(cssSource).toContain('.peaks-s03-screen--v17-bound .peaks-graph-production-card__label');
  });
});


it('uses no-cache manager machine reads for post-mutation consistency', () => {
  expect(apiSource).toContain('noCachePath(SECTION03_API_PATHS.machines)');
  expect(apiSource).toContain('noCachePath(SECTION03_API_PATHS.machineCard(machineId))');
});

it('derives S03-M01 machine row color from active downtime first and active production second', () => {
  expect(hostSource).toContain('function machineListRowVariant');
  expect(hostSource).toContain('hasMachineActiveDowntime(machine)');
  expect(hostSource).toContain("return 'green';");
});

it('opens active-production machine rows and shows red start-downtime action on the machine card', () => {
  expect(hostSource).not.toContain('hasProduction && !hasDowntime');
  expect(hostSource).toContain("false,\n        () => ctx.go({ screenId: 'S03-M02'");
  expect(hostSource).toContain("!machine.active_downtime_id && (machine.ui_state === 'idle' || hasProduction)");
  expect(hostSource).toContain("button('Начать простой', 'red'");
});


describe('S03 machine lifecycle source-contract regression', () => {
  it('passes only machine_id from machine rows and never route machine snapshots', () => {
    expect(hostSource).not.toContain('machine, refreshKey');
    expect(hostSource).not.toContain('ctx.data?.machine ?? ctx.route.machine');
    expect(hostSource).not.toContain("['Станок', ctx.route.machine?.machine_name ?? ctx.route.machine_id]");
    expect(hostSource).toContain("screenId: 'S03-M02', machine_id: String(machine.machine_id), refreshKey: Date.now()");
  });

  it('requires GET /manager/machines/:machine_id data for machine cards and confirms', () => {
    expect(hostSource).toContain("case 'S03-D13':");
    expect(hostSource).toContain('const machine = ctx.data?.machine;');
    expect(hostSource).toContain('sourceDataRequiredView');
    expect(hostSource).toContain("GET /manager/machines/:machine_id");
  });
});


describe('S03 manager critical downtime operation-link regression', () => {
  it('passes the fresh machine active production operation into downtime start', () => {
    const criticalStartSource = hostSource.slice(
      hostSource.indexOf('function renderCriticalDowntimeStartConfirm'),
      hostSource.indexOf('function renderEmployees')
    );
    const apiStartSource = apiSource.slice(
      apiSource.indexOf('export function startManagerCriticalDowntime'),
      apiSource.indexOf('export function approveAdditionalWorkRequest')
    );

    expect(criticalStartSource).toContain(
      'machine.active_production_operation_id ? String(machine.active_production_operation_id) : null'
    );
    expect(apiStartSource).toContain('productionOperationId: string | null');
    expect(apiStartSource).toContain('production_operation_id: productionOperationId');
    expect(apiStartSource).not.toContain('production_operation_id: null');
  });
});

describe('S03 employee lifecycle source-contract regression', () => {
  const loaderSource = hostSource.slice(
    hostSource.indexOf('function resolveLoader'),
    hostSource.indexOf('function renderMain')
  );
  const employeeLifecycleSource = hostSource.slice(
    hostSource.indexOf('function renderEmployees'),
    hostSource.indexOf('function renderCompletedWorksList')
  );
  const blockerTransitionSource = hostSource.slice(
    hostSource.indexOf('const continueAfterBlockerFinish'),
    hostSource.indexOf('const view = useMemo')
  );
  const blockerMutationSource = hostSource.slice(
    hostSource.indexOf('function renderFinishProductionBlockerConfirm'),
    hostSource.indexOf('function renderCompletedWorksList')
  );

  it('passes only employee_id from S03-E01 and keeps employee snapshots out of the employee lifecycle branch', () => {
    expect(hostSource).toContain(
      "() => ctx.go({ screenId: 'S03-E02', employee_id: String(employee.employee_id) })"
    );
    expect(employeeLifecycleSource).not.toMatch(/ctx\.route\.employee\b/);
    expect(employeeLifecycleSource).not.toContain('employee_id: String(employee.employee_id), employee');
    expect(hostSource).not.toContain(
      "return { screenId: 'S03-E02', employee_id: route.employee_id, employee: route.employee };"
    );
  });

  it('re-reads GET /manager/employees/:employee_id for employee card, blocker, and close-shift nodes', () => {
    for (const screenId of ['S03-E02', 'S03-E10', 'S03-E11', 'S03-E12', 'S03-E13', 'S03-E14', 'S03-E16', 'S03-E17']) {
      expect(loaderSource).toContain(`case '${screenId}':`);
    }

    expect(loaderSource).toContain(
      'return route.employee_id ? () => getManagerEmployeeCard(apiClient, route.employee_id as string) : null;'
    );
    expect(apiSource).toContain('noCachePath(SECTION03_API_PATHS.employees)');
    expect(apiSource).toContain('noCachePath(SECTION03_API_PATHS.employeeCard(employeeId))');
  });

  it('renders the S03-E02 employee card in machine-card label/value style with HH:MM times', () => {
    const employeeCardSource = employeeLifecycleSource.slice(
      employeeLifecycleSource.indexOf('function renderEmployeeCard'),
      employeeLifecycleSource.indexOf('function renderShiftBlockers')
    );
    const expectedFields = [
      "['Сотрудник', employee.full_name]",
      "['Время начала смены', formatTimeHHMM(employee.shift_started_at)]",
      "['SKU', employee.active_sku_name]",
      "['Станок', employee.active_machine_name]",
      "['Время начала производства', formatTimeHHMM(employee.production_started_at)]"
    ];

    let previousIndex = -1;
    for (const field of expectedFields) {
      const fieldIndex = employeeCardSource.indexOf(field);
      expect(fieldIndex).toBeGreaterThan(previousIndex);
      previousIndex = fieldIndex;
    }

    expect(employeeCardSource).not.toContain("['ФИО', employee.full_name]");
    expect(employeeCardSource).not.toContain("['Время начала смены', employee.shift_started_at]");
    expect(employeeCardSource).not.toContain("['Время начала производства', employee.production_started_at]");
    expect(employeeCardSource).toContain('card(lines, cardTone(employee.ui_variant))');
  });

  it('renders employee lifecycle display nodes only from employee-card source data', () => {
    for (const screenId of ['S03-E02', 'S03-E11', 'S03-E12', 'S03-E14', 'S03-E16', 'S03-E17']) {
      expect(employeeLifecycleSource).toContain(
        `sourceDataRequiredView('${screenId}', 'GET /manager/employees/:employee_id'`
      );
    }

    expect(employeeLifecycleSource).not.toContain('ctx.data?.employee ?? ctx.route.employee');
  });

  it('uses the fresh employee read to choose one post-blocker transition and then lets the destination loader refresh', () => {
    expect(blockerTransitionSource).toContain(
      "screenId: hasAnyBlocker(employee?.blockers) ? 'S03-E12' : 'S03-E10'"
    );
    expect(blockerTransitionSource).not.toContain("go({ screenId: 'S03-E12'");
    expect(blockerTransitionSource).not.toContain("go({ screenId: 'S03-E10'");
    expect(blockerMutationSource.match(/\(nextRoute\) => nextRoute/g)).toHaveLength(3);
    expect(blockerMutationSource).not.toContain('employee: employee');
  });
});

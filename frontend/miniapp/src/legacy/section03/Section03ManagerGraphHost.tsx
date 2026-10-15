import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ApiClient } from '../../foundation/apiClient';
import {
  PeaksGraphNodeRenderer,
  type PeaksActionButtonVariant,
  type PeaksGraphCardTone,
  type PeaksGraphNodeView,
  type PeaksGraphObject,
  type PeaksListButtonVariant
} from '../../foundation/graphRenderer';
import {
  PeaksCommentInputKeyboard,
  PeaksNumericInputKeyboard,
  isEmptyCommentInput,
  isMalformedNumericInput,
  normalizeNumericInputForApi
} from '../../foundation/graphObjects';
import {
  accrueAdditionalWorkSalary,
  approveAdditionalWorkRequest,
  assignAdditionalWork,
  cancelAdditionalWork,
  closeEmployeeShiftByManager,
  createAndApproveSalaryCorrection,
  createGoogleSheetsExport,
  createProductionOperationCorrection,
  finishMachineDowntime,
  finishManagerAdditionalWork,
  finishManagerBreakBlocker,
  finishManagerProductionBlocker,
  getManagerAdditionalWorkTypesAvailable,
  getManagerAdditionalWorks,
  getManagerCriticalDowntimeTypes,
  getManagerDowntimes,
  getManagerEmployeeCard,
  getManagerEmployeeCompletedWorkCard,
  getManagerEmployeeCompletedWorks,
  getManagerEmployeeSalary,
  getManagerEmployeeSalaryHistory,
  getManagerEmployees,
  getManagerMachineCard,
  getManagerMachineCompletedProductionOperations,
  getManagerMachines,
  getManagerNotificationsOpenTasks,
  getManagerSalaryCorrectionContext,
  getManagerWorkplaceState,
  markAdditionalWorkWithoutAccrual,
  rejectAdditionalWorkRequest,
  reverseSalaryEntry,
  startManagerCriticalDowntime,
  type S03Period,
  type S03WorkType
} from './section03Api';
import { SECTION03_V17_CONTRACT_ID, type Section03V17ScreenId } from './section03V17Contract';

export type Section03ManagerGraphHostProps = {
  apiClient: ApiClient;
};

type RouteState = {
  screenId: Section03V17ScreenId;
  origin?: Section03V17ScreenId;
  returnTo?: Section03V17ScreenId;
  period?: S03Period;
  employee_id?: string;
  employee?: any;
  machine_id?: string;
  machine?: any;
  downtime_id?: string;
  downtime_type_id?: string;
  downtime_type_name?: string;
  additional_work_id?: string;
  additionalWork?: any;
  additional_work_type_id?: string;
  additionalWorkType?: any;
  work_type?: S03WorkType;
  operation_id?: string;
  work?: any;
  salary_entry_id?: string;
  correctionMode?: 'accrual' | 'withholding';
  productionCorrectionMode?: 'increase' | 'decrease' | 'final';
  correctionContext?: any;
  from_date?: string;
  to_date?: string;
  export_run_id?: string;
  refreshKey?: number;
};

type LoadState = {
  loading: boolean;
  error: string | null;
  data: any;
};

const BACK_ACTION_ID = 'BACK';
const FIXED_BACK_SIZE = 'fixed55' as const;

export function Section03ManagerGraphHost({ apiClient }: Section03ManagerGraphHostProps) {
  const [route, setRoute] = useState<RouteState>({ screenId: 'S03-N01' });
  const [loadState, setLoadState] = useState<LoadState>({ loading: true, error: null, data: null });
  const [pending, setPending] = useState(false);
  const [numericInput, setNumericInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [dateInput, setDateInput] = useState('');

  const go = useCallback((next: RouteState) => {
    setNumericInput('');
    setCommentInput('');
    setDateInput('');
    setRoute(next);
  }, []);

  const back = useCallback(() => {
    if (route.returnTo) {
      go({ screenId: route.returnTo, employee_id: route.employee_id, machine_id: route.machine_id });
      return;
    }

    const parent = resolveBackRoute(route);
    go(parent);
  }, [go, route]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const loader = resolveLoader(apiClient, route);
      if (!loader) {
        setLoadState({ loading: false, error: null, data: null });
        return;
      }

      setLoadState({ loading: true, error: null, data: null });
      try {
        const data = await loader();
        if (!cancelled) {
          setLoadState({ loading: false, error: null, data });
        }
      } catch (error) {
        if (!cancelled) {
          setLoadState({ loading: false, error: errorToMessage(error), data: null });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [apiClient, route]);

  const runMutation = useCallback(
    async (operation: () => Promise<any>, next: RouteState | ((result: any) => RouteState), fallback?: RouteState) => {
      if (pending) {
        return;
      }

      setPending(true);
      setLoadState((current) => ({ ...current, error: null }));

      try {
        const result = await operation();
        const resolvedNext = typeof next === 'function' ? next(result) : next;
        setLoadState({ loading: true, error: null, data: null });
        go({ ...resolvedNext, refreshKey: Date.now() } as RouteState);
      } catch (error) {
        setLoadState((current) => ({ ...current, error: errorToMessage(error) }));
        if (fallback) {
          go(fallback);
        }
      } finally {
        setPending(false);
      }
    },
    [go, pending]
  );

  const continueAfterBlockerFinish = useCallback(
    async (employeeId: string): Promise<RouteState> => {
      const refreshed = await getManagerEmployeeCard(apiClient, employeeId);
      const employee = refreshed.employee;

      return {
        screenId: hasAnyBlocker(employee?.blockers) ? 'S03-E12' : 'S03-E10',
        employee_id: employeeId
      };
    },
    [apiClient]
  );

  const view = useMemo<PeaksGraphNodeView>(() => {
    if (loadState.error) {
      return screenView(route.screenId, [
        info('Ошибка'),
        message(loadState.error)
      ], [
        button('Повторить', 'lightBlue', () => go({ ...route, refreshKey: Date.now() })),
        backButton(back)
      ]);
    }

    if (loadState.loading) {
      return screenView(route.screenId, [info('Загрузка...')], []);
    }

    return buildSection03View({
      apiClient,
      route,
      data: loadState.data,
      pending,
      numericInput,
      setNumericInput,
      commentInput,
      setCommentInput,
      dateInput,
      setDateInput,
      go,
      back,
      runMutation,
      continueAfterBlockerFinish
    });
  }, [
    apiClient,
    back,
    commentInput,
    continueAfterBlockerFinish,
    dateInput,
    go,
    loadState.data,
    loadState.error,
    loadState.loading,
    numericInput,
    pending,
    route,
    runMutation
  ]);

  return <PeaksGraphNodeRenderer view={view} />;
}

type BuildContext = {
  apiClient: ApiClient;
  route: RouteState;
  data: any;
  pending: boolean;
  numericInput: string;
  setNumericInput: React.Dispatch<React.SetStateAction<string>>;
  commentInput: string;
  setCommentInput: React.Dispatch<React.SetStateAction<string>>;
  dateInput: string;
  setDateInput: React.Dispatch<React.SetStateAction<string>>;
  go: (route: RouteState) => void;
  back: () => void;
  runMutation: (operation: () => Promise<any>, next: RouteState | ((result: any) => RouteState), fallback?: RouteState) => Promise<void>;
  continueAfterBlockerFinish: (employeeId: string) => Promise<RouteState>;
};

function buildSection03View(ctx: BuildContext): PeaksGraphNodeView {
  const { route, data, go, back } = ctx;

  switch (route.screenId) {
    case 'S03-N01':
      return renderMain(ctx);
    case 'S03-M01':
      return renderMachines(ctx);
    case 'S03-M02':
      return renderMachineCard(ctx);
    case 'S03-M03O':
      return renderOperationalDowntimeConfirm(ctx);
    case 'S03-M03C':
      return renderCommentScreen(ctx, 'S03-M03C', 'Комментарий', 'comment_finish', () =>
        go({ ...route, screenId: 'S03-M04C', finish_comment: ctx.commentInput } as RouteState & { finish_comment: string })
      );
    case 'S03-M04C':
      return renderCriticalDowntimeFinishConfirm(ctx);
    case 'S03-D01':
      return renderDowntimes(ctx);
    case 'S03-D10':
      return renderDowntimeTypes(ctx);
    case 'S03-D11':
      return renderDowntimeMachineSelect(ctx);
    case 'S03-D12':
      return renderCommentScreen(ctx, 'S03-D12', 'Комментарий', 'comment_start', () =>
        go({ ...route, screenId: 'S03-D13', start_comment: ctx.commentInput } as RouteState & { start_comment: string })
      );
    case 'S03-D13':
      return renderCriticalDowntimeStartConfirm(ctx);
    case 'S03-E01':
      return renderEmployees(ctx);
    case 'S03-E02':
      return renderEmployeeCard(ctx);
    case 'S03-E12':
      return renderShiftBlockers(ctx);
    case 'S03-E13':
      return renderNumericScreen(ctx, 'S03-E13', 'Введите количество сделанной продукции', 'Количество', () =>
        go({ ...route, screenId: 'S03-E14', quantity_produced: normalizeNumericInputForApi(ctx.numericInput) } as RouteState & { quantity_produced: string })
      );
    case 'S03-E14':
      return renderFinishProductionBlockerConfirm(ctx);
    case 'S03-E16':
      return renderFinishBreakBlockerConfirm(ctx);
    case 'S03-E17':
      return renderFinishAdditionalWorkBlockerConfirm(ctx);
    case 'S03-E10':
      return renderCommentScreen(ctx, 'S03-E10', 'Комментарий', 'shift_finish_reason', () =>
        go({ ...route, screenId: 'S03-E11', shift_finish_reason: ctx.commentInput } as RouteState & { shift_finish_reason: string })
      );
    case 'S03-E11':
      return renderCloseShiftConfirm(ctx);
    case 'S03-E20':
      return renderPeriodMenu(ctx, 'S03-E20', 'Выполненные работы', (period) => go({ ...route, screenId: 'S03-E21', period }));
    case 'S03-E21':
      return renderCompletedWorksList(ctx, 'S03-E21');
    case 'S03-E22':
      return renderCompletedWorkCard(ctx, 'S03-E22');
    case 'S03-AW01':
      return renderAdditionalWorks(ctx);
    case 'S03-AW10':
    case 'S03-AW20':
    case 'S03-AW30':
    case 'S03-AW50':
      return renderAdditionalWorkCard(ctx);
    case 'S03-AW11':
      return renderAdditionalWorkConfirm(ctx, 'Согласовать', 'green', () =>
        ctx.runMutation(() => approveAdditionalWorkRequest(ctx.apiClient, mustAdditionalWorkId(route)), { screenId: 'S03-AW01' })
      );
    case 'S03-AW12':
      return renderAdditionalWorkConfirm(ctx, 'Отклонить', 'gray', () =>
        ctx.runMutation(() => rejectAdditionalWorkRequest(ctx.apiClient, mustAdditionalWorkId(route)), { screenId: 'S03-AW01' })
      );
    case 'S03-AW21':
      return renderAdditionalWorkConfirm(ctx, 'Отменить', 'gray', () =>
        ctx.runMutation(() => cancelAdditionalWork(ctx.apiClient, mustAdditionalWorkId(route)), { screenId: 'S03-AW01' })
      );
    case 'S03-AW31':
      return renderAdditionalWorkConfirm(ctx, 'Завершить доп. работу', 'gray', () =>
        ctx.runMutation(() => finishManagerAdditionalWork(ctx.apiClient, mustAdditionalWorkId(route), 'Завершено начальником производства'), { screenId: 'S03-AW01' })
      );
    case 'S03-AW51':
      return renderNumericScreen(ctx, 'S03-AW51', 'Введите сумму начисления', 'Сумма', () =>
        go({ ...route, screenId: 'S03-AW52', amount_uzs: normalizeNumericInputForApi(ctx.numericInput) } as RouteState & { amount_uzs: string })
      );
    case 'S03-AW52':
      return renderAccrueAdditionalWorkConfirm(ctx);
    case 'S03-AW53':
      return renderCommentScreen(ctx, 'S03-AW53', 'Комментарий', 'without_accrual_reason', () =>
        go({ ...route, screenId: 'S03-AW54', without_accrual_reason: ctx.commentInput } as RouteState & { without_accrual_reason: string })
      );
    case 'S03-AW54':
      return renderWithoutAccrualConfirm(ctx);
    case 'S03-AW40':
      return renderAssignEmployeeSelect(ctx);
    case 'S03-AW41':
      return renderAssignAdditionalWorkTypeSelect(ctx);
    case 'S03-AW42':
      return renderAssignAdditionalWorkConfirm(ctx);
    case 'S03-C00':
      return screenView('S03-C00', [info('Корректировки'), button('Финансы', 'lightBlue', () => go({ screenId: 'S03-CF01' })), button('Производство', 'lightBlue', () => go({ screenId: 'S03-CP00' }))], [backButton(back)]);
    case 'S03-CF01':
      return screenView('S03-CF01', [info('Финансовая корректировка'), button('Корректировка по сотруднику', 'lightBlue', () => go({ screenId: 'S03-CF10' })), button('Сторно по операции', 'lightBlue', () => go({ screenId: 'S03-CF20' }))], [backButton(back)]);
    case 'S03-CF10':
      return renderFinancialCorrectionEmployeeSelect(ctx);
    case 'S03-CF11':
      return screenView('S03-CF11', [info('Финансовая корректировка'), message(employeeName(route.employee)), button('Начислить', 'green', () => go({ ...route, screenId: 'S03-CF12', correctionMode: 'accrual' })), button('Удержать', 'red', () => go({ ...route, screenId: 'S03-CF12', correctionMode: 'withholding' }))], [backButton(back)]);
    case 'S03-CF12':
      return renderNumericScreen(ctx, 'S03-CF12', 'Финансовая корректировка', 'Сумма', () =>
        go({ ...route, screenId: 'S03-CF13', amount_uzs: normalizeNumericInputForApi(ctx.numericInput) } as RouteState & { amount_uzs: string })
      );
    case 'S03-CF13':
      return renderCommentScreen(ctx, 'S03-CF13', 'Комментарий', 'financial_correction_reason', () =>
        go({ ...route, screenId: 'S03-CF14', financial_correction_reason: ctx.commentInput } as RouteState & { financial_correction_reason: string })
      );
    case 'S03-CF14':
      return renderFinancialCorrectionConfirm(ctx);
    case 'S03-CF20':
      return renderGenericEmployeeSelect(ctx, 'S03-CF20', 'Финансовая корректировка', (employee) => go({ screenId: 'S03-CF21', employee_id: String(employee.employee_id), employee }));
    case 'S03-CF21':
      return renderPeriodMenu(ctx, 'S03-CF21', 'Финансовая корректировка', (period) => go({ ...route, screenId: 'S03-CF22', period }));
    case 'S03-CF22':
      return renderCompletedWorksList(ctx, 'S03-CF22');
    case 'S03-CF23':
      return renderCompletedWorkCard(ctx, 'S03-CF23');
    case 'S03-CF24':
      return renderCommentScreen(ctx, 'S03-CF24', 'Комментарий', 'reversal_reason', () =>
        go({ ...route, screenId: 'S03-CF25', reversal_reason: ctx.commentInput } as RouteState & { reversal_reason: string })
      );
    case 'S03-CF25':
      return renderStornoConfirm(ctx);
    case 'S03-CP00':
      return screenView('S03-CP00', [info('Производственная корректировка'), button('По сотруднику', 'lightBlue', () => go({ screenId: 'S03-CP10' })), button('По станку', 'lightBlue', () => go({ screenId: 'S03-CP20' }))], [backButton(back)]);
    case 'S03-CP10':
      return renderGenericEmployeeSelect(ctx, 'S03-CP10', 'Производственная корректировка', (employee) => go({ screenId: 'S03-CP11', employee_id: String(employee.employee_id), employee }));
    case 'S03-CP20':
      return renderMachineSelectForProductionCorrection(ctx);
    case 'S03-CP11':
      return renderPeriodMenu(ctx, 'S03-CP11', 'Производственная корректировка', (period) => go({ ...route, screenId: 'S03-CP12', period }));
    case 'S03-CP12':
      return renderProductionOperationsForCorrection(ctx);
    case 'S03-CP13':
      return screenView('S03-CP13', [info('Производственная корректировка'), button('Увеличить', 'lightBlue', () => go({ ...route, screenId: 'S03-CP14', productionCorrectionMode: 'increase' })), button('Уменьшить', 'lightBlue', () => go({ ...route, screenId: 'S03-CP14', productionCorrectionMode: 'decrease' })), button('Ввод итоговой суммы', 'lightBlue', () => go({ ...route, screenId: 'S03-CP14', productionCorrectionMode: 'final' }))], [backButton(back)]);
    case 'S03-CP14':
      return renderNumericScreen(ctx, 'S03-CP14', 'Производственная корректировка', 'Количество', () =>
        go({ ...route, screenId: 'S03-CP15', correction_quantity: normalizeNumericInputForApi(ctx.numericInput) } as RouteState & { correction_quantity: string })
      );
    case 'S03-CP15':
      return renderCommentScreen(ctx, 'S03-CP15', 'Комментарий', 'production_correction_reason', () =>
        go({ ...route, screenId: 'S03-CP16', production_correction_reason: ctx.commentInput } as RouteState & { production_correction_reason: string })
      );
    case 'S03-CP16':
      return renderProductionCorrectionConfirm(ctx);
    case 'S03-SAL01':
      return renderGenericJsonScreen('S03-SAL01', 'Зарплата', data, back);
    case 'S03-SAL02':
      return renderGenericJsonScreen('S03-SAL02', 'История зарплаты', data, back);
    case 'S03-NOT01':
      return renderNotifications(ctx);
    case 'S03-R01':
      return screenView('S03-R01', [info('Отчёты'), button('Выгрузка в Google Таблицы', 'lightBlue', () => go({ screenId: 'S03-R10' }))], [backButton(back)]);
    case 'S03-R10':
      return renderReportsPeriodMenu(ctx);
    case 'S03-R11':
      return renderDateScreen(ctx, 'S03-R11', 'Дата начала', (date) => go({ ...route, screenId: 'S03-R12', from_date: date }));
    case 'S03-R12':
      return renderDateScreen(ctx, 'S03-R12', 'Дата окончания', (date) => go({ ...route, screenId: 'S03-R13', to_date: date }));
    case 'S03-R13':
      return renderExportConfirm(ctx);
    case 'S03-R14':
      return screenView('S03-R14', [info('Выгрузка создана'), message(`Заявка на выгрузку создана.\nExport run: ${route.export_run_id ?? '—'}\nДанные будут сформированы в Google Таблицах после выполнения backend export worker.`)], [button('На главный экран', 'lightBlue', () => go({ screenId: 'S03-N01' }), 'fixed55')]);
    default:
      return screenView(route.screenId, [info('Экран S03'), message(`Экран ${route.screenId} ожидает реализации renderer branch.`)], [backButton(back)]);
  }
}

function resolveLoader(apiClient: ApiClient, route: RouteState): (() => Promise<any>) | null {
  switch (route.screenId) {
    case 'S03-N01':
      return async () => {
        const workplace = await getManagerWorkplaceState(apiClient);
        try {
          const notifications = await getManagerNotificationsOpenTasks(apiClient);
          return {
            ...workplace,
            sections: {
              ...(workplace?.sections ?? {}),
              notifications: {
                ...(workplace?.sections?.notifications ?? {}),
                open_tasks_count: notifications?.open_tasks_count ?? workplace?.sections?.notifications?.open_tasks_count
              }
            }
          };
        } catch {
          return workplace;
        }
      };
    case 'S03-M01':
    case 'S03-D11':
    case 'S03-CP20':
      return () => getManagerMachines(apiClient);
    case 'S03-M02':
    case 'S03-M03O':
    case 'S03-M03C':
    case 'S03-M04C':
    case 'S03-D13':
      return route.machine_id ? () => getManagerMachineCard(apiClient, route.machine_id as string) : null;
    case 'S03-D01':
      return () => getManagerDowntimes(apiClient);
    case 'S03-D10':
      return () => getManagerCriticalDowntimeTypes(apiClient);
    case 'S03-E01':
    case 'S03-CF20':
    case 'S03-CP10':
    case 'S03-AW40':
      return () => getManagerEmployees(apiClient);
    case 'S03-E02':
    case 'S03-E10':
    case 'S03-E11':
    case 'S03-E12':
    case 'S03-E13':
    case 'S03-E14':
    case 'S03-E16':
    case 'S03-E17':
      return route.employee_id ? () => getManagerEmployeeCard(apiClient, route.employee_id as string) : null;
    case 'S03-E21':
    case 'S03-CF22':
      return route.employee_id && route.period
        ? () => getManagerEmployeeCompletedWorks(apiClient, route.employee_id as string, route.period as S03Period, 'all')
        : null;
    case 'S03-E22':
    case 'S03-CF23':
      return route.employee_id && route.work_type && route.operation_id
        ? () => getManagerEmployeeCompletedWorkCard(apiClient, route.employee_id as string, route.work_type as S03WorkType, route.operation_id as string)
        : null;
    case 'S03-AW01':
    case 'S03-AW10':
    case 'S03-AW20':
    case 'S03-AW30':
    case 'S03-AW50':
    case 'S03-AW11':
    case 'S03-AW12':
    case 'S03-AW21':
    case 'S03-AW31':
    case 'S03-AW52':
    case 'S03-AW54':
      return () => getManagerAdditionalWorks(apiClient);
    case 'S03-AW41':
      return () => getManagerAdditionalWorkTypesAvailable(apiClient);
    case 'S03-CF10':
      return () => getManagerSalaryCorrectionContext(apiClient);
    case 'S03-CP12':
      if (route.machine_id && route.period) {
        return () => getManagerMachineCompletedProductionOperations(apiClient, route.machine_id as string, route.period as S03Period);
      }
      if (route.employee_id && route.period) {
        return () => getManagerEmployeeCompletedWorks(apiClient, route.employee_id as string, route.period as S03Period, 'production');
      }
      return null;
    case 'S03-SAL01':
      return route.employee_id ? () => getManagerEmployeeSalary(apiClient, route.employee_id as string) : null;
    case 'S03-SAL02':
      return route.employee_id ? () => getManagerEmployeeSalaryHistory(apiClient, route.employee_id as string) : null;
    case 'S03-NOT01':
      return () => getManagerNotificationsOpenTasks(apiClient);
    default:
      return null;
  }
}

function renderMain(ctx: BuildContext): PeaksGraphNodeView {
  const sections = ctx.data?.sections ?? {};
  const machines = sections.machines ?? {};
  const employees = sections.employees ?? {};
  const downtimes = sections.downtimes ?? {};
  const additionalWorks = sections.additional_works ?? {};
  const notifications = sections.notifications ?? {};

  return {
    nodeId: 'S03-N01',
    ariaLabel: `S03-N01 ${SECTION03_V17_CONTRACT_ID}`,
    className: 'peaks-s03-screen',
    scrollObjects: [
      mainTile(
        'OPEN_MACHINES',
        'Станки',
        [
          tileLine(`Работают: ${value(machines.running_count)}`, positiveTone(machines.running_count, 'green')),
          tileLine(`Простои: ${value(machines.downtime_count)}`, severityTone(machines.downtime_severity)),
          tileLine(`Не работают: ${value(machines.idle_count)}`, 'blue')
        ],
        'blue',
        () => ctx.go({ screenId: 'S03-M01' })
      ),
      mainTile(
        'OPEN_EMPLOYEES',
        'Сотрудники',
        [
          tileLine(`Смена открыта: ${value(employees.open_shift_count)}`, 'blue'),
          tileLine(`Производство: ${value(employees.production_count)}`, positiveTone(employees.production_count, 'green')),
          tileLine(`Простой: ${value(employees.downtime_count)}`, severityTone(employees.downtime_severity ?? employees.production_downtime_severity)),
          tileLine(`Доп. работы: ${value(employees.additional_work_count)}`, 'gray'),
          tileLine(`Перерыв: ${value(employees.break_count)}`, positiveTone(employees.break_count, 'yellow')),
          tileLine(`Без работы: ${value(employees.without_work_count)}`, 'blue')
        ],
        'blue',
        () => ctx.go({ screenId: 'S03-E01' })
      ),
      mainTile(
        'OPEN_DOWNTIMES',
        'Простои',
        [
          tileLine(`Критический: ${value(downtimes.critical_count)}`, positiveTone(downtimes.critical_count, 'red')),
          tileLine(`Операционный: ${value(downtimes.operational_count)}`, positiveTone(downtimes.operational_count, 'yellow'))
        ],
        'blue',
        () => ctx.go({ screenId: 'S03-D01' })
      ),
      mainTile(
        'OPEN_ADDITIONAL_WORKS',
        'Доп. работы',
        [
          tileLine(`Запрошено: ${value(additionalWorks.requested_count)}`, 'gray'),
          tileLine(`Согласовано: ${value(additionalWorks.approved_count)}`, 'gray'),
          tileLine(`В работе: ${value(additionalWorks.active_count)}`, positiveTone(additionalWorks.active_count, 'green', 'gray')),
          tileLine(`Требуют начисления: ${value(additionalWorks.requires_accrual_count)}`, positiveTone(additionalWorks.requires_accrual_count, 'green', 'gray'))
        ],
        'gray',
        () => ctx.go({ screenId: 'S03-AW01' })
      ),
      mainTile('OPEN_CORRECTIONS', 'Корректировки', [], 'blue', () => ctx.go({ screenId: 'S03-C00' })),
      mainTile('OPEN_NOTIFICATIONS', 'Уведомления', [tileLine(`Открытые задачи: ${value(notifications.open_tasks_count)}`, 'blue')], 'blue', () => ctx.go({ screenId: 'S03-NOT01' })),
      mainTile('OPEN_REPORTS', 'Отчёты', [], 'blue', () => ctx.go({ screenId: 'S03-R01' }))
    ]
  };
}

function sourceDataRequiredView(screenId: Section03V17ScreenId, source: string, back: () => void): PeaksGraphNodeView {
  return screenView(screenId, [
    info('Ошибка'),
    message(`Не получены данные read-model: ${source}`)
  ], [backButton(back)]);
}

function renderMachines(ctx: BuildContext): PeaksGraphNodeView {
  const machines = array(ctx.data?.machines);
  return screenView('S03-M01', [
    info('Станки'),
    ...emptyAwareList(machines, 'Нет станков для отображения.', (machine) => {
      const hasDowntime = hasMachineActiveDowntime(machine);
      const hasProduction = hasMachineActiveProduction(machine);

      return listRow(
        `machine-${machine.machine_id}`,
        'OPEN_MACHINE_CARD',
        machineListRowVariant(machine),
        [machine.machine_name, machine.active_sku_name ? `SKU: ${machine.active_sku_name}` : null, machine.active_employee_full_name].filter(Boolean).join('\n'),
        '',
        false,
        () => ctx.go({ screenId: 'S03-M02', machine_id: String(machine.machine_id), refreshKey: Date.now() })
      );
    })
  ], [backButton(ctx.back)]);
}

function renderMachineCard(ctx: BuildContext): PeaksGraphNodeView {
  const machine = ctx.data?.machine;
  if (!machine) {
    return sourceDataRequiredView('S03-M02', 'GET /manager/machines/:machine_id', ctx.back);
  }

  const hasDowntime = hasMachineActiveDowntime(machine);
  const hasProduction = hasMachineActiveProduction(machine);
  const lines = hasDowntime
    ? compactLines([
        ['Станок', machine.machine_name],
        ['SKU', machine.active_sku_name],
        ['Сотрудник', machine.active_employee_full_name],
        ['Причина простоя', machine.downtime_name],
        ['Комментарий', machine.downtime_type === 'critical' ? machine.downtime_start_comment ?? machine.downtime_comment : null],
        ['Время начала простоя', formatTimeHHMM(machine.downtime_started_at)],
        ['Длительность простоя', machine.downtime_duration]
      ])
    : hasProduction
      ? compactLines([
          ['Станок', machine.machine_name],
          ['SKU', machine.active_sku_name],
          ['Сотрудник', machine.active_employee_full_name]
        ])
      : compactLines([
          ['Станок', machine.machine_name]
        ]);

  const actions: PeaksGraphObject[] = [];
  if (machine.active_downtime_id && machine.downtime_type === 'operational') {
    actions.push(button(`Завершить: ${machine.downtime_name ?? 'простой'}`, 'yellow', () => ctx.go({ ...ctx.route, screenId: 'S03-M03O', downtime_id: String(machine.active_downtime_id), refreshKey: Date.now() }), 'fixed55'));
  } else if (machine.active_downtime_id && machine.downtime_type === 'critical') {
    actions.push(button(`Завершить: ${machine.downtime_name ?? 'простой'}`, 'red', () => ctx.go({ ...ctx.route, screenId: 'S03-M03C', downtime_id: String(machine.active_downtime_id), refreshKey: Date.now() }), 'fixed55'));
  } else if (!machine.active_downtime_id && (machine.ui_state === 'idle' || hasProduction)) {
    actions.push(button('Начать простой', 'red', () => ctx.go({ screenId: 'S03-D10', machine_id: String(machine.machine_id), refreshKey: Date.now() }), 'fixed55'));
  }

  const tone: PeaksGraphCardTone = hasDowntime ? cardTone(machine.ui_variant) : hasProduction ? 'green' : 'gray';
  return screenView('S03-M02', [card(lines, tone)], [...actions, backButton(ctx.back)]);
}



function renderOperationalDowntimeConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const machine = ctx.data?.machine;
  if (!machine) {
    return sourceDataRequiredView('S03-M03O', 'GET /manager/machines/:machine_id', ctx.back);
  }

  return screenView('S03-M03O', [
    info('Подтвердите завершение простоя'),
    card(compactLines([
      ['Станок', machine.machine_name],
      ['SKU', machine.active_sku_name],
      ['Сотрудник', machine.active_employee_full_name],
      ['Причина простоя', machine.downtime_name]
    ]), 'yellow')
  ], [
    button(`Завершить: ${machine.downtime_name ?? 'простой'}`, 'yellow', () =>
      ctx.runMutation(
        () => finishMachineDowntime(ctx.apiClient, String(ctx.route.downtime_id ?? machine.active_downtime_id)),
        ctx.route.returnTo === 'S03-D12'
          ? { ...ctx.route, screenId: 'S03-D12' }
          : { screenId: ctx.route.origin === 'S03-D01' ? 'S03-D01' : 'S03-M01' }
      ),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}



function renderCriticalDowntimeFinishConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const machine = ctx.data?.machine;
  if (!machine) {
    return sourceDataRequiredView('S03-M04C', 'GET /manager/machines/:machine_id', ctx.back);
  }

  const comment = (ctx.route as any).finish_comment ?? ctx.commentInput;
  return screenView('S03-M04C', [
    info('Подтвердите завершение простоя'),
    card(compactLines([
      ['Станок', machine.machine_name],
      ['SKU', machine.active_sku_name],
      ['Сотрудник', machine.active_employee_full_name],
      ['Причина простоя', machine.downtime_name],
      ['Комментарий', comment]
    ]), 'red')
  ], [
    button(`Завершить: ${machine.downtime_name ?? 'простой'}`, 'red', () =>
      ctx.runMutation(
        () => finishMachineDowntime(ctx.apiClient, String(ctx.route.downtime_id ?? machine.active_downtime_id), String(comment)),
        { screenId: ctx.route.origin === 'S03-D01' ? 'S03-D01' : 'S03-M01' }
      ),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}



function renderDowntimes(ctx: BuildContext): PeaksGraphNodeView {
  const downtimes = array(ctx.data?.downtimes);
  return screenView('S03-D01', [
    info('Простои'),
    ...emptyAwareList(downtimes, 'Нет открытых простоев.', (downtime) =>
      listRow(
        `downtime-${downtime.active_downtime_id}`,
        'OPEN_MACHINE_CARD',
        rowVariant(downtime.ui_variant),
        [downtime.downtime_name, downtime.machine_name, downtime.active_sku_name ? `SKU: ${downtime.active_sku_name}` : null, downtime.active_employee_full_name, downtime.downtime_type === 'critical' ? downtime.downtime_start_comment ?? downtime.downtime_comment : null, downtime.downtime_started_at ? `Время начала простоя: ${downtime.downtime_started_at}` : null, downtime.downtime_duration ? `Длительность простоя: ${downtime.downtime_duration}` : null].filter(Boolean).join('\n'),
        '',
        false,
        () => ctx.go({ screenId: 'S03-M02', machine_id: String(downtime.machine_id), origin: 'S03-D01' })
      )
    )
  ], [button('Начать простой', 'red', () => ctx.go({ screenId: 'S03-D10', origin: 'S03-D01' }), 'fixed55'), backButton(ctx.back)]);
}

function renderDowntimeTypes(ctx: BuildContext): PeaksGraphNodeView {
  const types = array(ctx.data?.downtime_types);
  return screenView('S03-D10', [
    info('Выберите тип простоя'),
    ...emptyAwareList(types, 'Нет доступных критических простоев.', (item) =>
      listRow(`dt-${item.downtime_type_id}`, 'SELECT_DOWNTIME_TYPE', 'red', item.downtime_type_name, '', false, () =>
        ctx.route.machine_id
          ? ctx.go({ ...ctx.route, screenId: 'S03-D12', downtime_type_id: String(item.downtime_type_id), downtime_type_name: item.downtime_type_name })
          : ctx.go({ screenId: 'S03-D11', downtime_type_id: String(item.downtime_type_id), downtime_type_name: item.downtime_type_name, origin: ctx.route.origin })
      )
    )
  ], [backButton(ctx.back)]);
}

function renderDowntimeMachineSelect(ctx: BuildContext): PeaksGraphNodeView {
  const machines = array(ctx.data?.machines).filter((machine) => !machine.has_active_critical_downtime);
  return screenView('S03-D11', [
    info('Выберите станок'),
    ...emptyAwareList(machines, 'Нет доступных станков.', (machine) =>
      listRow(`d11-${machine.machine_id}`, 'SELECT_MACHINE_FOR_DOWNTIME', rowVariant(machine.ui_variant), machine.machine_name, '', false, () => {
        if (machine.has_active_operational_downtime && machine.active_operational_downtime_id) {
          ctx.go({
            ...ctx.route,
            screenId: 'S03-M03O',
            machine_id: String(machine.machine_id),
            downtime_id: String(machine.active_operational_downtime_id),
            returnTo: 'S03-D12',
            refreshKey: Date.now()
          });
          return;
        }
        ctx.go({ ...ctx.route, screenId: 'S03-D12', machine_id: String(machine.machine_id), refreshKey: Date.now() });
      })
    )
  ], [backButton(ctx.back)]);
}

function renderCriticalDowntimeStartConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const machine = ctx.data?.machine;
  if (!machine) {
    return sourceDataRequiredView('S03-D13', 'GET /manager/machines/:machine_id', ctx.back);
  }

  const comment = (ctx.route as any).start_comment ?? ctx.commentInput;
  return screenView('S03-D13', [
    info('Подтвердите начало простоя:'),
    card(compactLines([
      ['Тип простоя', ctx.route.downtime_type_name],
      ['Станок', machine.machine_name],
      ['Комментарий', comment]
    ]), 'red')
  ], [
    button(`Начать: ${ctx.route.downtime_type_name ?? 'простой'}`, 'red', () =>
      ctx.runMutation(
        () => startManagerCriticalDowntime(
          ctx.apiClient,
          must(ctx.route.machine_id, 'machine_id'),
          must(ctx.route.downtime_type_id, 'downtime_type_id'),
          machine.active_production_operation_id ? String(machine.active_production_operation_id) : null,
          String(comment)
        ),
        { screenId: 'S03-N01' }
      ),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}



function renderEmployees(ctx: BuildContext): PeaksGraphNodeView {
  const employees = array(ctx.data?.employees);
  return screenView('S03-E01', [
    info('Сотрудники'),
    ...emptyAwareList(employees, 'Нет сотрудников для отображения.', (employee) =>
      listRow(
        `employee-${employee.employee_id}`,
        'OPEN_EMPLOYEE_CARD',
        rowVariant(employee.ui_variant),
        [employee.full_name, employee.active_sku_name ? `SKU: ${employee.active_sku_name}` : null, employee.active_machine_name, employee.active_break_name, employee.active_additional_work_name].filter(Boolean).join('\n'),
        '',
        false,
        () => ctx.go({ screenId: 'S03-E02', employee_id: String(employee.employee_id) })
      )
    )
  ], [backButton(ctx.back)]);
}

function renderEmployeeCard(ctx: BuildContext): PeaksGraphNodeView {
  const employee = ctx.data?.employee;
  if (!employee) {
    return sourceDataRequiredView('S03-E02', 'GET /manager/employees/:employee_id', ctx.back);
  }

  const lines = compactLines([
    ['Сотрудник', employee.full_name],
    ['Время начала смены', formatTimeHHMM(employee.shift_started_at)],
    ['SKU', employee.active_sku_name],
    ['Станок', employee.active_machine_name],
    [null, employee.downtime_name],
    ['Комментарий', employee.downtime_type === 'critical' ? employee.downtime_start_comment ?? employee.downtime_comment : null],
    ['Время начала производства', formatTimeHHMM(employee.production_started_at)],
    ['Время начала простоя', employee.downtime_started_at],
    ['Продолжительность простоя', employee.downtime_duration],
    [null, employee.active_break_name],
    ['Время начала перерыва', employee.break_started_at],
    ['Продолжительность перерыва', employee.break_duration],
    [null, employee.active_additional_work_name],
    ['Время начала доп. работы', employee.additional_work_started_at],
    ['Продолжительность доп. работы', employee.additional_work_duration],
    employee.ui_state === 'shift_not_started' ? [null, 'Смена не начата'] : null
  ]);

  const actions: PeaksGraphObject[] = [
    button('Зарплата', 'outlineBlue', () => ctx.go({ screenId: 'S03-SAL01', employee_id: String(employee.employee_id) }), 'fixed55'),
    button('Выполненные работы', 'lightBlue', () => ctx.go({ screenId: 'S03-E20', employee_id: String(employee.employee_id) }), 'fixed55')
  ];

  if (array(employee.available_actions).includes('FINISH_EMPLOYEE_SHIFT_BY_MANAGER')) {
    actions.push(
      button(`Завершить смену ${employee.full_name ?? ''}`.trim(), 'red', () => {
        if (hasAnyBlocker(employee.blockers)) {
          ctx.go({ screenId: 'S03-E12', employee_id: String(employee.employee_id) });
          return;
        }
        ctx.go({ screenId: 'S03-E10', employee_id: String(employee.employee_id) });
      }, 'fixed55')
    );
  }

  actions.push(backButton(ctx.back));
  return screenView('S03-E02', [card(lines, cardTone(employee.ui_variant))], actions);
}

function renderShiftBlockers(ctx: BuildContext): PeaksGraphNodeView {
  const employee = ctx.data?.employee;
  if (!employee) {
    return sourceDataRequiredView('S03-E12', 'GET /manager/employees/:employee_id', ctx.back);
  }

  const employeeId = must(ctx.route.employee_id, 'employee_id');
  const blockers = employee.blockers ?? {};
  const rows: PeaksGraphObject[] = [info('Для завершения смены сначала завершите:')];

  if (blockers.production) {
    rows.push(listRow('blocker-production', 'FINISH_BLOCKER_PRODUCTION', 'green', 'Производство', '', false, () =>
      ctx.go({ screenId: 'S03-E13', employee_id: employeeId })
    ));
  }
  if (blockers.break) {
    rows.push(listRow('blocker-break', 'FINISH_BLOCKER_BREAK', 'yellow', 'Перерыв', '', false, () =>
      ctx.go({ screenId: 'S03-E16', employee_id: employeeId })
    ));
  }
  if (blockers.additional_work) {
    rows.push(listRow('blocker-aw', 'FINISH_BLOCKER_ADDITIONAL_WORK', 'gray', 'Доп. работа', '', false, () =>
      ctx.go({ screenId: 'S03-E17', employee_id: employeeId })
    ));
  }

  return screenView('S03-E12', rows, [backButton(ctx.back)]);
}

function renderFinishProductionBlockerConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const employee = ctx.data?.employee;
  if (!employee) {
    return sourceDataRequiredView('S03-E14', 'GET /manager/employees/:employee_id', ctx.back);
  }

  const employeeId = must(ctx.route.employee_id, 'employee_id');
  const blocker = employee.blockers?.production ?? {};
  const quantity = (ctx.route as any).quantity_produced;
  return screenView('S03-E14', [
    card(compactLines([
      [null, 'Подтвердите завершение производства:'],
      ['ФИО', employee.full_name],
      ['Станок', blocker.machine_name],
      ['SKU', blocker.sku_name],
      ['Количество', quantity]
    ]), 'green')
  ], [
    button('Завершить производство', 'green', () =>
      ctx.runMutation(
        async () => {
          await finishManagerProductionBlocker(ctx.apiClient, String(blocker.production_operation_id), String(quantity));
          return ctx.continueAfterBlockerFinish(employeeId);
        },
        (nextRoute) => nextRoute,
        { screenId: 'S03-E12', employee_id: employeeId }
      ),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderFinishBreakBlockerConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const employee = ctx.data?.employee;
  if (!employee) {
    return sourceDataRequiredView('S03-E16', 'GET /manager/employees/:employee_id', ctx.back);
  }

  const employeeId = must(ctx.route.employee_id, 'employee_id');
  return screenView('S03-E16', [card(compactLines([[null, 'Подтвердите завершение перерыва:'], ['ФИО', employee.full_name]]), 'yellow')], [
    button('Завершить перерыв', 'yellow', () =>
      ctx.runMutation(
        async () => {
          await finishManagerBreakBlocker(ctx.apiClient, employeeId);
          return ctx.continueAfterBlockerFinish(employeeId);
        },
        (nextRoute) => nextRoute,
        { screenId: 'S03-E12', employee_id: employeeId }
      ),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderFinishAdditionalWorkBlockerConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const employee = ctx.data?.employee;
  if (!employee) {
    return sourceDataRequiredView('S03-E17', 'GET /manager/employees/:employee_id', ctx.back);
  }

  const employeeId = must(ctx.route.employee_id, 'employee_id');
  const additionalWorkId = employee.blockers?.additional_work?.additional_work_id;
  return screenView('S03-E17', [card(compactLines([[null, 'Подтвердите завершение доп. работы:'], ['ФИО', employee.full_name]]), 'gray')], [
    button('Завершить доп. работу', 'gray', () =>
      ctx.runMutation(
        async () => {
          await finishManagerAdditionalWork(ctx.apiClient, String(additionalWorkId));
          return ctx.continueAfterBlockerFinish(employeeId);
        },
        (nextRoute) => nextRoute,
        { screenId: 'S03-E12', employee_id: employeeId }
      ),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderCloseShiftConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const employee = ctx.data?.employee;
  if (!employee) {
    return sourceDataRequiredView('S03-E11', 'GET /manager/employees/:employee_id', ctx.back);
  }

  const employeeId = must(ctx.route.employee_id, 'employee_id');
  const reason = (ctx.route as any).shift_finish_reason;
  return screenView('S03-E11', [card(compactLines([[null, 'Подтвердите завершение смены:'], ['ФИО', employee.full_name], ['Комментарий', reason]]), 'red')], [
    button(`Завершить смену ${employee.full_name ?? ''}`.trim(), 'red', () =>
      ctx.runMutation(() => closeEmployeeShiftByManager(ctx.apiClient, employeeId, String(reason)), { screenId: 'S03-E01' }),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderCompletedWorksList(ctx: BuildContext, screenId: Section03V17ScreenId): PeaksGraphNodeView {
  const works = array(ctx.data?.works);
  const title = screenId === 'S03-CF22' ? 'Финансовая корректировка' : 'Выполненные работы';
  return screenView(screenId, [
    info(title),
    ...emptyAwareList(works, 'Нет выполненных работ за выбранный период.', (work) =>
      listRow(
        `work-${work.work_item_id}`,
        'OPEN_WORK_OPERATION_CARD',
        work.work_type === 'production' ? 'green' : 'gray',
        completedWorkTitle(work),
        `Начисленная зарплата: ${money(work.salary_amount_uzs ?? work.amount_uzs)} сум`,
        false,
        () => ctx.go({ ...ctx.route, screenId: screenId === 'S03-CF22' ? 'S03-CF23' : 'S03-E22', work_type: work.work_type, operation_id: String(work.operation_id), work, salary_entry_id: work.salary_entry_id })
      )
    )
  ], [backButton(ctx.back)]);
}

function renderCompletedWorkCard(ctx: BuildContext, screenId: Section03V17ScreenId): PeaksGraphNodeView {
  const employee = ctx.data?.employee ?? ctx.route.employee ?? {};
  const work = ctx.data?.work ?? ctx.route.work ?? {};
  const actions: PeaksGraphObject[] = [];
  if (screenId === 'S03-E22' && work.work_type === 'production' && work.can_correct) {
    actions.push(button('Корректировка', 'lightBlue', () => ctx.go({ screenId: 'S03-CP13', employee_id: String(employee.employee_id), employee, work_type: work.work_type, operation_id: String(work.operation_id), work }), 'fixed55'));
  }
  if (work.can_storno && !work.is_reversed) {
    actions.push(button('Сторно', 'lightBlue', () => ctx.go({ ...ctx.route, screenId: screenId === 'S03-CF23' ? 'S03-CF24' : 'S03-CF24', work, salary_entry_id: work.salary_entry_id }), 'fixed55'));
  }
  actions.push(backButton(ctx.back));
  return screenView(screenId, [card(completedWorkCardLines(employee, work), work.work_type === 'production' ? 'green' : 'gray')], actions);
}

function renderAdditionalWorks(ctx: BuildContext): PeaksGraphNodeView {
  const groups = ctx.data?.groups ?? {};
  const objects: PeaksGraphObject[] = [info('Доп. работы')];
  const groupSpecs: Array<[string, string, PeaksListButtonVariant]> = [
    ['requested', 'Запрошено', 'whiteGray'],
    ['approved', 'Согласовано', 'gray'],
    ['active', 'В работе', 'green'],
    ['waiting_accrual', 'Требуют начисления', 'green']
  ];
  for (const [key, title, variant] of groupSpecs) {
    const items = array(groups[key]);
    if (items.length) {
      objects.push(info(title));
      objects.push(...items.map((item) => listRow(`aw-${item.additional_work_id}`, 'OPEN_ADDITIONAL_WORK_CARD', variant, `${item.employee_full_name}\n${item.additional_work_name}`, '', false, () => ctx.go({ screenId: additionalWorkTarget(item.status), additional_work_id: String(item.additional_work_id), additionalWork: item }))));
    }
  }
  if (objects.length === 1) {
    objects.push(message('Нет доп. работ для отображения.'));
  }
  return screenView('S03-AW01', objects, [button('Назначить доп. работу', 'gray', () => ctx.go({ screenId: 'S03-AW40' }), 'fixed55'), backButton(ctx.back)]);
}

function renderAdditionalWorkCard(ctx: BuildContext): PeaksGraphNodeView {
  const item = resolveAdditionalWork(ctx) ?? ctx.route.additionalWork ?? {};
  const screenId = ctx.route.screenId;
  const actions: PeaksGraphObject[] = [];
  if (screenId === 'S03-AW10') {
    actions.push(button('Согласовать', 'green', () => ctx.go({ ...ctx.route, screenId: 'S03-AW11', additionalWork: item }), 'fixed55'));
    actions.push(button('Отклонить', 'gray', () => ctx.go({ ...ctx.route, screenId: 'S03-AW12', additionalWork: item }), 'fixed55'));
  } else if (screenId === 'S03-AW20') {
    actions.push(button('Отменить', 'gray', () => ctx.go({ ...ctx.route, screenId: 'S03-AW21', additionalWork: item }), 'fixed55'));
  } else if (screenId === 'S03-AW30') {
    actions.push(button('Завершить доп. работу', 'gray', () => ctx.go({ ...ctx.route, screenId: 'S03-AW31', additionalWork: item }), 'fixed55'));
  } else if (screenId === 'S03-AW50') {
    actions.push(button('Начислить зарплату', 'green', () => ctx.go({ ...ctx.route, screenId: 'S03-AW51', additionalWork: item }), 'fixed55'));
    actions.push(button('Без начисления', 'gray', () => ctx.go({ ...ctx.route, screenId: 'S03-AW53', additionalWork: item }), 'fixed55'));
  }
  actions.push(backButton(ctx.back));
  return screenView(screenId, [card(compactLines([['ФИО', item.employee_full_name], [null, item.additional_work_name]]), cardTone(item.ui_variant ?? 'gray'))], actions);
}

function renderAdditionalWorkConfirm(ctx: BuildContext, actionLabel: string, variant: PeaksActionButtonVariant, onConfirm: () => void): PeaksGraphNodeView {
  const item = resolveAdditionalWork(ctx) ?? ctx.route.additionalWork ?? {};
  return screenView(ctx.route.screenId, [card(compactLines([[null, `Подтвердите действие: ${actionLabel}`], ['ФИО', item.employee_full_name], [null, item.additional_work_name]]), variant === 'green' ? 'green' : 'gray')], [
    button(actionLabel, variant, onConfirm, 'fixed55', ctx.pending),
    backButton(ctx.back)
  ]);
}

function renderAccrueAdditionalWorkConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const item = resolveAdditionalWork(ctx) ?? ctx.route.additionalWork ?? {};
  const amount = (ctx.route as any).amount_uzs;
  return screenView('S03-AW52', [card(compactLines([[null, 'Подтвердите начисление зарплаты:'], ['ФИО', item.employee_full_name], [null, item.additional_work_name], ['Начисленная зарплата', `${money(amount)} сум`]]), 'green')], [
    button('Начислить зарплату', 'green', () =>
      ctx.runMutation(() => accrueAdditionalWorkSalary(ctx.apiClient, mustAdditionalWorkId(ctx.route), String(amount)), { screenId: 'S03-AW01' }),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderWithoutAccrualConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const item = resolveAdditionalWork(ctx) ?? ctx.route.additionalWork ?? {};
  const reason = (ctx.route as any).without_accrual_reason;
  return screenView('S03-AW54', [card(compactLines([[null, 'Подтвердите закрытие без начисления:'], ['ФИО', item.employee_full_name], [null, item.additional_work_name], ['Комментарий', reason]]), 'gray')], [
    button('Закрыть без начисления', 'gray', () =>
      ctx.runMutation(() => markAdditionalWorkWithoutAccrual(ctx.apiClient, mustAdditionalWorkId(ctx.route), String(reason)), { screenId: 'S03-AW01' }),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderAssignEmployeeSelect(ctx: BuildContext): PeaksGraphNodeView {
  const employees = array(ctx.data?.employees);
  return screenView('S03-AW40', [
    info('Выберите сотрудника'),
    ...emptyAwareList(employees, 'Нет сотрудников.', (employee) => listRow(`aw-emp-${employee.employee_id}`, 'SELECT_EMPLOYEE', 'blue', employee.full_name, '', false, () => ctx.go({ screenId: 'S03-AW41', employee_id: String(employee.employee_id), employee })))
  ], [backButton(ctx.back)]);
}

function renderAssignAdditionalWorkTypeSelect(ctx: BuildContext): PeaksGraphNodeView {
  const types = array(ctx.data?.additional_work_types);
  return screenView('S03-AW41', [
    info('Выберите доп. работу'),
    ...emptyAwareList(types, 'Нет доступных типов доп. работ.', (item) => listRow(`aw-type-${item.additional_work_type_id}`, 'SELECT_ADDITIONAL_WORK_TYPE', 'gray', item.additional_work_name, '', false, () => ctx.go({ ...ctx.route, screenId: 'S03-AW42', additional_work_type_id: String(item.additional_work_type_id), additionalWorkType: item })))
  ], [backButton(ctx.back)]);
}

function renderAssignAdditionalWorkConfirm(ctx: BuildContext): PeaksGraphNodeView {
  return screenView('S03-AW42', [card(compactLines([[null, 'Подтвердите назначение доп. работы:'], ['ФИО', employeeName(ctx.route.employee)], [null, ctx.route.additionalWorkType?.additional_work_name]]), 'gray')], [
    button('Назначить доп. работу', 'gray', () =>
      ctx.runMutation(() => assignAdditionalWork(ctx.apiClient, must(ctx.route.employee_id, 'employee_id'), must(ctx.route.additional_work_type_id, 'additional_work_type_id')), { screenId: 'S03-AW01' }),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderFinancialCorrectionEmployeeSelect(ctx: BuildContext): PeaksGraphNodeView {
  const employees = array(ctx.data?.employees_with_today_shift);
  return screenView('S03-CF10', [
    info('Финансовая корректировка'),
    ...emptyAwareList(employees, 'Нет сотрудников со сменой за текущий день.', (employee) =>
      listRow(`cf-emp-${employee.employee_id}`, 'SELECT_EMPLOYEE', 'blue', employee.employee_full_name, '', false, () =>
        ctx.go({ screenId: 'S03-CF11', employee_id: String(employee.employee_id), employee, correctionContext: ctx.data })
      )
    )
  ], [backButton(ctx.back)]);
}

function renderFinancialCorrectionConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const mode = ctx.route.correctionMode ?? 'accrual';
  const amount = String((ctx.route as any).amount_uzs ?? '');
  const signedAmount = mode === 'withholding' ? `-${amount}` : amount;
  const reason = String((ctx.route as any).financial_correction_reason ?? '');
  const context = ctx.route.correctionContext ?? {};
  const typeId = mode === 'withholding' ? context.default_withholding_salary_correction_type_id : context.default_accrual_salary_correction_type_id;
  return screenView('S03-CF14', [card(compactLines([[null, 'Подтвердите корректировку:'], ['ФИО', employeeName(ctx.route.employee)], [null, mode === 'withholding' ? 'Удержание' : 'Начисление'], ['Сумма', signedAmount], ['Комментарий', reason]]), mode === 'withholding' ? 'red' : 'green')], [
    button(mode === 'withholding' ? 'Удержать' : 'Начислить', mode === 'withholding' ? 'red' : 'green', () =>
      ctx.runMutation(() => createAndApproveSalaryCorrection(ctx.apiClient, {
        employee_id: must(ctx.route.employee_id, 'employee_id'),
        employee_shift_id: String(ctx.route.employee?.employee_shift_id ?? ''),
        salary_correction_type_id: String(typeId ?? ''),
        amount: signedAmount,
        reason
      }), { screenId: 'S03-CF01' }),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderGenericEmployeeSelect(ctx: BuildContext, screenId: Section03V17ScreenId, title: string, onSelect: (employee: any) => void): PeaksGraphNodeView {
  const employees = array(ctx.data?.employees);
  return screenView(screenId, [
    info(title),
    ...emptyAwareList(employees, 'Нет сотрудников.', (employee) => listRow(`emp-${employee.employee_id}`, 'SELECT_EMPLOYEE', rowVariant(employee.ui_variant), employee.full_name, '', false, () => onSelect(employee)))
  ], [backButton(ctx.back)]);
}

function renderMachineSelectForProductionCorrection(ctx: BuildContext): PeaksGraphNodeView {
  const machines = array(ctx.data?.machines);
  return screenView('S03-CP20', [
    info('Производственная корректировка'),
    ...emptyAwareList(machines, 'Нет станков.', (machine) => listRow(`cp-machine-${machine.machine_id}`, 'SELECT_MACHINE', rowVariant(machine.ui_variant), machine.machine_name, '', false, () => ctx.go({ screenId: 'S03-CP11', machine_id: String(machine.machine_id), machine })))
  ], [backButton(ctx.back)]);
}

function renderProductionOperationsForCorrection(ctx: BuildContext): PeaksGraphNodeView {
  const works = array(ctx.data?.works ?? ctx.data?.operations).filter((work) => work.work_type === 'production');
  return screenView('S03-CP12', [
    info('Производственная корректировка'),
    ...emptyAwareList(works, 'Нет производственных операций за выбранный период.', (work) =>
      listRow(`cp-work-${work.operation_id}`, 'OPEN_PRODUCTION_OPERATION', 'green', completedWorkTitle(work), work.machine_name ? `Станок: ${work.machine_name}` : '', false, () =>
        ctx.go({ ...ctx.route, screenId: 'S03-CP13', work_type: 'production', operation_id: String(work.operation_id), work })
      )
    )
  ], [backButton(ctx.back)]);
}

function renderProductionCorrectionConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const work = ctx.route.work ?? {};
  const oldQuantity = String(work.old_quantity ?? work.current_quantity ?? work.quantity ?? '0');
  const correctionQuantity = String((ctx.route as any).correction_quantity ?? '0');
  const mode = ctx.route.productionCorrectionMode ?? 'final';
  const newQuantity = mode === 'increase' ? decimalAdd(oldQuantity, correctionQuantity) : mode === 'decrease' ? decimalSubtract(oldQuantity, correctionQuantity) : correctionQuantity;
  const reason = String((ctx.route as any).production_correction_reason ?? '');
  const signedCorrection = mode === 'increase' ? `+${correctionQuantity}` : mode === 'decrease' ? `-${correctionQuantity}` : correctionQuantity;
  return screenView('S03-CP16', [card(compactLines([[null, 'Подтвердите корректировку производства:'], ['ФИО', work.employee_full_name], ['Станок', work.machine_name], ['SKU', work.sku_name], ['Старое количество', oldQuantity], ['Корректировка', signedCorrection], ['Новое количество', newQuantity]]), 'green')], [
    button('Корректировать', 'lightBlue', () =>
      ctx.runMutation(() => createProductionOperationCorrection(ctx.apiClient, {
        production_operation_id: String(work.production_operation_id ?? work.operation_id),
        old_quantity: oldQuantity,
        new_quantity: newQuantity,
        reason
      }), { screenId: 'S03-CP12', employee_id: ctx.route.employee_id, employee: ctx.route.employee, machine_id: ctx.route.machine_id, machine: ctx.route.machine, period: ctx.route.period }),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderStornoConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const work = ctx.route.work ?? {};
  const reason = String((ctx.route as any).reversal_reason ?? '');
  return screenView('S03-CF25', [card(compactLines([[null, 'Подтвердите сторно:'], ['ФИО', work.employee_full_name], ['Дата', work.completed_date], ['Операция', completedWorkTitle(work)], ['Начисленная зарплата', `${money(work.amount_uzs ?? work.salary_amount_uzs)} сум`], ['Комментарий', reason]]), work.work_type === 'production' ? 'green' : 'gray')], [
    button('Сторно', 'lightBlue', () =>
      ctx.runMutation(() => reverseSalaryEntry(ctx.apiClient, String(work.salary_entry_id ?? ctx.route.salary_entry_id), reason), { ...ctx.route, screenId: 'S03-CF23' }),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderNotifications(ctx: BuildContext): PeaksGraphNodeView {
  const tasks = array(ctx.data?.tasks ?? ctx.data?.open_tasks);
  return screenView('S03-NOT01', [
    info('Уведомления'),
    ...emptyAwareList(tasks, 'Открытых задач нет.', (task) =>
      listRow(`task-${task.task_id}`, 'OPEN_TASK_SOURCE', notificationVariant(task.ui_color_token), array(task.display_lines).join('\n') || task.title || task.task_kind, '', false, () => {
        const target = task.target_screen_id as Section03V17ScreenId;
        const targetContext = task.target_context ?? {};
        ctx.go({
          screenId: target,
          machine_id: targetContext.machine_id ?? (target === 'S03-M02' ? task.entity_id : undefined),
          additional_work_id: targetContext.additional_work_id ?? (target.startsWith('S03-AW') ? task.entity_id : undefined),
          origin: 'S03-NOT01',
          returnTo: 'S03-NOT01'
        });
      })
    )
  ], [backButton(ctx.back)]);
}

function renderReportsPeriodMenu(ctx: BuildContext): PeaksGraphNodeView {
  return screenView('S03-R10', [
    info('Выберите период выгрузки'),
    button('За сегодня', 'lightBlue', () => ctx.go({ screenId: 'S03-R13', ...reportPeriodDates('today') })),
    button('За неделю', 'lightBlue', () => ctx.go({ screenId: 'S03-R13', ...reportPeriodDates('week') })),
    button('За месяц', 'lightBlue', () => ctx.go({ screenId: 'S03-R13', ...reportPeriodDates('month') })),
    button('Последние 30 дней', 'lightBlue', () => ctx.go({ screenId: 'S03-R13', ...reportPeriodDates('last_30_days') })),
    button('Выбрать период вручную', 'lightBlue', () => ctx.go({ screenId: 'S03-R11' }))
  ], [backButton(ctx.back)]);
}

function renderExportConfirm(ctx: BuildContext): PeaksGraphNodeView {
  const fromDate = String(ctx.route.from_date ?? '');
  const toDate = String(ctx.route.to_date ?? '');
  return screenView('S03-R13', [card(compactLines([[null, 'Подтвердите выгрузку:'], ['Тип', 'Выгрузка в Google Таблицы'], ['Период', `${fromDate} — ${toDate}`], [null, 'Состав выгрузки:\nЗарплата свод\nЗарплата детали\nДоп. работы\nСтанки свод\nСтанки детали']]), 'gray')], [
    button('Создать выгрузку', 'lightBlue', () =>
      ctx.runMutation(
        () => createGoogleSheetsExport(ctx.apiClient, fromDate, toDate),
        (result) => ({ screenId: 'S03-R14', export_run_id: String(result.export_run_id ?? result.id ?? '—') })
      ),
      'fixed55',
      ctx.pending
    ),
    backButton(ctx.back)
  ]);
}

function renderPeriodMenu(ctx: BuildContext, screenId: Section03V17ScreenId, title: string, onPeriod: (period: S03Period) => void): PeaksGraphNodeView {
  return screenView(screenId, [
    info(title),
    button('За сегодня', 'lightBlue', () => onPeriod('today')),
    button('За неделю', 'lightBlue', () => onPeriod('week')),
    button('За месяц', 'lightBlue', () => onPeriod('month')),
    button('Последние 30 дней', 'lightBlue', () => onPeriod('last_30_days'))
  ], [backButton(ctx.back)]);
}

function renderCommentScreen(ctx: BuildContext, screenId: Section03V17ScreenId, title: string, fieldName: string, onNext: () => void): PeaksGraphNodeView {
  return screenView(screenId, [
    info(title),
    {
      kind: 'custom',
      id: `${screenId}-comment`,
      node: <PeaksCommentInputKeyboard ariaLabel={title} name={fieldName} value={ctx.commentInput} onChange={ctx.setCommentInput} />
    }
  ], [
    button('Далее', 'lightBlue', onNext, 'fixed55', isEmptyCommentInput(ctx.commentInput) || ctx.pending),
    backButton(ctx.back)
  ]);
}

function renderNumericScreen(ctx: BuildContext, screenId: Section03V17ScreenId, title: string, placeholder: string, onNext: () => void): PeaksGraphNodeView {
  return screenView(screenId, [
    info(title),
    {
      kind: 'custom',
      id: `${screenId}-numeric`,
      node: <PeaksNumericInputKeyboard ariaLabel={placeholder} placeholder={placeholder} value={ctx.numericInput} onChange={ctx.setNumericInput} />
    }
  ], [
    button('Далее', 'lightBlue', onNext, 'fixed55', isMalformedNumericInput(ctx.numericInput) || ctx.pending),
    backButton(ctx.back)
  ]);
}

function renderDateScreen(ctx: BuildContext, screenId: Section03V17ScreenId, title: string, onNext: (date: string) => void): PeaksGraphNodeView {
  return screenView(screenId, [
    info(title),
    {
      kind: 'custom',
      id: `${screenId}-date`,
      className: 'peaks-s03-date-input-object',
      node: (
        <label className="peaks-s03-date-input-label">
          <span>{title}</span>
          <input className="peaks-s03-date-input" type="date" value={ctx.dateInput} onChange={(event) => ctx.setDateInput(event.target.value)} />
        </label>
      )
    }
  ], [
    button('Далее', 'lightBlue', () => onNext(ctx.dateInput), 'fixed55', !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(ctx.dateInput)),
    backButton(ctx.back)
  ]);
}

function renderGenericJsonScreen(screenId: Section03V17ScreenId, title: string, data: any, onBack: () => void): PeaksGraphNodeView {
  return screenView(screenId, [info(title), message(formatLooseReadModel(data))], [backButton(onBack)]);
}

function screenView(nodeId: string, scrollObjects: PeaksGraphObject[], fixedBottomObjects?: PeaksGraphObject[]): PeaksGraphNodeView {
  const [firstObject, ...remainingScrollObjects] = scrollObjects;
  const hasFixedTitle = firstObject?.kind === 'infoText';

  return {
    nodeId,
    ariaLabel: `${nodeId} ${SECTION03_V17_CONTRACT_ID}`,
    className: 'peaks-s03-screen peaks-s03-screen--v17-bound',
    fixedTopObjects: hasFixedTitle ? [firstObject] : undefined,
    scrollObjects: hasFixedTitle ? remainingScrollObjects : scrollObjects,
    fixedBottomObjects
  };
}

function info(text: ReactNode): PeaksGraphObject {
  return { kind: 'infoText', text, tone: 'blue' };
}

function message(text: ReactNode): PeaksGraphObject {
  return { kind: 'messageText', text };
}

function card(lines: Array<{ label: string; value: ReactNode }>, tone: PeaksGraphCardTone): PeaksGraphObject {
  return { kind: 'productionOperationCard', lines, tone };
}

function button(label: ReactNode, variant: PeaksActionButtonVariant, onClick: () => void, size: 'main70' | 'fixed55' | 'salary55' = 'main70', disabled = false): PeaksGraphObject {
  return {
    kind: 'actionButton',
    actionId: String(label),
    icon: 'back.svg',
    label,
    variant,
    size,
    disabled,
    showIcon: false,
    onClick
  };
}

function backButton(onClick: () => void): PeaksGraphObject {
  return {
    kind: 'actionButton',
    actionId: BACK_ACTION_ID,
    icon: 'back.svg',
    label: 'Назад',
    variant: 'outlineBlue',
    size: FIXED_BACK_SIZE,
    showIcon: false,
    onClick
  };
}

function listRow(id: string, actionId: string, variant: PeaksListButtonVariant, mainLine: ReactNode, secondaryLine: ReactNode, disabled: boolean, onClick: () => void): PeaksGraphObject {
  return {
    kind: 'listButton',
    id,
    actionId,
    variant,
    mainLine,
    secondaryLine,
    disabled,
    onClick
  };
}

type S03TileLineTone = 'blue' | 'green' | 'red' | 'yellow' | 'gray';
type S03TileLine = {
  text: string;
  tone: S03TileLineTone;
};

function tileLine(text: string, tone: S03TileLineTone): S03TileLine {
  return { text, tone };
}

function numberValue(input: any): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveTone(input: any, activeTone: S03TileLineTone, emptyTone: S03TileLineTone = 'blue'): S03TileLineTone {
  return numberValue(input) > 0 ? activeTone : emptyTone;
}

function severityTone(severity: any): S03TileLineTone {
  if (severity === 'critical') return 'red';
  if (severity === 'operational') return 'yellow';
  return 'blue';
}

function renderTileLines(lines: S03TileLine[]): ReactNode {
  if (!lines.length) {
    return '';
  }

  return (
    <span className="peaks-s03-main-tile-lines">
      {lines.map((line, index) => (
        <span key={`${line.text}-${index}`} className={`peaks-s03-main-tile-line peaks-s03-main-tile-line--${line.tone}`}>
          {line.text}
        </span>
      ))}
    </span>
  );
}

function mainTile(actionId: string, title: string, lines: S03TileLine[], variant: PeaksListButtonVariant, onClick: () => void): PeaksGraphObject {
  return listRow(`tile-${actionId}`, actionId, variant, title, renderTileLines(lines), false, onClick);
}

function compactLines(entries: Array<[string | null, ReactNode] | null>): Array<{ label: string; value: ReactNode }> {
  return entries
    .filter((entry): entry is [string | null, ReactNode] => Boolean(entry))
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value], index) => ({ label: label ?? ` `, value: label ? value : value ?? `line-${index}` }));
}

function formatTimeHHMM(input: any): string {
  if (input === null || input === undefined || input === '') {
    return '';
  }

  const raw = String(input);
  const directMatch = raw.match(/T?(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/);
  if (directMatch) {
    return `${directMatch[1]}:${directMatch[2]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  return raw;
}

function emptyAwareList<T>(items: T[], emptyText: string, render: (item: T) => PeaksGraphObject): PeaksGraphObject[] {
  if (!items.length) {
    return [message(emptyText)];
  }
  return items.map(render);
}

function array(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function value(input: any): string {
  if (input === null || input === undefined || input === '') {
    return '0';
  }
  return String(input);
}

function money(input: any): string {
  if (input === null || input === undefined || input === '') {
    return '0';
  }
  return String(input);
}

function hasMachineActiveDowntime(machine: any): boolean {
  return Boolean(machine?.active_downtime_id);
}

function hasMachineActiveProduction(machine: any): boolean {
  if (hasMachineActiveDowntime(machine)) return false;
  return Boolean(
    machine?.active_production_operation_id ??
    machine?.production_operation_id ??
    machine?.active_operation_id
  ) || machine?.ui_state === 'running' || Boolean(machine?.active_sku_name && machine?.active_employee_full_name);
}

function machineListRowVariant(machine: any): PeaksListButtonVariant {
  if (hasMachineActiveDowntime(machine)) {
    if (machine?.downtime_type === 'critical' || machine?.ui_variant === 'red' || machine?.ui_state === 'critical') {
      return 'red';
    }
    return 'yellow';
  }

  if (hasMachineActiveProduction(machine)) {
    return 'green';
  }

  return rowVariant(machine?.ui_variant);
}

function rowVariant(input: any): PeaksListButtonVariant {
  if (input === 'light_blue' || input === 'blue') return 'blue';
  if (input === 'green') return 'green';
  if (input === 'yellow') return 'yellow';
  if (input === 'red' || input === 'critical') return 'red';
  if (input === 'white' || input === 'white_gray_inactive') return 'whiteGray';
  return 'gray';
}

function notificationVariant(input: any): PeaksListButtonVariant {
  if (input === 'red') return 'red';
  if (input === 'yellow') return 'yellow';
  if (input === 'green') return 'green';
  return 'gray';
}

function colorBySeverity(severity: any, fallback: PeaksListButtonVariant): PeaksListButtonVariant {
  if (severity === 'critical') return 'red';
  if (severity === 'operational') return 'yellow';
  return fallback;
}

function cardTone(input: any): PeaksGraphCardTone {
  if (input === 'red' || input === 'critical') return 'red';
  if (input === 'yellow' || input === 'warning') return 'yellow';
  if (input === 'green') return 'green';
  return 'gray';
}

function completedWorkTitle(work: any): string {
  const date = work.completed_date ? `${work.completed_date}\n` : '';
  if (work.work_type === 'production') {
    return `${date}SKU: ${work.sku_name ?? '—'} — ${work.quantity ?? work.current_quantity ?? '—'}`;
  }
  return `${date}${work.additional_work_name ?? 'Доп. работа'}`;
}

function completedWorkCardLines(employee: any, work: any): Array<{ label: string; value: ReactNode }> {
  return compactLines([
    ['ФИО', employee.full_name ?? work.employee_full_name],
    ['Дата', work.completed_date],
    work.work_type === 'production' ? ['SKU', `${work.sku_name ?? '—'} — ${work.quantity ?? work.current_quantity ?? '—'}`] : [null, work.additional_work_name],
    ['Начисленная зарплата', `${money(work.salary_amount_uzs ?? work.amount_uzs)} сум`]
  ]);
}

function additionalWorkTarget(status: string): Section03V17ScreenId {
  if (status === 'requested') return 'S03-AW10';
  if (status === 'approved') return 'S03-AW20';
  if (status === 'active') return 'S03-AW30';
  return 'S03-AW50';
}

function resolveAdditionalWork(ctx: BuildContext): any | null {
  const id = ctx.route.additional_work_id;
  if (!id) return null;
  const groups = ctx.data?.groups ?? {};
  for (const key of ['requested', 'approved', 'active', 'waiting_accrual']) {
    const found = array(groups[key]).find((item) => String(item.additional_work_id) === String(id));
    if (found) return found;
  }
  return null;
}

function mustAdditionalWorkId(route: RouteState): string {
  return must(route.additional_work_id ?? route.additionalWork?.additional_work_id, 'additional_work_id');
}

function employeeName(employee: any): string {
  return String(employee?.full_name ?? employee?.employee_full_name ?? '—');
}

function hasAnyBlocker(blockers: any): boolean {
  return Boolean(blockers?.production || blockers?.break || blockers?.additional_work);
}

function resolveBackRoute(route: RouteState): RouteState {
  switch (route.screenId) {
    case 'S03-N01':
      return { screenId: 'S03-N01' };
    case 'S03-M01':
    case 'S03-E01':
    case 'S03-D01':
    case 'S03-AW01':
    case 'S03-C00':
    case 'S03-NOT01':
    case 'S03-R01':
      return { screenId: 'S03-N01' };
    case 'S03-M02':
      return { screenId: route.origin === 'S03-D01' ? 'S03-D01' : 'S03-M01' };
    case 'S03-D10':
      return route.machine_id ? { screenId: 'S03-M02', machine_id: route.machine_id } : { screenId: 'S03-D01' };
    case 'S03-D11':
      return { screenId: 'S03-D10', downtime_type_id: route.downtime_type_id, downtime_type_name: route.downtime_type_name };
    case 'S03-D12':
      return route.machine_id ? { ...route, screenId: 'S03-D11' } : { screenId: 'S03-D10' };
    case 'S03-D13':
      return { ...route, screenId: 'S03-D12' };
    case 'S03-E02':
      return { screenId: 'S03-E01' };
    case 'S03-E12':
    case 'S03-E10':
    case 'S03-E20':
      return { screenId: 'S03-E02', employee_id: route.employee_id };
    case 'S03-E11':
      return { screenId: 'S03-E10', employee_id: route.employee_id };
    case 'S03-E13':
    case 'S03-E16':
    case 'S03-E17':
      return { screenId: 'S03-E12', employee_id: route.employee_id };
    case 'S03-E14':
      return { screenId: 'S03-E13', employee_id: route.employee_id };
    case 'S03-E21':
      return { ...route, screenId: 'S03-E20' };
    case 'S03-E22':
      return { ...route, screenId: 'S03-E21' };
    case 'S03-AW10':
    case 'S03-AW20':
    case 'S03-AW30':
    case 'S03-AW50':
    case 'S03-AW40':
      return { screenId: 'S03-AW01' };
    case 'S03-AW11':
    case 'S03-AW12':
      return { ...route, screenId: 'S03-AW10' };
    case 'S03-AW21':
      return { ...route, screenId: 'S03-AW20' };
    case 'S03-AW31':
      return { ...route, screenId: 'S03-AW30' };
    case 'S03-AW51':
    case 'S03-AW53':
      return { ...route, screenId: 'S03-AW50' };
    case 'S03-AW52':
      return { ...route, screenId: 'S03-AW51' };
    case 'S03-AW54':
      return { ...route, screenId: 'S03-AW53' };
    case 'S03-AW41':
      return { ...route, screenId: 'S03-AW40' };
    case 'S03-AW42':
      return { ...route, screenId: 'S03-AW41' };
    case 'S03-CF01':
    case 'S03-CP00':
      return { screenId: 'S03-C00' };
    case 'S03-CF10':
    case 'S03-CF20':
      return { screenId: 'S03-CF01' };
    case 'S03-CF11':
      return { screenId: 'S03-CF10' };
    case 'S03-CF12':
      return { ...route, screenId: 'S03-CF11' };
    case 'S03-CF13':
      return { ...route, screenId: 'S03-CF12' };
    case 'S03-CF14':
      return { ...route, screenId: 'S03-CF13' };
    case 'S03-CF21':
      return { ...route, screenId: 'S03-CF20' };
    case 'S03-CF22':
      return { ...route, screenId: 'S03-CF21' };
    case 'S03-CF23':
      return { ...route, screenId: 'S03-CF22' };
    case 'S03-CF24':
      return { ...route, screenId: 'S03-CF23' };
    case 'S03-CF25':
      return { ...route, screenId: 'S03-CF24' };
    case 'S03-CP10':
    case 'S03-CP20':
      return { screenId: 'S03-CP00' };
    case 'S03-CP11':
      return route.machine_id ? { screenId: 'S03-CP20' } : { screenId: 'S03-CP10' };
    case 'S03-CP12':
      return { ...route, screenId: 'S03-CP11' };
    case 'S03-CP13':
      return { ...route, screenId: 'S03-CP12' };
    case 'S03-CP14':
      return { ...route, screenId: 'S03-CP13' };
    case 'S03-CP15':
      return { ...route, screenId: 'S03-CP14' };
    case 'S03-CP16':
      return { ...route, screenId: 'S03-CP15' };
    case 'S03-SAL01':
    case 'S03-SAL02':
      return { screenId: 'S03-E02', employee_id: route.employee_id };
    case 'S03-R10':
      return { screenId: 'S03-R01' };
    case 'S03-R11':
      return { screenId: 'S03-R10' };
    case 'S03-R12':
      return { screenId: 'S03-R11', from_date: route.from_date };
    case 'S03-R13':
      return route.from_date && route.to_date ? { screenId: 'S03-R10' } : { screenId: 'S03-R10' };
    case 'S03-R14':
      return { screenId: 'S03-R01' };
    default:
      return { screenId: 'S03-N01' };
  }
}

function reportPeriodDates(period: S03Period): { from_date: string; to_date: string } {
  const today = new Date();
  const to = toIsoDate(today);
  const from = new Date(today);

  if (period === 'today') {
    return { from_date: to, to_date: to };
  }

  if (period === 'week') {
    const day = from.getDay();
    const diff = day === 0 ? 6 : day - 1;
    from.setDate(from.getDate() - diff);
    return { from_date: toIsoDate(from), to_date: to };
  }

  if (period === 'month') {
    from.setDate(1);
    return { from_date: toIsoDate(from), to_date: to };
  }

  from.setDate(from.getDate() - 29);
  return { from_date: toIsoDate(from), to_date: to };
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatLooseReadModel(data: any): string {
  if (!data) return 'Нет данных.';
  const lines: string[] = [];
  if (data.employee?.full_name) lines.push(`ФИО: ${data.employee.full_name}`);
  for (const [key, value] of Object.entries(data)) {
    if (key === 'section' || key === 'screen' || key === 'employee') continue;
    if (typeof value === 'string' || typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.length ? lines.join('\n') : JSON.stringify(data, null, 2);
}

function errorToMessage(error: unknown): string {
  const status = (error as { status?: number })?.status;
  const payload = (error as { payload?: any })?.payload;
  const suffix = status ? ` (${status})` : '';

  if (typeof payload?.error?.message === 'string') return `${payload.error.message}${suffix}`;
  if (typeof payload?.error?.code === 'string') return `${payload.error.code}${suffix}`;
  if (typeof payload?.message === 'string') return `${payload.message}${suffix}`;
  if (typeof payload?.details === 'string') return `${payload.details}${suffix}`;
  if (error instanceof Error) return `${error.message}${suffix}`;
  return `Не удалось получить данные.${suffix}`;
}

function must(value: any, name: string): string {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${name} is required`);
  }
  return String(value);
}

function decimalAdd(left: string, right: string): string {
  return decimalOperation(left, right, 1);
}

function decimalSubtract(left: string, right: string): string {
  return decimalOperation(left, right, -1);
}

function decimalOperation(left: string, right: string, sign: 1 | -1): string {
  const a = decimalParts(left);
  const b = decimalParts(right);
  const scale = Math.max(a.scale, b.scale);
  const av = a.value * 10n ** BigInt(scale - a.scale);
  const bv = b.value * 10n ** BigInt(scale - b.scale);
  const result = sign === 1 ? av + bv : av - bv;
  const negative = result < 0n;
  const abs = negative ? -result : result;
  const raw = abs.toString().padStart(scale + 1, '0');
  const intPart = raw.slice(0, raw.length - scale) || '0';
  const fracPart = scale > 0 ? raw.slice(raw.length - scale).replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${intPart}${fracPart ? `.${fracPart}` : ''}`;
}

function decimalParts(raw: string): { value: bigint; scale: number } {
  const normalized = String(raw).replace(',', '.').trim();
  const negative = normalized.startsWith('-');
  const clean = negative ? normalized.slice(1) : normalized;
  const [intPart = '0', fracPart = ''] = clean.split('.');
  const value = BigInt(`${intPart || '0'}${fracPart || ''}` || '0');
  return { value: negative ? -value : value, scale: fracPart.length };
}

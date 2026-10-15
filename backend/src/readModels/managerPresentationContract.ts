import type {
  ManagerAdditionalWorkItem,
  ManagerAdditionalWorkStatus,
  ManagerEmployeeUiState,
  ManagerEmployeeUiVariant,
  ManagerMachineUiState,
  ManagerMachineUiVariant,
  ManagerOpenTaskItem,
  ManagerOpenTaskKind
} from './types.js';

export type ManagerPresentationFamily =
  | 'machine'
  | 'employee'
  | 'additional_work'
  | 'notification';

export type ManagerPresentationCanonicalVector = Readonly<{
  family: ManagerPresentationFamily;
  tuple: Readonly<Record<string, string>>;
}>;

export class ManagerPresentationContractError extends Error {
  constructor(readonly code: 'UNKNOWN_PRESENTATION_STATE') {
    super(code);
    this.name = 'ManagerPresentationContractError';
    Object.freeze(this);
  }
}

type StateVariantTuple<TState extends string, TVariant extends string> = Readonly<{
  state: TState;
  variant: TVariant;
}>;

type NotificationTuple = Readonly<{
  state: ManagerOpenTaskKind;
  colorToken: ManagerOpenTaskItem['ui_color_token'];
  variant: ManagerOpenTaskItem['ui_variant'];
}>;

function freezeStateTuples<
  const TState extends string,
  const TVariant extends string
>(
  tuples: readonly StateVariantTuple<TState, TVariant>[]
): readonly StateVariantTuple<TState, TVariant>[] {
  return Object.freeze(tuples.map((tuple) => Object.freeze({ ...tuple })));
}

function freezeNotificationTuples(
  tuples: readonly NotificationTuple[]
): readonly NotificationTuple[] {
  return Object.freeze(tuples.map((tuple) => Object.freeze({ ...tuple })));
}

const machineTuples = freezeStateTuples<ManagerMachineUiState, ManagerMachineUiVariant>([
  { state: 'idle', variant: 'light_blue' },
  { state: 'running', variant: 'green' },
  { state: 'warning', variant: 'yellow' },
  { state: 'critical', variant: 'red' }
]);

const employeeTuples = freezeStateTuples<ManagerEmployeeUiState, ManagerEmployeeUiVariant>([
  { state: 'shift_not_started', variant: 'white' },
  { state: 'shift_idle', variant: 'light_blue' },
  { state: 'production', variant: 'green' },
  { state: 'break', variant: 'yellow' },
  { state: 'operational_down', variant: 'yellow' },
  { state: 'critical_down', variant: 'red' },
  { state: 'additional_work', variant: 'grey' }
]);

const additionalWorkTuples = freezeStateTuples<ManagerAdditionalWorkStatus, ManagerAdditionalWorkItem['ui_variant']>([
  { state: 'requested', variant: 'grey' },
  { state: 'approved', variant: 'grey' },
  { state: 'active', variant: 'green' },
  { state: 'waiting_accrual', variant: 'green' }
]);

const notificationTuples = freezeNotificationTuples([
  { state: 'ADDITIONAL_WORK_REQUESTED', colorToken: 'gray', variant: 'grey' },
  { state: 'ADDITIONAL_WORK_WAITING_ACCRUAL', colorToken: 'green', variant: 'green' },
  { state: 'CRITICAL_DOWNTIME_OPEN', colorToken: 'red', variant: 'red' },
  { state: 'OPERATIONAL_DOWNTIME_OVER_15_MIN', colorToken: 'yellow', variant: 'yellow' }
]);

export const MANAGER_PRESENTATION_TUPLE_DEFINITIONS = Object.freeze({
  machine: machineTuples,
  employee: employeeTuples,
  additional_work: additionalWorkTuples,
  notification: notificationTuples
});

function stateTuple<
  TState extends string,
  TVariant extends string
>(
  tuples: readonly StateVariantTuple<TState, TVariant>[],
  state: TState
): StateVariantTuple<TState, TVariant> {
  const tuple = tuples.find((candidate) => candidate.state === state);
  if (!tuple) {
    throw new ManagerPresentationContractError('UNKNOWN_PRESENTATION_STATE');
  }
  return tuple;
}

export function resolveManagerMachinePresentation(
  state: ManagerMachineUiState
): Readonly<{ ui_state: ManagerMachineUiState; ui_variant: ManagerMachineUiVariant }> {
  const tuple = stateTuple(machineTuples, state);
  return Object.freeze({ ui_state: tuple.state, ui_variant: tuple.variant });
}

export function resolveManagerEmployeePresentation(
  state: ManagerEmployeeUiState
): Readonly<{ ui_state: ManagerEmployeeUiState; ui_variant: ManagerEmployeeUiVariant }> {
  const tuple = stateTuple(employeeTuples, state);
  return Object.freeze({ ui_state: tuple.state, ui_variant: tuple.variant });
}

export function resolveManagerAdditionalWorkPresentation(
  status: ManagerAdditionalWorkStatus
): Readonly<{ status: ManagerAdditionalWorkStatus; ui_variant: ManagerAdditionalWorkItem['ui_variant'] }> {
  const tuple = stateTuple(additionalWorkTuples, status);
  return Object.freeze({ status: tuple.state, ui_variant: tuple.variant });
}

export function resolveManagerNotificationPresentation(
  taskKind: ManagerOpenTaskKind
): Readonly<{
  task_kind: ManagerOpenTaskKind;
  ui_color_token: ManagerOpenTaskItem['ui_color_token'];
  ui_variant: ManagerOpenTaskItem['ui_variant'];
}> {
  const tuple = notificationTuples.find((candidate) => candidate.state === taskKind);
  if (!tuple) {
    throw new ManagerPresentationContractError('UNKNOWN_PRESENTATION_STATE');
  }
  return Object.freeze({
    task_kind: tuple.state,
    ui_color_token: tuple.colorToken,
    ui_variant: tuple.variant
  });
}

export function createManagerPresentationCanonicalVectors(): readonly ManagerPresentationCanonicalVector[] {
  return Object.freeze([
    ...machineTuples.map(({ state }) => Object.freeze({
      family: 'machine' as const,
      tuple: Object.freeze(resolveManagerMachinePresentation(state))
    })),
    ...employeeTuples.map(({ state }) => Object.freeze({
      family: 'employee' as const,
      tuple: Object.freeze(resolveManagerEmployeePresentation(state))
    })),
    ...additionalWorkTuples.map(({ state }) => Object.freeze({
      family: 'additional_work' as const,
      tuple: Object.freeze(resolveManagerAdditionalWorkPresentation(state))
    })),
    ...notificationTuples.map(({ state }) => Object.freeze({
      family: 'notification' as const,
      tuple: Object.freeze(resolveManagerNotificationPresentation(state))
    }))
  ]);
}

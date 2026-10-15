import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { ApiClient, ApiClientError } from '../../foundation/apiClient';
import { PeaksGraphNodeRenderer, type PeaksGraphObject } from '../../foundation/graphRenderer';
import { getS02ActionDefinition, type S02ActionId } from '../../section02/section02GraphActions';
import {
  finishOperatorBreak,
  finishOperatorAdditionalWork,
  finishOperatorShift,
  finishOperatorDowntime,
  finishProductionOperation,
  getOperatorAdditionalWorkState,
  getOperatorAdditionalWorkTypesAvailable,
  getOperatorAvailableDowntimeTypes,
  getOperatorBreakTypes,
  getOperatorCriticalDowntimeMachines,
  getOperatorMachines,
  getOperatorSkus,
  getOperatorWorkplaceState,
  orderOperatorAvailableDowntimeTypes,
  requestOperatorAdditionalWork,
  startOperatorAdditionalWork,
  startOperatorBreak,
  startOperatorDowntime,
  startProductionOperation,
  type ActiveAdditionalWorkItem,
  type AdditionalWorkTypesAvailableResponse,
  type ApprovedAdditionalWorkItem,
  type OperatorAvailableDowntimeTypeItem,
  type OperatorBreakTypeItem,
  type OperatorCriticalDowntimeMachineItem,
  type OperatorDowntimeMachineReference,
  type OperatorMachineItem,
  type OperatorAdditionalWorkStateResponse,
  type OperatorSkuItem,
  type OperatorWorkplaceStateResponse
} from '../../section02/operatorWorkplace';
import { Section02OperatorWorkplaceActive } from './Section02OperatorWorkplaceActive';
import {
  PeaksCommentInputKeyboard,
  PeaksNumericInputKeyboard,
  isEmptyCommentInput,
  isMalformedNumericInput,
  normalizeNumericInputForApi
} from '../../foundation/graphObjects';
import {
  SECTION_02_INITIAL_PIPELINE_STATE,
  section02PipelineReducer,
  type Section02PipelineState
} from './section02PipelineModel';

export type Section02OperatorPipelineHostProps = {
  apiClient: ApiClient;
  initialWorkplaceState: OperatorWorkplaceStateResponse;
  onUnavailable?: () => void;
  onShiftInactive?: (workplaceState: OperatorWorkplaceStateResponse) => void;
  onOpenSalary?: () => void;
};

type DowntimeAuthoritativeRefresh =
  | { kind: 'downtime-types'; hasItems: boolean }
  | { kind: 'workplace' };

type AdditionalWorkAuthoritativeRefresh =
  | {
      kind: 'additional-work-menu';
      additionalWorkState: OperatorAdditionalWorkStateResponse;
      workplaceState: OperatorWorkplaceStateResponse;
    }
  | {
      kind: 'additional-work-types';
      additionalWorkTypes: AdditionalWorkTypesAvailableResponse['additional_work_types'];
      workplaceState: OperatorWorkplaceStateResponse;
    };

type AdditionalWorkRetryDescriptor = {
  expectedStateIdentity: string;
  refresh: (isCurrent?: () => boolean) => Promise<AdditionalWorkAuthoritativeRefresh>;
};

type FinishShiftLocalStep =
  | { kind: 'confirm'; warnings: string[] }
  | { kind: 'blocked'; blockers: string[] }
  | { kind: 'finished' };

type FinishShiftLooseWorkplace = OperatorWorkplaceStateResponse & {
  finish_shift?: {
    can_finish_shift?: boolean;
    blockers?: unknown;
    blocking_reasons?: unknown;
    warnings?: unknown;
    warning_messages?: unknown;
  };
  production?: {
    is_active?: boolean;
    production_operation_id?: string | number | null;
  };
  break?: {
    is_active?: boolean;
    operator_break_id?: string | number | null;
  };
  downtime?: {
    is_active?: boolean;
    can_finish_downtime?: boolean;
    downtime_class?: string | null;
    active_downtime_class?: string | null;
    machine_downtime_id?: string | number | null;
    downtime_id?: string | number | null;
  };
  additional_work_summary?: {
    has_active_additional_work?: boolean;
    active_count?: number;
    active_additional_work_count?: number;
    additional_work_id?: string | number | null;
    active_additional_work_id?: string | number | null;
  };
};

function finishShiftStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
}

function uniqueFinishShiftMessages(messages: string[]): string[] {
  return Array.from(new Set(messages.map((item) => item.trim()).filter(Boolean)));
}

function finishShiftDisplayValue(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function finishShiftErrorMessage(error: unknown): string | null {
  const payload = (error as { payload?: unknown })?.payload as
    | { message?: unknown; error?: unknown; details?: unknown }
    | undefined;

  for (const value of [payload?.message, payload?.details, payload?.error]) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return null;
}

function resolveFinishShiftBlockers(workplaceState: OperatorWorkplaceStateResponse): string[] {
  const state = workplaceState as FinishShiftLooseWorkplace;
  return uniqueFinishShiftMessages([
    ...finishShiftStringList(state.finish_shift?.blockers),
    ...finishShiftStringList(state.finish_shift?.blocking_reasons)
  ]);
}

type FinishShiftBlockerToken = 'PRODUCTION' | 'BREAK' | 'ADDITIONAL_WORK' | 'OPERATIONAL_DOWNTIME';

function normalizeFinishShiftBlockerToken(value: string): FinishShiftBlockerToken | null {
  const normalized = value.trim().toUpperCase();

  if (
    normalized === 'PRODUCTION' ||
    normalized === 'ACTIVE_PRODUCTION' ||
    normalized === 'PRODUCTION_OPERATION' ||
    normalized === 'ACTIVE_PRODUCTION_OPERATION'
  ) {
    return 'PRODUCTION';
  }

  if (normalized === 'BREAK' || normalized === 'ACTIVE_BREAK' || normalized === 'OPERATOR_BREAK' || normalized === 'ACTIVE_OPERATOR_BREAK') {
    return 'BREAK';
  }

  if (normalized === 'ADDITIONAL_WORK' || normalized === 'ACTIVE_ADDITIONAL_WORK') {
    return 'ADDITIONAL_WORK';
  }

  if (normalized === 'OPERATIONAL_DOWNTIME' || normalized === 'ACTIVE_OPERATIONAL_DOWNTIME') {
    return 'OPERATIONAL_DOWNTIME';
  }

  return null;
}

function resolveFinishShiftWarnings(workplaceState: OperatorWorkplaceStateResponse): string[] {
  const state = workplaceState as FinishShiftLooseWorkplace;
  return uniqueFinishShiftMessages([
    ...finishShiftStringList(state.finish_shift?.warnings),
    ...finishShiftStringList(state.finish_shift?.warning_messages)
  ]);
}


export function Section02OperatorPipelineHost({
  apiClient,
  initialWorkplaceState,
  onUnavailable,
  onShiftInactive,
  onOpenSalary
}: Section02OperatorPipelineHostProps) {
  const [workplaceState, setWorkplaceState] = useState(initialWorkplaceState);
  const [step, dispatch] = useReducer(section02PipelineReducer, SECTION_02_INITIAL_PIPELINE_STATE);
  const [machines, setMachines] = useState<OperatorMachineItem[]>([]);
  const [skus, setSkus] = useState<OperatorSkuItem[]>([]);
  const [breakTypes, setBreakTypes] = useState<OperatorBreakTypeItem[]>([]);
  const [downtimeTypes, setDowntimeTypes] = useState<OperatorAvailableDowntimeTypeItem[]>([]);
  const [criticalDowntimeMachines, setCriticalDowntimeMachines] = useState<OperatorCriticalDowntimeMachineItem[]>([]);
  const [additionalWorkState, setAdditionalWorkState] =
    useState<OperatorAdditionalWorkStateResponse | null>(null);
  const [additionalWorkTypes, setAdditionalWorkTypes] =
    useState<AdditionalWorkTypesAvailableResponse['additional_work_types']>([]);
  const [additionalWorkWorkplaceFresh, setAdditionalWorkWorkplaceFresh] = useState(false);
  const [activeDowntimeProductionOperationId, setActiveDowntimeProductionOperationId] = useState<string | null>(
    null
  );
  const [pending, setPending] = useState(false);
  const [finishShiftStep, setFinishShiftStep] = useState<FinishShiftLocalStep | null>(null);
  const downtimeTypesRequestSequence = useRef(0);
  const downtimeMachinesRequestSequence = useRef(0);
  const additionalWorkMenuRequestSequence = useRef(0);
  const additionalWorkTypesRequestSequence = useRef(0);
  const additionalWorkNavigationSequence = useRef(0);
  const additionalWorkRetrySequence = useRef(0);
  const additionalWorkRetryInFlight = useRef(false);
  const mounted = useRef(true);
  const stepRef = useRef(step);
  const downtimeRetry = useRef<(() => void) | null>(null);
  const additionalWorkRetry = useRef<AdditionalWorkRetryDescriptor | null>(null);
  stepRef.current = step;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      additionalWorkMenuRequestSequence.current += 1;
      additionalWorkTypesRequestSequence.current += 1;
      additionalWorkNavigationSequence.current += 1;
      additionalWorkRetrySequence.current += 1;
      additionalWorkRetryInFlight.current = false;
      additionalWorkRetry.current = null;
    };
  }, []);

  const handleFatalError = useCallback(
    (error: unknown) => {
      console.error(error);
      if (onUnavailable) {
        onUnavailable();
        return;
      }

      dispatch({ type: 'SHOW_FATAL_ERROR' });
    },
    [onUnavailable]
  );

  const refetchWorkplace = useCallback(async () => {
    const refreshedState = await getOperatorWorkplaceState(apiClient);
    setWorkplaceState(refreshedState);

    if (refreshedState.shift?.is_active === false) {
      onShiftInactive?.(refreshedState);
    }

    return refreshedState;
  }, [apiClient, onShiftInactive]);

  const backFromFinishShift = useCallback(() => {
    setFinishShiftStep(null);
  }, []);

  const openFinishShift = useCallback(async () => {
    setPending(true);

    try {
      const refreshedState = await refetchWorkplace();
      const blockers = resolveFinishShiftBlockers(refreshedState);

      if (blockers.length > 0) {
        setFinishShiftStep({ kind: 'blocked', blockers });
        return;
      }

      setFinishShiftStep({
        kind: 'confirm',
        warnings: resolveFinishShiftWarnings(refreshedState)
      });
    } catch (error) {
      console.error(error);
      handleFatalError(error);
    } finally {
      if (mounted.current) {
        setPending(false);
      }
    }
  }, [handleFatalError, refetchWorkplace]);

  const confirmFinishShift = useCallback(async () => {
    setPending(true);

    try {
      await finishOperatorShift(apiClient);
      await refetchWorkplace();
      setFinishShiftStep(null);
    } catch (error) {
      console.error(error);
      const fallbackMessage = finishShiftErrorMessage(error) ?? 'Не удалось завершить смену.';

      try {
        const refreshedState = await refetchWorkplace();
        const blockers = resolveFinishShiftBlockers(refreshedState);
        setFinishShiftStep({
          kind: 'blocked',
          blockers: uniqueFinishShiftMessages(blockers.length > 0 ? blockers : [fallbackMessage])
        });
      } catch {
        setFinishShiftStep({
          kind: 'blocked',
          blockers: [fallbackMessage]
        });
      }
    } finally {
      if (mounted.current) {
        setPending(false);
      }
    }
  }, [apiClient, refetchWorkplace]);

  const openMachineEntry = useCallback(() => {
    dispatch({ type: 'OPEN_START_PRODUCTION' });
  }, []);

  const openFinishProduction = useCallback(() => {
    const production = workplaceState.production;
    dispatch({
      type: 'OPEN_FINISH_PRODUCTION',
      productionOperationId: production?.production_operation_id,
      canFinishProduction: production?.can_finish_production,
      machineName: production?.machine_name,
      skuCode: production?.sku_code,
      skuName: production?.sku_name
    });
  }, [workplaceState]);

  const loadMachines = useCallback(async () => {
    setPending(true);
    try {
      const loadedMachines = await getOperatorMachines(apiClient);
      setMachines(loadedMachines);
      dispatch({ type: 'MACHINES_LOADED' });
    } catch (error) {
      handleFatalError(error);
    } finally {
      setPending(false);
    }
  }, [apiClient, handleFatalError]);

  const openQrPlaceholder = useCallback(() => {
    dispatch({ type: 'OPEN_QR_PLACEHOLDER' });
  }, []);

  const selectMachine = useCallback(
    async (machine: OperatorMachineItem) => {
      setPending(true);
      try {
        const loadedSkus = await getOperatorSkus(apiClient);
        setSkus(loadedSkus);
        dispatch({ type: 'MACHINE_SELECTED', machine });
      } catch (error) {
        handleFatalError(error);
      } finally {
        setPending(false);
      }
    },
    [apiClient, handleFatalError]
  );

  const selectSku = useCallback(
    async (machine: OperatorMachineItem, sku: OperatorSkuItem) => {
      setPending(true);
      try {
        await startProductionOperation(apiClient, machine.machine_id, sku.sku_id);
        await refetchWorkplace();
        dispatch({ type: 'PRODUCTION_STARTED' });
      } catch (error) {
        handleFatalError(error);
      } finally {
        setPending(false);
      }
    },
    [apiClient, handleFatalError, refetchWorkplace]
  );

  const finishProduction = useCallback(
    async (productionOperationId: string, quantityProduced: string) => {
      setPending(true);
      try {
        await finishProductionOperation(apiClient, productionOperationId, normalizeNumericInputForApi(quantityProduced));
        await refetchWorkplace();
        dispatch({ type: 'PRODUCTION_FINISHED' });
      } catch (error) {
        console.error(error);
        dispatch({
          type: 'FINISH_PRODUCTION_REJECTED',
          machineName: workplaceState.production?.machine_name,
          skuCode: workplaceState.production?.sku_code,
          skuName: workplaceState.production?.sku_name
        });
      } finally {
        setPending(false);
      }
    },
    [apiClient, refetchWorkplace, workplaceState.production?.machine_name, workplaceState.production?.sku_code, workplaceState.production?.sku_name]
  );

  const loadBreakTypes = useCallback(async () => {
    setPending(true);
    try {
      const loadedBreakTypes = await getOperatorBreakTypes(apiClient);
      setBreakTypes(loadedBreakTypes);
      dispatch({ type: 'BREAK_TYPES_LOADED' });
    } catch (error) {
      handleFatalError(error);
    } finally {
      setPending(false);
    }
  }, [apiClient, handleFatalError]);

  const selectBreakType = useCallback(
    async (breakType: OperatorBreakTypeItem) => {
      setPending(true);
      try {
        await startOperatorBreak(apiClient, breakType.break_type_id);
        await refetchWorkplace();
        dispatch({ type: 'BREAK_STARTED' });
      } catch (error) {
        handleFatalError(error);
      } finally {
        setPending(false);
      }
    },
    [apiClient, handleFatalError, refetchWorkplace]
  );

  const openFinishBreakConfirm = useCallback(() => {
    dispatch({ type: 'OPEN_FINISH_BREAK' });
  }, []);

  const finishBreak = useCallback(async () => {
    setPending(true);
    try {
      await finishOperatorBreak(apiClient);
      await refetchWorkplace();
      dispatch({ type: 'BREAK_FINISHED' });
    } catch (error) {
      handleFatalError(error);
    } finally {
      setPending(false);
    }
  }, [apiClient, handleFatalError, refetchWorkplace]);

  const handOffDowntimeAuthError = useCallback(
    (error: unknown) => {
      console.error(error);
      if (onUnavailable) {
        onUnavailable();
        return;
      }

      dispatch({ type: 'SHOW_FATAL_ERROR' });
    },
    [onUnavailable]
  );

  const showDowntimeValidationError = useCallback((error: unknown, fallback: string) => {
    console.error(error);
    dispatch({ type: 'SHOW_DOWNTIME_VALIDATION_ERROR', message: readApiErrorMessage(error) ?? fallback });
  }, []);

  const refreshDowntimeStartSources = useCallback(
    async (includeMachines: boolean) => {
      const [refreshedWorkplace, response, refreshedMachines] = await Promise.all([
        getOperatorWorkplaceState(apiClient),
        getOperatorAvailableDowntimeTypes(apiClient),
        includeMachines ? getOperatorCriticalDowntimeMachines(apiClient) : Promise.resolve(null)
      ]);
      const orderedTypes = orderOperatorAvailableDowntimeTypes(response.available_downtime_types);
      setWorkplaceState(refreshedWorkplace);
      setActiveDowntimeProductionOperationId(response.active_production_operation_id);
      setDowntimeTypes(orderedTypes);
      if (refreshedMachines) {
        setCriticalDowntimeMachines(refreshedMachines);
      }
      return orderedTypes;
    },
    [apiClient]
  );

  const handleDowntimeMutationError = useCallback(
    async (
      error: unknown,
      options: {
        refresh: () => Promise<DowntimeAuthoritativeRefresh>;
      }
    ) => {
      console.error(error);
      if (isAuthOrForbiddenError(error)) {
        handOffDowntimeAuthError(error);
        return;
      }

      if (isValidationError(error)) {
        showDowntimeValidationError(error, 'Backend не принял данные. Проверьте введённые значения.');
        return;
      }

      const presentRefreshedState = (refresh: DowntimeAuthoritativeRefresh) => {
        downtimeRetry.current = null;
        if (refresh.kind === 'workplace') {
          dispatch({ type: 'DOWNTIME_FINISHED' });
          return;
        }

        dispatch({ type: 'DOWNTIME_SOURCES_REFRESHED', hasItems: refresh.hasItems });
      };

      const retryAuthoritativeRefresh = () => {
        void (async () => {
          setPending(true);
          try {
            presentRefreshedState(await options.refresh());
          } catch (refreshError) {
            if (isAuthOrForbiddenError(refreshError)) {
              handOffDowntimeAuthError(refreshError);
            } else {
              console.error(refreshError);
              dispatch({ type: 'SHOW_DOWNTIME_ERROR' });
            }
          } finally {
            setPending(false);
          }
        })();
      };

      let refreshed: DowntimeAuthoritativeRefresh;
      try {
        refreshed = await options.refresh();
      } catch (refreshError) {
        if (isAuthOrForbiddenError(refreshError)) {
          handOffDowntimeAuthError(refreshError);
          return;
        }

        console.error(refreshError);
        downtimeRetry.current = retryAuthoritativeRefresh;
        dispatch({ type: 'SHOW_DOWNTIME_ERROR' });
        return;
      }

      if (isStaleOrConflictError(error)) {
        presentRefreshedState(refreshed);
        return;
      }

      downtimeRetry.current = retryAuthoritativeRefresh;
      dispatch({ type: 'SHOW_DOWNTIME_ERROR' });
    },
    [handOffDowntimeAuthError, showDowntimeValidationError]
  );

  const loadDowntimeTypes = useCallback(async () => {
    if (
      workplaceState.available_pipelines?.includes('START_DOWNTIME') !== true ||
      workplaceState.downtime?.can_start_downtime !== true
    ) {
      showDowntimeValidationError(
        new Error('START_DOWNTIME is absent from authoritative workplace availability'),
        'Начало простоя сейчас недоступно.'
      );
      return;
    }

    const requestSequence = downtimeTypesRequestSequence.current + 1;
    downtimeTypesRequestSequence.current = requestSequence;
    dispatch({ type: 'OPEN_START_DOWNTIME' });
    setPending(true);

    try {
      const response = await getOperatorAvailableDowntimeTypes(apiClient);
      if (downtimeTypesRequestSequence.current !== requestSequence) {
        return;
      }

      const orderedTypes = orderOperatorAvailableDowntimeTypes(response.available_downtime_types);
      setActiveDowntimeProductionOperationId(response.active_production_operation_id);
      setDowntimeTypes(orderedTypes);
      dispatch({ type: 'DOWNTIME_TYPES_LOADED', hasItems: orderedTypes.length > 0 });
    } catch (error) {
      if (downtimeTypesRequestSequence.current === requestSequence) {
        if (isAuthOrForbiddenError(error)) {
          handOffDowntimeAuthError(error);
        } else if (isValidationError(error)) {
          showDowntimeValidationError(error, 'Не удалось загрузить типы простоя.');
        } else {
          downtimeRetry.current = () => void loadDowntimeTypes();
          dispatch({ type: 'SHOW_DOWNTIME_ERROR' });
        }
      }
    } finally {
      if (downtimeTypesRequestSequence.current === requestSequence) {
        setPending(false);
      }
    }
  }, [
    apiClient,
    handOffDowntimeAuthError,
    showDowntimeValidationError,
    workplaceState.available_pipelines,
    workplaceState.downtime?.can_start_downtime
  ]);

  const startOperationalDowntime = useCallback(
    async (downtimeType: OperatorAvailableDowntimeTypeItem) => {
      const machineId = workplaceState.production?.machine_id;
      if (!machineId || !activeDowntimeProductionOperationId) {
        showDowntimeValidationError(
          new Error('Operational downtime requires authoritative active machine and operation IDs'),
          'Backend вернул неполные данные для операционного простоя.'
        );
        return;
      }

      setPending(true);
      try {
        await startOperatorDowntime(apiClient, {
          machine_id: machineId,
          downtime_type_id: downtimeType.downtime_type_id,
          production_operation_id: activeDowntimeProductionOperationId,
          comment: null
        });
        await refetchWorkplace();
        dispatch({ type: 'OPERATIONAL_DOWNTIME_STARTED' });
      } catch (error) {
        await handleDowntimeMutationError(error, {
          refresh: async () => {
            const refreshedTypes = await refreshDowntimeStartSources(false);
            return { kind: 'downtime-types', hasItems: refreshedTypes.length > 0 };
          }
        });
      } finally {
        setPending(false);
      }
    },
    [
      activeDowntimeProductionOperationId,
      apiClient,
      handleDowntimeMutationError,
      refetchWorkplace,
      refreshDowntimeStartSources,
      showDowntimeValidationError,
      workplaceState.production?.machine_id
    ]
  );

  const loadCriticalDowntimeMachines = useCallback(
    async (downtimeType: OperatorAvailableDowntimeTypeItem) => {
      const requestSequence = downtimeMachinesRequestSequence.current + 1;
      downtimeMachinesRequestSequence.current = requestSequence;
      dispatch({ type: 'OPEN_CRITICAL_DOWNTIME_WITHOUT_OPERATION', downtimeType });
      setPending(true);

      try {
        const loadedMachines = await getOperatorCriticalDowntimeMachines(apiClient);
        if (downtimeMachinesRequestSequence.current !== requestSequence) {
          return;
        }

        setCriticalDowntimeMachines(loadedMachines);
        dispatch({ type: 'DOWNTIME_MACHINES_LOADED', hasItems: loadedMachines.length > 0 });
      } catch (error) {
        if (downtimeMachinesRequestSequence.current === requestSequence) {
          if (isAuthOrForbiddenError(error)) {
            handOffDowntimeAuthError(error);
          } else if (isValidationError(error)) {
            showDowntimeValidationError(error, 'Не удалось загрузить список станков.');
          } else {
            downtimeRetry.current = () => void loadCriticalDowntimeMachines(downtimeType);
            dispatch({ type: 'SHOW_DOWNTIME_ERROR' });
          }
        }
      } finally {
        if (downtimeMachinesRequestSequence.current === requestSequence) {
          setPending(false);
        }
      }
    },
    [apiClient, handOffDowntimeAuthError, showDowntimeValidationError]
  );

  const selectDowntimeType = useCallback(
    (downtimeType: OperatorAvailableDowntimeTypeItem) => {
      const isOperationalContract =
        downtimeType.downtime_class === 'OPERATIONAL' &&
        downtimeType.requires_production_operation === true &&
        downtimeType.requires_comment === false &&
        activeDowntimeProductionOperationId !== null;
      const isCriticalContract =
        downtimeType.downtime_class === 'CRITICAL' &&
        downtimeType.requires_production_operation === false &&
        downtimeType.requires_comment === true;

      if (isOperationalContract) {
        void startOperationalDowntime(downtimeType);
        return;
      }

      if (!isCriticalContract) {
        showDowntimeValidationError(
          new Error('Unsupported available downtime type branch contract'),
          'Backend вернул неподдерживаемую конфигурацию типа простоя.'
        );
        return;
      }

      const machineId = workplaceState.production?.machine_id;
      const machineName = workplaceState.production?.machine_name;
      if (activeDowntimeProductionOperationId) {
        if (!machineId || !machineName) {
          showDowntimeValidationError(
            new Error('Critical downtime active-operation branch requires authoritative machine fields')
            ,
            'Backend вернул неполные данные активной производственной операции.'
          );
          return;
        }

        dispatch({
          type: 'OPEN_CRITICAL_DOWNTIME_WITH_OPERATION',
          context: {
            downtimeType,
            machine: {
              machine_id: machineId,
              machine_name: machineName
            },
            productionOperationId: activeDowntimeProductionOperationId,
            returnTo: 'downtime-type-list'
          }
        });
        return;
      }

      void loadCriticalDowntimeMachines(downtimeType);
    },
    [
      activeDowntimeProductionOperationId,
      loadCriticalDowntimeMachines,
      showDowntimeValidationError,
      startOperationalDowntime,
      workplaceState.production?.machine_id,
      workplaceState.production?.machine_name
    ]
  );

  const startCriticalDowntime = useCallback(
    async (
      downtimeType: OperatorAvailableDowntimeTypeItem,
      machine: OperatorDowntimeMachineReference,
      productionOperationId: string | null,
      comment: string
    ) => {
      setPending(true);
      try {
        await startOperatorDowntime(apiClient, {
          machine_id: machine.machine_id,
          downtime_type_id: downtimeType.downtime_type_id,
          production_operation_id: productionOperationId,
          comment: comment.trim()
        });
        dispatch({ type: 'CRITICAL_DOWNTIME_STARTED', machineName: machine.machine_name });
      } catch (error) {
        await handleDowntimeMutationError(error, {
          refresh: async () => {
            const refreshedTypes = await refreshDowntimeStartSources(productionOperationId === null);
            return { kind: 'downtime-types', hasItems: refreshedTypes.length > 0 };
          }
        });
      } finally {
        setPending(false);
      }
    },
    [apiClient, handleDowntimeMutationError, refreshDowntimeStartSources]
  );

  const openFinishDowntime = useCallback(() => {
    const downtime = workplaceState.downtime;
    dispatch({
      type: 'OPEN_FINISH_DOWNTIME',
      downtimeId: downtime?.downtime_id,
      downtimeTypeName: downtime?.downtime_type_name,
      downtimeClass: downtime?.downtime_class
    });
  }, [workplaceState.downtime]);

  const finishDowntime = useCallback(
    async (downtimeId: string) => {
      setPending(true);
      try {
        await finishOperatorDowntime(apiClient, downtimeId);
        await refetchWorkplace();
        dispatch({ type: 'DOWNTIME_FINISHED' });
      } catch (error) {
        await handleDowntimeMutationError(error, {
          refresh: async () => {
            await refetchWorkplace();
            return { kind: 'workplace' };
          }
        });
      } finally {
        setPending(false);
      }
    },
    [apiClient, handleDowntimeMutationError, refetchWorkplace]
  );

  const closeCriticalDowntimeResult = useCallback(async () => {
    setPending(true);
    try {
      await refetchWorkplace();
      dispatch({ type: 'DOWNTIME_RESULT_CLOSED' });
    } catch (error) {
      if (isAuthOrForbiddenError(error)) {
        handOffDowntimeAuthError(error);
      } else {
        showDowntimeValidationError(error, 'Не удалось обновить рабочее место.');
      }
    } finally {
      setPending(false);
    }
  }, [handOffDowntimeAuthError, refetchWorkplace, showDowntimeValidationError]);

  const backFromDowntimeTypes = useCallback(() => {
    downtimeTypesRequestSequence.current += 1;
    setPending(false);
    dispatch({ type: 'BACK' });
  }, []);

  const backFromDowntimeMachines = useCallback(() => {
    downtimeMachinesRequestSequence.current += 1;
    setPending(false);
    dispatch({ type: 'BACK' });
  }, []);

  const handOffAdditionalWorkAuthError = useCallback(
    (error: unknown) => {
      console.error(error);
      if (onUnavailable) {
        onUnavailable();
        return;
      }

      dispatch({ type: 'SHOW_FATAL_ERROR' });
    },
    [onUnavailable]
  );

  const showAdditionalWorkValidationError = useCallback((error: unknown, fallback: string) => {
    console.error(error);
    dispatch({
      type: 'SHOW_ADDITIONAL_WORK_VALIDATION_ERROR',
      message: readApiErrorMessage(error) ?? fallback
    });
  }, []);

  const invalidateAdditionalWorkAsync = useCallback(() => {
    additionalWorkNavigationSequence.current += 1;
    additionalWorkRetrySequence.current += 1;
    additionalWorkRetryInFlight.current = false;
    additionalWorkRetry.current = null;
  }, []);

  const isExpectedAdditionalWorkState = useCallback(
    (navigationSequence: number, expectedStateIdentity: string) =>
      mounted.current &&
      additionalWorkNavigationSequence.current === navigationSequence &&
      additionalWorkStateIdentity(stepRef.current) === expectedStateIdentity,
    []
  );

  const readAdditionalWorkMenu = useCallback(async (
    isCurrent: () => boolean = () => true
  ): Promise<AdditionalWorkAuthoritativeRefresh> => {
    const refreshedAdditionalWorkState = await getOperatorAdditionalWorkState(apiClient);
    if (!isCurrent()) {
      throw new AdditionalWorkRefreshCancelledError();
    }
    const refreshedWorkplace = await getOperatorWorkplaceState(apiClient);
    if (!isCurrent()) {
      throw new AdditionalWorkRefreshCancelledError();
    }
    return {
      kind: 'additional-work-menu',
      additionalWorkState: refreshedAdditionalWorkState,
      workplaceState: refreshedWorkplace
    };
  }, [apiClient]);

  const readAdditionalWorkRequestSources =
    useCallback(async (
      isCurrent: () => boolean = () => true
    ): Promise<AdditionalWorkAuthoritativeRefresh> => {
      const refreshedTypes = await getOperatorAdditionalWorkTypesAvailable(apiClient);
      if (!isCurrent()) {
        throw new AdditionalWorkRefreshCancelledError();
      }
      const refreshedWorkplace = await getOperatorWorkplaceState(apiClient);
      if (!isCurrent()) {
        throw new AdditionalWorkRefreshCancelledError();
      }

      if (refreshedWorkplace.available_pipelines?.includes('REQUEST_ADDITIONAL_WORK') === true) {
        return {
          kind: 'additional-work-types',
          additionalWorkTypes: refreshedTypes.additional_work_types,
          workplaceState: refreshedWorkplace
        };
      }

      const refreshedAdditionalWorkState = await getOperatorAdditionalWorkState(apiClient);
      if (!isCurrent()) {
        throw new AdditionalWorkRefreshCancelledError();
      }
      return {
        kind: 'additional-work-menu',
        additionalWorkState: refreshedAdditionalWorkState,
        workplaceState: refreshedWorkplace
      };
    }, [apiClient]);

  const applyAdditionalWorkRefresh = useCallback((refresh: AdditionalWorkAuthoritativeRefresh) => {
    setWorkplaceState(refresh.workplaceState);
    setAdditionalWorkWorkplaceFresh(true);
    if (refresh.kind === 'additional-work-menu') {
      setAdditionalWorkState(refresh.additionalWorkState);
      return;
    }

    setAdditionalWorkTypes(refresh.additionalWorkTypes);
  }, []);

  const presentAdditionalWorkRefresh = useCallback(
    (refresh: AdditionalWorkAuthoritativeRefresh) => {
      applyAdditionalWorkRefresh(refresh);
      additionalWorkRetry.current = null;
      if (refresh.kind === 'additional-work-menu') {
        dispatch({ type: 'ADDITIONAL_WORK_MENU_REFRESHED' });
        return;
      }

      dispatch({
        type: 'ADDITIONAL_WORK_TYPES_REFRESHED',
        hasItems: refresh.additionalWorkTypes.length > 0
      });
    },
    [applyAdditionalWorkRefresh]
  );

  const installAdditionalWorkRetry = useCallback(
    (
      expectedStateIdentity: string,
      refresh: (isCurrent?: () => boolean) => Promise<AdditionalWorkAuthoritativeRefresh>
    ) => {
      additionalWorkRetry.current = {
        expectedStateIdentity,
        refresh
      };
    },
    []
  );

  const runAdditionalWorkRetry = useCallback(() => {
    const retry = additionalWorkRetry.current;
    if (!retry || additionalWorkRetryInFlight.current) {
      return;
    }

    const expectedMessageIdentity = `message>${retry.expectedStateIdentity}`;
    if (additionalWorkStateIdentity(stepRef.current) !== expectedMessageIdentity) {
      return;
    }

    const navigationSequence = additionalWorkNavigationSequence.current;
    const retrySequence = additionalWorkRetrySequence.current + 1;
    additionalWorkRetrySequence.current = retrySequence;
    additionalWorkRetryInFlight.current = true;
    setPending(true);

    void (async () => {
      try {
        const isCurrent = () =>
          isExpectedAdditionalWorkState(navigationSequence, expectedMessageIdentity) &&
          additionalWorkRetrySequence.current === retrySequence;
        const refresh = await retry.refresh(isCurrent);
        if (
          !isExpectedAdditionalWorkState(navigationSequence, expectedMessageIdentity) ||
          additionalWorkRetrySequence.current !== retrySequence
        ) {
          return;
        }

        presentAdditionalWorkRefresh(refresh);
      } catch (refreshError) {
        if (
          !isExpectedAdditionalWorkState(navigationSequence, expectedMessageIdentity) ||
          additionalWorkRetrySequence.current !== retrySequence
        ) {
          return;
        }

        if (isAuthOrForbiddenError(refreshError)) {
          handOffAdditionalWorkAuthError(refreshError);
        } else {
          console.error(refreshError);
          dispatch({ type: 'SHOW_ADDITIONAL_WORK_ERROR' });
        }
      } finally {
        if (
          mounted.current &&
          additionalWorkNavigationSequence.current === navigationSequence &&
          additionalWorkRetrySequence.current === retrySequence
        ) {
          additionalWorkRetryInFlight.current = false;
          setPending(false);
        }
      }
    })();
  }, [
    handOffAdditionalWorkAuthError,
    isExpectedAdditionalWorkState,
    presentAdditionalWorkRefresh
  ]);

  const handleAdditionalWorkMutationError = useCallback(
    async (
      error: unknown,
      options: {
        refresh: (isCurrent?: () => boolean) => Promise<AdditionalWorkAuthoritativeRefresh>;
      }
    ) => {
      const expectedStateIdentity = additionalWorkStateIdentity(stepRef.current);
      const navigationSequence = additionalWorkNavigationSequence.current;
      if (!expectedStateIdentity) {
        return;
      }

      if (isAuthOrForbiddenError(error)) {
        handOffAdditionalWorkAuthError(error);
        return;
      }

      if (isValidationError(error)) {
        showAdditionalWorkValidationError(error, 'Backend не принял данные. Проверьте выбранную допработу.');
        return;
      }

      let refreshed: AdditionalWorkAuthoritativeRefresh;
      try {
        refreshed = await options.refresh();
      } catch (refreshError) {
        if (!isExpectedAdditionalWorkState(navigationSequence, expectedStateIdentity)) {
          return;
        }

        if (isAuthOrForbiddenError(refreshError)) {
          handOffAdditionalWorkAuthError(refreshError);
          return;
        }

        console.error(refreshError);
        installAdditionalWorkRetry(expectedStateIdentity, options.refresh);
        dispatch({ type: 'SHOW_ADDITIONAL_WORK_ERROR' });
        return;
      }

      if (!isExpectedAdditionalWorkState(navigationSequence, expectedStateIdentity)) {
        return;
      }

      if (isStaleOrConflictError(error)) {
        presentAdditionalWorkRefresh(refreshed);
        return;
      }

      console.error(error);
      applyAdditionalWorkRefresh(refreshed);
      installAdditionalWorkRetry(expectedStateIdentity, options.refresh);
      dispatch({ type: 'SHOW_ADDITIONAL_WORK_ERROR' });
    },
    [
      applyAdditionalWorkRefresh,
      handOffAdditionalWorkAuthError,
      installAdditionalWorkRetry,
      isExpectedAdditionalWorkState,
      presentAdditionalWorkRefresh,
      showAdditionalWorkValidationError
    ]
  );

  const loadAdditionalWorkMenu = useCallback(async () => {
    if (workplaceState.available_pipelines?.includes('OPEN_ADDITIONAL_WORK') !== true) {
      showAdditionalWorkValidationError(
        new Error('OPEN_ADDITIONAL_WORK is absent from authoritative workplace availability'),
        'Допработа сейчас недоступна.'
      );
      return;
    }

    invalidateAdditionalWorkAsync();
    const requestSequence = additionalWorkMenuRequestSequence.current + 1;
    additionalWorkMenuRequestSequence.current = requestSequence;
    setAdditionalWorkWorkplaceFresh(false);
    dispatch({ type: 'OPEN_ADDITIONAL_WORK' });
    setPending(true);

    try {
      const refreshedAdditionalWorkState = await getOperatorAdditionalWorkState(apiClient);
      if (
        !mounted.current ||
        additionalWorkMenuRequestSequence.current !== requestSequence
      ) {
        return;
      }

      const refreshedWorkplace = await getOperatorWorkplaceState(apiClient);
      if (
        !mounted.current ||
        additionalWorkMenuRequestSequence.current !== requestSequence
      ) {
        return;
      }

      presentAdditionalWorkRefresh({
        kind: 'additional-work-menu',
        additionalWorkState: refreshedAdditionalWorkState,
        workplaceState: refreshedWorkplace
      });
    } catch (error) {
      if (
        mounted.current &&
        additionalWorkMenuRequestSequence.current === requestSequence
      ) {
        if (isAuthOrForbiddenError(error)) {
          handOffAdditionalWorkAuthError(error);
        } else if (isValidationError(error)) {
          showAdditionalWorkValidationError(error, 'Не удалось загрузить допработы.');
        } else {
          installAdditionalWorkRetry('additional-work-menu:loading', readAdditionalWorkMenu);
          dispatch({ type: 'SHOW_ADDITIONAL_WORK_ERROR' });
        }
      }
    } finally {
      if (
        mounted.current &&
        additionalWorkMenuRequestSequence.current === requestSequence
      ) {
        setPending(false);
      }
    }
  }, [
    apiClient,
    handOffAdditionalWorkAuthError,
    installAdditionalWorkRetry,
    invalidateAdditionalWorkAsync,
    presentAdditionalWorkRefresh,
    readAdditionalWorkMenu,
    showAdditionalWorkValidationError,
    workplaceState.available_pipelines
  ]);

  const loadAdditionalWorkTypes = useCallback(async () => {
    invalidateAdditionalWorkAsync();
    const requestSequence = additionalWorkTypesRequestSequence.current + 1;
    additionalWorkTypesRequestSequence.current = requestSequence;
    dispatch({ type: 'OPEN_REQUEST_ADDITIONAL_WORK' });
    setPending(true);

    try {
      const response = await getOperatorAdditionalWorkTypesAvailable(apiClient);
      if (
        !mounted.current ||
        additionalWorkTypesRequestSequence.current !== requestSequence
      ) {
        return;
      }

      setAdditionalWorkTypes(response.additional_work_types);
      dispatch({
        type: 'ADDITIONAL_WORK_TYPES_REFRESHED',
        hasItems: response.additional_work_types.length > 0
      });
    } catch (error) {
      if (
        mounted.current &&
        additionalWorkTypesRequestSequence.current === requestSequence
      ) {
        if (isAuthOrForbiddenError(error)) {
          handOffAdditionalWorkAuthError(error);
        } else if (isValidationError(error)) {
          showAdditionalWorkValidationError(error, 'Не удалось загрузить типы допработ.');
        } else {
          installAdditionalWorkRetry(
            'additional-work-type-list:loading',
            readAdditionalWorkRequestSources
          );
          dispatch({ type: 'SHOW_ADDITIONAL_WORK_ERROR' });
        }
      }
    } finally {
      if (
        mounted.current &&
        additionalWorkTypesRequestSequence.current === requestSequence
      ) {
        setPending(false);
      }
    }
  }, [
    apiClient,
    handOffAdditionalWorkAuthError,
    installAdditionalWorkRetry,
    invalidateAdditionalWorkAsync,
    readAdditionalWorkRequestSources,
    showAdditionalWorkValidationError,
    workplaceState.available_pipelines
  ]);

  const requestAdditionalWork = useCallback(
    async (additionalWorkType: AdditionalWorkTypesAvailableResponse['additional_work_types'][number]) => {
      const currentType = additionalWorkTypes.find(
        (item) =>
          item.additional_work_type_id === additionalWorkType.additional_work_type_id &&
          item.display_name === additionalWorkType.display_name
      );
      if (!currentType) {
        showAdditionalWorkValidationError(
          new Error('Selected additional-work type is absent from fresh authoritative sources'),
          'Выбранный тип допработы больше недоступен.'
        );
        return;
      }

      invalidateAdditionalWorkAsync();
      setPending(true);
      try {
        await requestOperatorAdditionalWork(apiClient, currentType.additional_work_type_id);
        const refresh = await readAdditionalWorkMenu();
        if (!mounted.current) {
          return;
        }
        applyAdditionalWorkRefresh(refresh);
        dispatch({ type: 'ADDITIONAL_WORK_REQUESTED' });
      } catch (error) {
        await handleAdditionalWorkMutationError(error, {
          refresh: readAdditionalWorkRequestSources
        });
      } finally {
        if (mounted.current) {
          setPending(false);
        }
      }
    },
    [
      additionalWorkTypes,
      apiClient,
      applyAdditionalWorkRefresh,
      handleAdditionalWorkMutationError,
      invalidateAdditionalWorkAsync,
      readAdditionalWorkMenu,
      readAdditionalWorkRequestSources,
      showAdditionalWorkValidationError,
      workplaceState.available_pipelines
    ]
  );

  const startAdditionalWork = useCallback(
    async (additionalWork: ApprovedAdditionalWorkItem) => {
      const currentItem = additionalWorkState?.approved_additional_works.find(
        (item) =>
          item.additional_work_id === additionalWork.additional_work_id &&
          item.action === 'START_ADDITIONAL_WORK' &&
          item.origin === additionalWork.origin
      );
      if (!currentItem) {
        showAdditionalWorkValidationError(
          new Error('Selected approved additional work is absent from authoritative state'),
          'Эта допработа больше недоступна для начала.'
        );
        return;
      }

      invalidateAdditionalWorkAsync();
      setPending(true);
      try {
        await startOperatorAdditionalWork(apiClient, currentItem.additional_work_id);
        const refresh = await readAdditionalWorkMenu();
        if (!mounted.current) {
          return;
        }
        applyAdditionalWorkRefresh(refresh);
        dispatch({ type: 'ADDITIONAL_WORK_STARTED' });
      } catch (error) {
        await handleAdditionalWorkMutationError(error, {
          refresh: readAdditionalWorkMenu
        });
      } finally {
        if (mounted.current) {
          setPending(false);
        }
      }
    },
    [
      additionalWorkState?.approved_additional_works,
      apiClient,
      applyAdditionalWorkRefresh,
      handleAdditionalWorkMutationError,
      invalidateAdditionalWorkAsync,
      readAdditionalWorkMenu,
      showAdditionalWorkValidationError
    ]
  );

  const finishAdditionalWork = useCallback(
    async (additionalWork: ActiveAdditionalWorkItem) => {
      const currentItem = additionalWorkState?.active_additional_works.find(
        (item) =>
          item.additional_work_id === additionalWork.additional_work_id &&
          item.action === 'FINISH_ADDITIONAL_WORK'
      );
      if (!currentItem) {
        showAdditionalWorkValidationError(
          new Error('Selected active additional work is absent from authoritative state'),
          'Эта допработа больше недоступна для завершения.'
        );
        return;
      }

      invalidateAdditionalWorkAsync();
      setPending(true);
      try {
        await finishOperatorAdditionalWork(apiClient, currentItem.additional_work_id);
        if (mounted.current) {
          dispatch({ type: 'ADDITIONAL_WORK_FINISHED' });
        }
      } catch (error) {
        await handleAdditionalWorkMutationError(error, {
          refresh: readAdditionalWorkMenu
        });
      } finally {
        if (mounted.current) {
          setPending(false);
        }
      }
    },
    [
      additionalWorkState?.active_additional_works,
      apiClient,
      handleAdditionalWorkMutationError,
      invalidateAdditionalWorkAsync,
      readAdditionalWorkMenu,
      showAdditionalWorkValidationError
    ]
  );

  const closeAdditionalWorkResult = useCallback(async () => {
    const expectedStateIdentity = additionalWorkStateIdentity(stepRef.current);
    invalidateAdditionalWorkAsync();
    const navigationSequence = additionalWorkNavigationSequence.current;
    setPending(true);
    try {
      const refresh = await readAdditionalWorkMenu();
      if (
        !expectedStateIdentity ||
        !isExpectedAdditionalWorkState(navigationSequence, expectedStateIdentity)
      ) {
        return;
      }

      applyAdditionalWorkRefresh(refresh);
      dispatch({ type: 'ADDITIONAL_WORK_RESULT_CLOSED' });
    } catch (error) {
      if (
        !expectedStateIdentity ||
        !isExpectedAdditionalWorkState(navigationSequence, expectedStateIdentity)
      ) {
        return;
      }

      if (isAuthOrForbiddenError(error)) {
        handOffAdditionalWorkAuthError(error);
      } else if (isValidationError(error)) {
        showAdditionalWorkValidationError(error, 'Не удалось обновить допработы.');
      } else {
        installAdditionalWorkRetry(expectedStateIdentity, readAdditionalWorkMenu);
        dispatch({ type: 'SHOW_ADDITIONAL_WORK_ERROR' });
      }
    } finally {
      if (
        mounted.current &&
        additionalWorkNavigationSequence.current === navigationSequence
      ) {
        setPending(false);
      }
    }
  }, [
    applyAdditionalWorkRefresh,
    handOffAdditionalWorkAuthError,
    installAdditionalWorkRetry,
    invalidateAdditionalWorkAsync,
    isExpectedAdditionalWorkState,
    readAdditionalWorkMenu,
    showAdditionalWorkValidationError
  ]);

  const backFromAdditionalWorkMenu = useCallback(() => {
    additionalWorkMenuRequestSequence.current += 1;
    invalidateAdditionalWorkAsync();
    setAdditionalWorkWorkplaceFresh(false);
    setPending(false);
    dispatch({ type: 'BACK' });
  }, [invalidateAdditionalWorkAsync]);

  const backFromAdditionalWorkTypes = useCallback(() => {
    additionalWorkTypesRequestSequence.current += 1;
    invalidateAdditionalWorkAsync();
    setPending(false);
    dispatch({ type: 'BACK' });
  }, [invalidateAdditionalWorkAsync]);

  const backFromAdditionalWorkStep = useCallback(() => {
    invalidateAdditionalWorkAsync();
    setPending(false);
    dispatch({ type: 'BACK' });
  }, [invalidateAdditionalWorkAsync]);

  if (step.kind === 'additional-work-menu') {
    const scrollObjects: PeaksGraphObject[] = [];
    if (step.status === 'loading') {
      scrollObjects.push({
        kind: 'messageText',
        id: 'additional-work-loading',
        text: 'Загрузка…'
      });
    } else if (!additionalWorkState) {
      scrollObjects.push({
        kind: 'messageText',
        id: 'additional-work-empty',
        text: 'Допработы отсутствуют.'
      });
    } else {
      if (additionalWorkState.active_additional_works.length > 0) {
        scrollObjects.push({
          kind: 'custom',
          id: 'additional-work-active-group',
          node: <h2 className="peaks-d2-group-title">Выполняемые</h2>
        });
        scrollObjects.push(
          ...additionalWorkState.active_additional_works.map((additionalWork) =>
            actionObject('finish_additional_work', {
              id: additionalWork.additional_work_id,
              label: (
                <>
                  <span>Завершить:</span>
                  <span>{additionalWork.display_name}</span>
                </>
              ),
              variant: 'green',
              className: 'peaks-d2-text-action',
              showIcon: false,
              disabled: pending || additionalWork.action !== 'FINISH_ADDITIONAL_WORK',
              onClick: () => {
                invalidateAdditionalWorkAsync();
                dispatch({
                  type: 'ADDITIONAL_WORK_ACTIVE_SELECTED',
                  additionalWork
                });
              }
            })
          )
        );
      }

      if (additionalWorkState.approved_additional_works.length > 0) {
        scrollObjects.push({
          kind: 'custom',
          id: 'additional-work-approved-group',
          node: <h2 className="peaks-d2-group-title">Согласованные</h2>
        });
        scrollObjects.push(
          ...additionalWorkState.approved_additional_works.map((additionalWork) =>
            actionObject('start_additional_work', {
              id: additionalWork.additional_work_id,
              label: (
                <>
                  <span>Начать:</span>
                  <span>{additionalWork.display_name}</span>
                </>
              ),
              variant: 'gray',
              className: 'peaks-d2-text-action peaks-d2-gray-green',
              showIcon: false,
              disabled: pending || additionalWork.action !== 'START_ADDITIONAL_WORK',
              onClick: () => {
                invalidateAdditionalWorkAsync();
                dispatch({
                  type: 'ADDITIONAL_WORK_APPROVED_SELECTED',
                  additionalWork
                });
              }
            })
          )
        );
      }

      if (additionalWorkState.pending_approval_additional_works.length > 0) {
        scrollObjects.push({
          kind: 'custom',
          id: 'additional-work-pending-group',
          node: <h2 className="peaks-d2-group-title">На согласовании</h2>
        });
        scrollObjects.push(
          ...additionalWorkState.pending_approval_additional_works.map((additionalWork) => ({
            kind: 'custom' as const,
            id: additionalWork.additional_work_id,
            node: (
              <div className="peaks-d2-inactive-row" aria-disabled="true">
                {additionalWork.display_name}
              </div>
            )
          }))
        );
      }

      if (scrollObjects.length === 0) {
        scrollObjects.push({
          kind: 'messageText',
          id: 'additional-work-empty',
          text: 'Допработы отсутствуют.'
        });
      }
    }

    const canRequestAdditionalWork = step.status === 'ready';

    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02-N11',
          className: 'peaks-d2-screen',
          focusOnEntry: true,
          ariaBusy: step.status === 'loading' || pending,
          liveStatus:
            step.status === 'loading'
              ? 'Загрузка допработ.'
              : additionalWorkState
                ? 'Список допработ обновлён.'
                : 'Допработы отсутствуют.',
          scrollObjects,
          fixedBottomObjects: [
            ...(canRequestAdditionalWork
              ? [
                  actionObject('request_additional_work', {
                    disabled: pending,
                    onClick: () => void loadAdditionalWorkTypes()
                  })
                ]
              : []),
            actionObject('back', {
              disabled: step.status === 'ready' && pending,
              onClick: backFromAdditionalWorkMenu
            })
          ]
        }}
      />
    );
  }

  if (step.kind === 'additional-work-type-list') {
    const scrollObjects =
      step.status === 'ready'
        ? additionalWorkTypes.map((additionalWorkType) => ({
            kind: 'listButton' as const,
            id: additionalWorkType.additional_work_type_id,
            actionId: 'select_additional_work_type',
            variant: 'gray' as const,
            mainLine: additionalWorkType.display_name,
            disabled: pending,
            onClick: () => {
              invalidateAdditionalWorkAsync();
              dispatch({
                type: 'ADDITIONAL_WORK_TYPE_SELECTED',
                additionalWorkType
              });
            }
          }))
        : [
            {
              kind: 'messageText' as const,
              id: 'additional-work-types-state',
              text: step.status === 'loading' ? 'Загрузка…' : 'Доступные типы допработ отсутствуют.'
            }
          ];

    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02-AW01',
          className: 'peaks-d2-screen',
          focusOnEntry: true,
          ariaBusy: step.status === 'loading' || pending,
          liveStatus:
            step.status === 'loading'
              ? 'Загрузка типов допработ.'
              : step.status === 'empty'
                ? 'Доступные типы допработ отсутствуют.'
                : 'Типы допработ загружены.',
          fixedTopObjects: [infoText('Выберите допработу')],
          scrollObjects,
          fixedBottomObjects: [
            actionObject('back', {
              disabled: step.status !== 'loading' && pending,
              onClick: backFromAdditionalWorkTypes
            })
          ]
        }}
      />
    );
  }

  if (step.kind === 'additional-work-request-confirm') {
    const selectedTypeIsFresh =
      additionalWorkTypes.some(
        (item) =>
          item.additional_work_type_id === step.additionalWorkType.additional_work_type_id &&
          item.display_name === step.additionalWorkType.display_name
      );

    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02-AW02',
          className: 'peaks-d2-screen',
          focusOnEntry: true,
          ariaBusy: pending,
          liveStatus: pending ? 'Запрос допработы отправляется.' : 'Подтвердите запрос допработы.',
          fixedTopObjects: [infoText('Подтверждение запроса допработы')],
          scrollObjects: [
            {
              kind: 'custom',
              id: 'additional-work-request-confirmation',
              node: (
                <section className="peaks-d2-confirmation" aria-label="Подтверждение запроса">
                  <div>Вы хотите запросить:</div>
                  <div className="peaks-d2-confirmation__contract">
                    {step.additionalWorkType.display_name}
                  </div>
                  <div>?</div>
                </section>
              )
            }
          ],
          fixedBottomObjects: [
            actionObject('request_additional_work', {
              label: (
                <>
                  <span>Запросить:</span>
                  <span>{step.additionalWorkType.display_name}</span>
                </>
              ),
              className: 'peaks-d2-text-action',
              showIcon: false,
              disabled: pending || !selectedTypeIsFresh,
              onClick: () => void requestAdditionalWork(step.additionalWorkType)
            }),
            d2BackAction({ disabled: pending, onClick: backFromAdditionalWorkStep })
          ]
        }}
      />
    );
  }

  if (step.kind === 'additional-work-start-confirm') {
    const additionalWork = step.additionalWork;
    const currentItem = additionalWorkState?.approved_additional_works.find(
      (item) =>
        item.additional_work_id === additionalWork.additional_work_id &&
        item.action === 'START_ADDITIONAL_WORK' &&
        item.origin === additionalWork.origin
    );
    const nodeId =
      additionalWork.origin === 'OPERATOR_REQUEST_APPROVED' ? 'S02-AW03A' : 'S02-AW03B';

    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId,
          className: 'peaks-d2-screen',
          focusOnEntry: true,
          ariaBusy: pending,
          liveStatus: pending ? 'Допработа запускается.' : 'Подтвердите начало допработы.',
          fixedTopObjects: [
            infoText(
              additionalWork.origin === 'OPERATOR_REQUEST_APPROVED'
                ? 'Согласованная допработа'
                : 'Назначенная допработа'
            )
          ],
          scrollObjects: [
            {
              kind: 'custom',
              id: 'additional-work-start-name',
              node: (
                <section className="peaks-d2-contract-card" aria-label="Выбранная допработа">
                  {additionalWork.display_name}
                </section>
              )
            }
          ],
          fixedBottomObjects: [
            actionObject('start_additional_work', {
              label: (
                <>
                  <span>Начать:</span>
                  <span>{additionalWork.display_name}</span>
                </>
              ),
              className: 'peaks-d2-text-action peaks-d2-gray-green',
              showIcon: false,
              disabled: pending || !currentItem,
              onClick: () => void startAdditionalWork(additionalWork)
            }),
            d2BackAction({ disabled: pending, onClick: backFromAdditionalWorkStep })
          ]
        }}
      />
    );
  }

  if (step.kind === 'additional-work-finish-confirm') {
    const additionalWork = step.additionalWork;
    const currentItem = additionalWorkState?.active_additional_works.find(
      (item) =>
        item.additional_work_id === additionalWork.additional_work_id &&
        item.action === 'FINISH_ADDITIONAL_WORK'
    );

    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02-AW04',
          className: 'peaks-d2-screen',
          focusOnEntry: true,
          ariaBusy: pending,
          liveStatus: pending ? 'Допработа завершается.' : 'Подтвердите завершение допработы.',
          fixedTopObjects: [infoText('Завершение допработы')],
          scrollObjects: [
            {
              kind: 'custom',
              id: 'additional-work-finish-confirmation',
              node: (
                <section className="peaks-d2-confirmation" aria-label="Подтверждение завершения">
                  <div>Вы хотите завершить:</div>
                  <div className="peaks-d2-confirmation__contract">
                    {additionalWork.display_name}
                  </div>
                  <div>?</div>
                </section>
              )
            }
          ],
          fixedBottomObjects: [
            actionObject('finish_additional_work', {
              label: (
                <>
                  <span>Завершить:</span>
                  <span>{additionalWork.display_name}</span>
                </>
              ),
              className: 'peaks-d2-text-action',
              showIcon: false,
              disabled: pending || !currentItem,
              onClick: () => void finishAdditionalWork(additionalWork)
            }),
            d2BackAction({ disabled: pending, onClick: backFromAdditionalWorkStep })
          ]
        }}
      />
    );
  }

  if (step.kind === 'additional-work-result') {
    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02-AW05',
          className: 'peaks-d2-screen',
          focusOnEntry: true,
          ariaBusy: pending,
          liveStatus: pending
            ? 'Обновление списка допработ.'
            : 'Допработа завершена и ожидает решения по оплате.',
          fixedTopObjects: [infoText('Допработа завершена')],
          scrollObjects: [
            {
              kind: 'custom',
              id: 'additional-work-result-card',
              node: (
                <section className="peaks-d2-result-card" aria-label="Результат завершения допработы">
                  <div>Допработа завершена:</div>
                  <div className="peaks-d2-result-card__contract">
                    {step.additionalWork.display_name}
                  </div>
                  <div>Ожидает решения по оплате.</div>
                </section>
              )
            }
          ],
          fixedBottomObjects: [
            d2BackAction({
              disabled: pending,
              onClick: () => void closeAdditionalWorkResult()
            })
          ]
        }}
      />
    );
  }

  if (step.kind === 'machine-entry') {
    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'START_PRODUCTION_SELECT_MACHINE_ENTRY',
          fixedTopObjects: [infoText('Выбор станка.')],
          scrollObjects: [
            actionObject('scan_machine_qr', { disabled: pending, onClick: openQrPlaceholder }),
            actionObject('select_machine_from_list', { disabled: pending, onClick: () => void loadMachines() })
          ],
          fixedBottomObjects: [actionObject('back', { disabled: pending, onClick: () => dispatch({ type: 'BACK' }) })]
        }}
      />
    );
  }

  if (step.kind === 'machine-list') {
    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'START_PRODUCTION_SELECT_MACHINE_LIST',
          fixedTopObjects: [infoText('Выберите станок из списка.')],
          scrollObjects: machines.map((machine) => ({
            kind: 'listButton',
            id: machine.machine_id,
            actionId: 'select_machine',
            mainLine: machine.machine_name,
            disabled: pending,
            onClick: () => void selectMachine(machine)
          })),
          fixedBottomObjects: [actionObject('back', { disabled: pending, onClick: () => dispatch({ type: 'BACK' }) })]
        }}
      />
    );
  }

  if (step.kind === 'sku-list') {
    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'START_PRODUCTION_SELECT_SKU_LIST',
          fixedTopObjects: [infoText('Выберите SKU из списка.')],
          scrollObjects: skus.map((sku) => ({
            kind: 'listButton',
            id: sku.sku_id,
            actionId: 'select_sku',
            mainLine: sku.sku_code,
            secondaryLine: sku.sku_name,
            disabled: pending,
            onClick: () => void selectSku(step.machine, sku)
          })),
          fixedBottomObjects: [actionObject('back', { disabled: pending, onClick: () => dispatch({ type: 'BACK' }) })]
        }}
      />
    );
  }

  if (step.kind === 'quantity-entry') {
    return (
      <ProductionQuantityNode
        pending={pending}
        productionOperationId={step.productionOperationId}
        onBack={() => dispatch({ type: 'BACK' })}
        onFinish={(quantityProduced) => void finishProduction(step.productionOperationId, quantityProduced)}
      />
    );
  }

  if (step.kind === 'break-type-list') {
    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'BREAK_SELECT_TYPE',
          fixedTopObjects: [infoText('Выберите тип перерыва.')],
          scrollObjects: breakTypes.map((breakType) =>
            actionObject('start_break', {
              id: breakType.break_type_id,
              label: (
                <>
                  <span>Начать</span>
                  <span>{breakType.display_name}</span>
                </>
              ),
              variant: 'yellow',
              disabled: pending,
              onClick: () => void selectBreakType(breakType)
            })
          ),
          fixedBottomObjects: [actionObject('back', { disabled: pending, onClick: () => dispatch({ type: 'BACK' }) })]
        }}
      />
    );
  }

  if (step.kind === 'confirm-finish-break') {
    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'BREAK_CONFIRM_FINISH',
          fixedTopObjects: [
            infoText(
              <>
                Вы хотите завершить
                <br />
                перерыв?
              </>,
              'blue'
            )
          ],
          scrollObjects: [
            {
              kind: 'custom',
              id: 'break-type-card',
              node: <BreakTypeCard breakTypeName={workplaceState.break?.break_type_name} />
            }
          ],
          fixedBottomObjects: [
            actionObject('finish_break', { disabled: pending, onClick: () => void finishBreak() }),
            actionObject('back', { disabled: pending, onClick: () => dispatch({ type: 'BACK' }) })
          ]
        }}
      />
    );
  }

  if (step.kind === 'downtime-type-list') {
    const scrollObjects =
      step.status === 'ready'
        ? downtimeTypes.map((downtimeType) =>
            actionObject('start_downtime', {
              id: downtimeType.downtime_type_id,
              label: (
                <>
                  <span>Начать:</span>
                  <span>{downtimeType.display_name}</span>
                </>
              ),
              variant: downtimeType.downtime_class === 'OPERATIONAL' ? 'yellow' : 'red',
              disabled: pending,
              onClick: () => selectDowntimeType(downtimeType)
            })
          )
        : [
            {
              kind: 'messageText' as const,
              id: 'downtime-types-state',
              text: step.status === 'loading' ? 'Загрузка…' : 'Доступные типы простоя отсутствуют.'
            }
          ];

    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02-N09',
          fixedTopObjects: [infoText('Выберите тип простоя.')],
          scrollObjects,
          fixedBottomObjects: [actionObject('back', { onClick: backFromDowntimeTypes })]
        }}
      />
    );
  }

  if (step.kind === 'downtime-machine-list') {
    const scrollObjects =
      step.status === 'ready'
        ? criticalDowntimeMachines.map((machine) => ({
            kind: 'listButton' as const,
            id: machine.machine_id,
            actionId: 'select_machine',
            mainLine: machine.machine_name,
            disabled: pending || machine.is_selectable_for_critical_downtime !== true,
            onClick: () =>
              dispatch({
                type: 'DOWNTIME_MACHINE_SELECTED',
                context: {
                  downtimeType: step.downtimeType,
                  machine,
                  productionOperationId: null,
                  returnTo: 'downtime-machine-list'
                }
              })
          }))
        : [
            {
              kind: 'messageText' as const,
              id: 'downtime-machines-state',
              text: step.status === 'loading' ? 'Загрузка…' : 'Доступные станки отсутствуют.'
            }
          ];

    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02-N04',
          fixedTopObjects: [infoText('Выберите станок из списка.')],
          scrollObjects,
          fixedBottomObjects: [actionObject('back', { onClick: backFromDowntimeMachines })]
        }}
      />
    );
  }

  if (step.kind === 'downtime-comment') {
    return (
      <CriticalDowntimeCommentNode
        initialComment={step.comment}
        pending={pending}
        onBack={() => dispatch({ type: 'BACK' })}
        onNext={(comment) => dispatch({ type: 'DOWNTIME_COMMENT_ENTERED', comment })}
      />
    );
  }

  if (step.kind === 'downtime-confirm') {
    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02-N27',
          fixedTopObjects: [
            infoText(
              <>
                Вы хотите начать:
                <br />
                {step.context.downtimeType.display_name}
                <br />
                <br />
                на станке:
                <br />
                {step.context.machine.machine_name}
              </>,
              'blue'
            )
          ],
          scrollObjects: [
            {
              kind: 'custom',
              id: 'critical-downtime-comment',
              node: (
                <section className="peaks-comment-input-keyboard" aria-label="Комментарий">
                  <textarea
                    aria-label="Комментарий оператора"
                    className="peaks-comment-input-keyboard__field"
                    name="confirmed_comment"
                    readOnly
                    rows={4}
                    value={`Комментарий:\n${step.comment}`}
                  />
                </section>
              )
            }
          ],
          fixedBottomObjects: [
            actionObject('start_downtime', {
              label: (
                <>
                  Начать:
                  <br />
                  {step.context.downtimeType.display_name}
                </>
              ),
              variant: 'red',
              disabled: pending,
              onClick: () =>
                void startCriticalDowntime(
                  step.context.downtimeType,
                  step.context.machine,
                  step.context.productionOperationId,
                  step.comment
                )
            }),
            actionObject('back', { disabled: pending, onClick: () => dispatch({ type: 'BACK' }) })
          ]
        }}
      />
    );
  }

  if (step.kind === 'downtime-result') {
    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02-N28',
          fixedTopObjects: [
            infoText(
              <>
                Информация о технической неисправности станка:
                <br />
                {step.machineName}
                <br />
                <br />
                передана начальнику производства.
              </>,
              'blue'
            )
          ],
          scrollObjects: [],
          fixedBottomObjects: [
            actionObject('back', {
              disabled: pending,
              onClick: () => void closeCriticalDowntimeResult()
            })
          ]
        }}
      />
    );
  }

  if (step.kind === 'confirm-finish-downtime') {
    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02-N10',
          fixedTopObjects: [
            infoText(
              <>
                Вы хотите завершить:
                <br />
                {step.downtimeTypeName}?
              </>,
              'blue'
            )
          ],
          scrollObjects: [],
          fixedBottomObjects: [
            actionObject(
              step.downtimeClass === 'CRITICAL'
                ? 'finish_downtime_critical'
                : 'finish_downtime_operational',
              {
                label: (
                  <>
                    Завершить:
                    <br />
                    {step.downtimeTypeName}
                  </>
                ),
                variant: step.downtimeClass === 'CRITICAL' ? 'red' : 'yellow',
                disabled: pending,
                onClick: () => void finishDowntime(step.downtimeId)
              }
            ),
            actionObject('back', { disabled: pending, onClick: () => dispatch({ type: 'BACK' }) })
          ]
        }}
      />
    );
  }

  if (step.kind === 'message') {
    const additionalWorkMessage = isAdditionalWorkPipelineState(step.backTo);
    const hasRetry = additionalWorkMessage
      ? additionalWorkRetry.current !== null
      : downtimeRetry.current !== null;

    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: 'S02_MESSAGE',
          className: additionalWorkMessage ? 'peaks-d2-screen' : undefined,
          focusOnEntry: additionalWorkMessage,
          ariaBusy: additionalWorkMessage ? pending : undefined,
          liveStatus: additionalWorkMessage ? `${step.title}. ${step.message}` : undefined,
          fixedTopObjects: [infoText(step.title, 'blue')],
          scrollObjects: [{ kind: 'messageText', id: 'message', text: step.message }],
          fixedBottomObjects: [
            ...(step.retry && hasRetry
              ? [
                  actionObject(additionalWorkMessage ? 'request_additional_work' : 'start_downtime', {
                    label: additionalWorkMessage ? 'Обновить' : 'Повторить',
                    disabled: additionalWorkMessage ? pending : undefined,
                    onClick: additionalWorkMessage
                      ? runAdditionalWorkRetry
                      : () => downtimeRetry.current?.()
                  })
                ]
              : []),
            actionObject('back', {
              onClick: additionalWorkMessage
                ? backFromAdditionalWorkStep
                : () => dispatch({ type: 'BACK' })
            })
          ]
        }}
      />
    );
  }



  if (finishShiftStep) {
    if (finishShiftStep.kind === 'blocked') {
      const finishShiftWorkplace = workplaceState as FinishShiftLooseWorkplace & {
        break?: FinishShiftLooseWorkplace['break'] & { break_type_name?: unknown };
        downtime?: FinishShiftLooseWorkplace['downtime'] & { downtime_type_name?: unknown };
        additional_work_summary?: FinishShiftLooseWorkplace['additional_work_summary'] & {
          display_name?: unknown;
          active_display_name?: unknown;
          additional_work_display_name?: unknown;
        };
      };

      const breakTypeName = finishShiftDisplayValue(
        finishShiftWorkplace.break?.break_type_name,
        '{break.break_type_name}'
      );
      const downtimeTypeName = finishShiftDisplayValue(
        finishShiftWorkplace.downtime?.downtime_type_name,
        '{downtime.downtime_type_name}'
      );
      const additionalWorkName = finishShiftDisplayValue(
        finishShiftWorkplace.additional_work_summary?.active_display_name ??
          finishShiftWorkplace.additional_work_summary?.additional_work_display_name ??
          finishShiftWorkplace.additional_work_summary?.display_name,
        '{additional_work.display_name}'
      );

      const blockerButton = (
        id: string,
        className: string,
        label: React.ReactNode,
        onClick: () => void
      ) => ({
        kind: 'custom' as const,
        id,
        node: (
          <button
            className={`peaks-d3-fs02-blocker-button ${className}`}
            type="button"
            disabled={pending}
            aria-disabled={pending}
            onClick={onClick}
          >
            {label}
          </button>
        )
      });

      const twoLineLabel = (value: string) => (
        <span className="peaks-d3-fs02-two-line-label">
          <span className="peaks-d3-fs02-button-action-line">Завершить:</span>
          <span className="peaks-d3-fs02-button-value-line">{value}</span>
        </span>
      );

      return (
        <PeaksGraphNodeRenderer
          view={{
            nodeId: 'S02-FS02',
            className: 'peaks-d3-screen peaks-d3-fs02-screen',
            focusOnEntry: true,
            ariaBusy: pending,
            fixedTopObjects: [infoText('Вы хотите завершить смену?\nСначала закройте:', 'blue')],
            scrollObjects: finishShiftStep.blockers.map((text, index) => {
              const blockerToken = normalizeFinishShiftBlockerToken(text);

              if (blockerToken === 'PRODUCTION') {
                return blockerButton(
                  `finish-shift-blocker-production-${index}`,
                  'peaks-d3-fs02-green',
                  <span className="peaks-d3-fs02-button-label">Завершить производство</span>,
                  () => {
                    setFinishShiftStep(null);
                    openFinishProduction();
                  }
                );
              }

              if (blockerToken === 'BREAK') {
                return blockerButton(
                  `finish-shift-blocker-break-${index}`,
                  'peaks-d3-fs02-yellow',
                  twoLineLabel(breakTypeName),
                  () => {
                    setFinishShiftStep(null);
                    openFinishBreakConfirm();
                  }
                );
              }

              if (blockerToken === 'OPERATIONAL_DOWNTIME') {
                return blockerButton(
                  `finish-shift-blocker-downtime-${index}`,
                  'peaks-d3-fs02-yellow',
                  twoLineLabel(downtimeTypeName),
                  () => {
                    setFinishShiftStep(null);
                    openFinishDowntime();
                  }
                );
              }

              if (blockerToken === 'ADDITIONAL_WORK') {
                return blockerButton(
                  `finish-shift-blocker-additional-work-${index}`,
                  'peaks-d3-fs02-dopwork-green',
                  twoLineLabel(additionalWorkName),
                  () => {
                    setFinishShiftStep(null);
                    void loadAdditionalWorkMenu();
                  }
                );
              }

              return {
                kind: 'messageText' as const,
                id: `finish-shift-blocker-${index}`,
                text
              };
            }),
            fixedBottomObjects: [
              actionObject('finish_shift', {
                disabled: true,
                onClick: () => undefined
              }),
              actionObject('back', {
                disabled: pending,
                onClick: backFromFinishShift
              })
            ]
          }}
        />
      );
    }

    if (finishShiftStep.kind === 'finished') {
      return (
        <PeaksGraphNodeRenderer
          view={{
            nodeId: 'S02-FS04',
            className: 'peaks-d3-screen',
            focusOnEntry: true,
            ariaBusy: pending,
            fixedTopObjects: [infoText('Смена завершена.', 'blue')],
            scrollObjects: [
              {
                kind: 'messageText',
                id: 'finish-shift-result',
                text: 'Информация о завершении смены сохранена.'
              }
            ],
            fixedBottomObjects: [
              actionObject('back', {
                disabled: pending,
                onClick: backFromFinishShift
              })
            ]
          }}
        />
      );
    }

    const hasWarnings = finishShiftStep.warnings.length > 0;

    return (
      <PeaksGraphNodeRenderer
        view={{
          nodeId: hasWarnings ? 'S02-FS03' : 'S02-FS01',
          className: 'peaks-d3-screen',
          focusOnEntry: true,
          ariaBusy: pending,
          fixedTopObjects: [infoText('Завершить смену?', 'blue')],
          scrollObjects: [
            {
              kind: 'messageText',
              id: 'finish-shift-confirm',
              text: 'Подтвердите завершение текущей смены.'
            },
            ...finishShiftStep.warnings.map((text, index) => ({
              kind: 'messageText' as const,
              id: `finish-shift-warning-${index}`,
              text
            }))
          ],
          fixedBottomObjects: [
            actionObject('finish_shift', {
              disabled: pending,
              onClick: () => void confirmFinishShift()
            }),
            actionObject('back', {
              disabled: pending,
              onClick: backFromFinishShift
            })
          ]
        }}
      />
    );
  }

  return (
    <Section02OperatorWorkplaceActive
      workplaceState={workplaceState}
      onStartProduction={openMachineEntry}
      onFinishProduction={openFinishProduction}
      onStartBreak={() => void loadBreakTypes()}
      onFinishBreak={openFinishBreakConfirm}
      onStartDowntime={() => void loadDowntimeTypes()}
      onFinishDowntime={openFinishDowntime}
      onFinishShift={() => void openFinishShift()}
      onOpenAdditionalWork={() => void loadAdditionalWorkMenu()}
      onOpenSalary={onOpenSalary}
    />
  );
}

function CriticalDowntimeCommentNode({
  initialComment,
  pending,
  onNext,
  onBack
}: {
  initialComment: string;
  pending: boolean;
  onNext: (comment: string) => void;
  onBack: () => void;
}) {
  const [comment, setComment] = useState(initialComment);

  return (
    <PeaksGraphNodeRenderer
      view={{
        nodeId: 'S02-N26',
        fixedTopObjects: [infoText('Опишите, что произошло со станком')],
        scrollObjects: [
          {
            kind: 'custom',
            id: 'critical-downtime-comment-entry',
            node: (
              <PeaksCommentInputKeyboard
                ariaLabel="Комментарий"
                disabled={pending}
                minRows={4}
                value={comment}
                onChange={setComment}
              />
            )
          }
        ],
        fixedBottomObjects: [
          actionObject('start_downtime', {
            label: 'Далее',
            variant: 'red',
            disabled: pending || isEmptyCommentInput(comment),
            onClick: () => onNext(comment)
          }),
          actionObject('back', { disabled: pending, onClick: onBack })
        ]
      }}
    />
  );
}

function ProductionQuantityNode({
  productionOperationId,
  pending,
  onFinish,
  onBack
}: {
  productionOperationId: string;
  pending: boolean;
  onFinish: (quantityProduced: string) => void;
  onBack: () => void;
}) {
  const [quantity, setQuantity] = useState('');

  function finishFromQuantity() {
    if (pending || isMalformedNumericInput(quantity)) {
      return;
    }

    onFinish(quantity);
  }

  return (
    <PeaksGraphNodeRenderer
      view={{
        nodeId: 'FINISH_PRODUCTION_ENTER_QUANTITY',
        fixedTopObjects: [infoText('Введите количество сделанной продукции.')],
        scrollObjects: [
          {
            kind: 'custom',
            id: 'quantity-entry',
            node: (
              <PeaksNumericInputKeyboard
                ariaLabel="Ввод количества"
                disabled={pending}
                value={quantity}
                onChange={setQuantity}
                hiddenFields={[
                  { name: 'quantity_produced', value: normalizeNumericInputForApi(quantity) },
                  { name: 'production_operation_id', value: productionOperationId }
                ]}
              />
            )
          }
        ],
        fixedBottomObjects: [
          actionObject('finish_production', {
            disabled: pending,
            label: (
              <>
                Завершить<br />производство
              </>
            ),
            onClick: finishFromQuantity
          }),
          actionObject('back', { disabled: pending, onClick: onBack })
        ]
      }}
    />
  );
}

function BreakTypeCard({ breakTypeName }: { breakTypeName?: string | null }) {
  return (
    <section className="peaks-break-type-card" aria-label="Тип перерыва">
      <div className="peaks-break-type-card__label">Тип перерыва:</div>
      <div className="peaks-break-type-card__value">{breakTypeName || '—'}</div>
    </section>
  );
}

function infoText(text: ReactNode, tone: 'default' | 'blue' = 'default'): PeaksGraphObject {
  return {
    kind: 'infoText',
    id: typeof text === 'string' ? text : undefined,
    text,
    tone
  };
}

function actionObject(
  actionId: S02ActionId,
  overrides: Partial<Extract<PeaksGraphObject, { kind: 'actionButton' }>> = {}
): PeaksGraphObject {
  const action = getS02ActionDefinition(actionId);

  return {
    kind: 'actionButton',
    id: overrides.id,
    actionId: action.actionId,
    icon: overrides.icon ?? action.icon,
    label: overrides.label ?? action.label,
    size: overrides.size ?? action.size,
    variant: overrides.variant ?? action.variant,
    disabled: overrides.disabled,
    onClick: overrides.onClick,
    className: overrides.className,
    showIcon: overrides.showIcon
  };
}

function d2BackAction(
  overrides: Partial<Extract<PeaksGraphObject, { kind: 'actionButton' }>> = {}
): PeaksGraphObject {
  return actionObject('back', {
    ...overrides,
    className: ['peaks-d2-text-action', overrides.className].filter(Boolean).join(' '),
    showIcon: false
  });
}

function isAdditionalWorkPipelineState(state: { kind: string }): boolean {
  return state.kind.startsWith('additional-work-');
}

function additionalWorkStateIdentity(state: Section02PipelineState): string | null {
  switch (state.kind) {
    case 'additional-work-menu':
    case 'additional-work-type-list':
      return `${state.kind}:${String(state.status)}`;
    case 'additional-work-request-confirm': {
      return `${state.kind}:${state.additionalWorkType.additional_work_type_id}`;
    }
    case 'additional-work-start-confirm':
    case 'additional-work-finish-confirm':
    case 'additional-work-result': {
      return `${state.kind}:${state.additionalWork.additional_work_id}`;
    }
    case 'message': {
      const backToIdentity = additionalWorkStateIdentity(state.backTo);
      return backToIdentity ? `message>${backToIdentity}` : null;
    }
    default:
      return null;
  }
}

class AdditionalWorkRefreshCancelledError extends Error {
  constructor() {
    super('Additional-work refresh was invalidated');
    this.name = 'AdditionalWorkRefreshCancelledError';
  }
}

function isValidationError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 400;
}

function isAuthOrForbiddenError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403);
}

function isStaleOrConflictError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 404 || error.status === 409);
}

function readApiErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiClientError) || typeof error.payload !== 'object' || error.payload === null) {
    return null;
  }

  const payload = error.payload as { error?: { message?: unknown } };
  return typeof payload.error?.message === 'string' && payload.error.message.trim() !== ''
    ? payload.error.message
    : null;
}

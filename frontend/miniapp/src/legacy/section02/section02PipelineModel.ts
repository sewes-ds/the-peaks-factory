import type {
  ActiveAdditionalWorkItem,
  AdditionalWorkTypesAvailableResponse,
  ApprovedAdditionalWorkItem,
  OperatorAvailableDowntimeTypeItem,
  OperatorDowntimeMachineReference,
  OperatorDowntimeClass,
  OperatorMachineItem
} from '../../section02/operatorWorkplace';

export type Section02PipelineId =
  | 'SECTION_02_ENTRY'
  | 'START_SHIFT'
  | 'START_PRODUCTION'
  | 'FINISH_PRODUCTION'
  | 'START_BREAK'
  | 'FINISH_BREAK'
  | 'START_DOWNTIME'
  | 'START_OPERATIONAL_DOWNTIME'
  | 'START_CRITICAL_DOWNTIME_WITH_OPERATION'
  | 'START_CRITICAL_DOWNTIME_WITHOUT_OPERATION'
  | 'FINISH_DOWNTIME'
  | 'OPEN_ADDITIONAL_WORK'
  | 'REQUEST_ADDITIONAL_WORK'
  | 'START_ADDITIONAL_WORK'
  | 'FINISH_ADDITIONAL_WORK';

export type Section02PipelineOwner = 'app' | 'operator-host';

export type Section02PipelineEffectId =
  | 'REFETCH_OPERATOR_WORKPLACE'
  | 'MUTATE_START_SHIFT'
  | 'LOAD_OPERATOR_MACHINES'
  | 'LOAD_OPERATOR_SKUS'
  | 'MUTATE_START_PRODUCTION'
  | 'MUTATE_FINISH_PRODUCTION'
  | 'LOAD_OPERATOR_BREAK_TYPES'
  | 'MUTATE_START_BREAK'
  | 'MUTATE_FINISH_BREAK'
  | 'LOAD_AVAILABLE_DOWNTIME_TYPES'
  | 'LOAD_CRITICAL_DOWNTIME_MACHINES'
  | 'MUTATE_START_DOWNTIME'
  | 'REFETCH_OPERATOR_WORKPLACE_ON_RESULT_BACK'
  | 'MUTATE_FINISH_DOWNTIME'
  | 'REFETCH_OPERATOR_ADDITIONAL_WORK'
  | 'LOAD_AVAILABLE_ADDITIONAL_WORK_TYPES'
  | 'MUTATE_REQUEST_ADDITIONAL_WORK'
  | 'MUTATE_START_ADDITIONAL_WORK'
  | 'MUTATE_FINISH_ADDITIONAL_WORK'
  | 'REFETCH_ADDITIONAL_WORK_AND_WORKPLACE'
  | 'REFETCH_ADDITIONAL_WORK_AND_WORKPLACE_ON_RESULT_BACK';

export type Section02PipelineDefinition = {
  pipelineId: Section02PipelineId;
  owner: Section02PipelineOwner;
  effectIds: readonly Section02PipelineEffectId[];
};

export const SECTION_02_PIPELINE_REGISTRY = {
  SECTION_02_ENTRY: {
    pipelineId: 'SECTION_02_ENTRY',
    owner: 'app',
    effectIds: ['REFETCH_OPERATOR_WORKPLACE']
  },
  START_SHIFT: {
    pipelineId: 'START_SHIFT',
    owner: 'app',
    effectIds: ['MUTATE_START_SHIFT', 'REFETCH_OPERATOR_WORKPLACE']
  },
  START_PRODUCTION: {
    pipelineId: 'START_PRODUCTION',
    owner: 'operator-host',
    effectIds: [
      'LOAD_OPERATOR_MACHINES',
      'LOAD_OPERATOR_SKUS',
      'MUTATE_START_PRODUCTION',
      'REFETCH_OPERATOR_WORKPLACE'
    ]
  },
  FINISH_PRODUCTION: {
    pipelineId: 'FINISH_PRODUCTION',
    owner: 'operator-host',
    effectIds: ['MUTATE_FINISH_PRODUCTION', 'REFETCH_OPERATOR_WORKPLACE']
  },
  START_BREAK: {
    pipelineId: 'START_BREAK',
    owner: 'operator-host',
    effectIds: ['LOAD_OPERATOR_BREAK_TYPES', 'MUTATE_START_BREAK', 'REFETCH_OPERATOR_WORKPLACE']
  },
  FINISH_BREAK: {
    pipelineId: 'FINISH_BREAK',
    owner: 'operator-host',
    effectIds: ['MUTATE_FINISH_BREAK', 'REFETCH_OPERATOR_WORKPLACE']
  },
  START_DOWNTIME: {
    pipelineId: 'START_DOWNTIME',
    owner: 'operator-host',
    effectIds: ['LOAD_AVAILABLE_DOWNTIME_TYPES']
  },
  START_OPERATIONAL_DOWNTIME: {
    pipelineId: 'START_OPERATIONAL_DOWNTIME',
    owner: 'operator-host',
    effectIds: ['MUTATE_START_DOWNTIME', 'REFETCH_OPERATOR_WORKPLACE']
  },
  START_CRITICAL_DOWNTIME_WITH_OPERATION: {
    pipelineId: 'START_CRITICAL_DOWNTIME_WITH_OPERATION',
    owner: 'operator-host',
    effectIds: ['MUTATE_START_DOWNTIME', 'REFETCH_OPERATOR_WORKPLACE_ON_RESULT_BACK']
  },
  START_CRITICAL_DOWNTIME_WITHOUT_OPERATION: {
    pipelineId: 'START_CRITICAL_DOWNTIME_WITHOUT_OPERATION',
    owner: 'operator-host',
    effectIds: [
      'LOAD_CRITICAL_DOWNTIME_MACHINES',
      'MUTATE_START_DOWNTIME',
      'REFETCH_OPERATOR_WORKPLACE_ON_RESULT_BACK'
    ]
  },
  FINISH_DOWNTIME: {
    pipelineId: 'FINISH_DOWNTIME',
    owner: 'operator-host',
    effectIds: ['MUTATE_FINISH_DOWNTIME', 'REFETCH_OPERATOR_WORKPLACE']
  },
  OPEN_ADDITIONAL_WORK: {
    pipelineId: 'OPEN_ADDITIONAL_WORK',
    owner: 'operator-host',
    effectIds: ['REFETCH_OPERATOR_ADDITIONAL_WORK', 'REFETCH_OPERATOR_WORKPLACE']
  },
  REQUEST_ADDITIONAL_WORK: {
    pipelineId: 'REQUEST_ADDITIONAL_WORK',
    owner: 'operator-host',
    effectIds: [
      'LOAD_AVAILABLE_ADDITIONAL_WORK_TYPES',
      'MUTATE_REQUEST_ADDITIONAL_WORK',
      'REFETCH_ADDITIONAL_WORK_AND_WORKPLACE'
    ]
  },
  START_ADDITIONAL_WORK: {
    pipelineId: 'START_ADDITIONAL_WORK',
    owner: 'operator-host',
    effectIds: ['MUTATE_START_ADDITIONAL_WORK', 'REFETCH_ADDITIONAL_WORK_AND_WORKPLACE']
  },
  FINISH_ADDITIONAL_WORK: {
    pipelineId: 'FINISH_ADDITIONAL_WORK',
    owner: 'operator-host',
    effectIds: [
      'MUTATE_FINISH_ADDITIONAL_WORK',
      'REFETCH_ADDITIONAL_WORK_AND_WORKPLACE_ON_RESULT_BACK'
    ]
  }
} as const satisfies Record<Section02PipelineId, Section02PipelineDefinition>;

export type CriticalDowntimeContext = {
  downtimeType: OperatorAvailableDowntimeTypeItem;
  machine: OperatorDowntimeMachineReference;
  productionOperationId: string | null;
  returnTo: 'downtime-type-list' | 'downtime-machine-list';
};

export type Section02PipelineReturnState =
  | { kind: 'workplace' }
  | { kind: 'machine-entry' }
  | { kind: 'machine-list' }
  | { kind: 'sku-list'; machine: OperatorMachineItem }
  | {
      kind: 'quantity-entry';
      productionOperationId: string;
      machineName?: string | null;
      skuCode?: string | null;
      skuName?: string | null;
    }
  | { kind: 'break-type-list' }
  | { kind: 'confirm-finish-break' }
  | { kind: 'downtime-type-list'; status: 'loading' | 'ready' | 'empty' }
  | {
      kind: 'downtime-machine-list';
      status: 'loading' | 'ready' | 'empty';
      downtimeType: OperatorAvailableDowntimeTypeItem;
    }
  | { kind: 'downtime-comment'; context: CriticalDowntimeContext; comment: string }
  | { kind: 'downtime-confirm'; context: CriticalDowntimeContext; comment: string }
  | { kind: 'downtime-result'; machineName: string }
  | {
      kind: 'confirm-finish-downtime';
      downtimeId: string;
      downtimeTypeName: string;
      downtimeClass: OperatorDowntimeClass;
    }
  | { kind: 'additional-work-menu'; status: 'loading' | 'ready' }
  | { kind: 'additional-work-type-list'; status: 'loading' | 'ready' | 'empty' }
  | {
      kind: 'additional-work-request-confirm';
      additionalWorkType: AdditionalWorkTypesAvailableResponse['additional_work_types'][number];
    }
  | { kind: 'additional-work-start-confirm'; additionalWork: ApprovedAdditionalWorkItem }
  | { kind: 'additional-work-finish-confirm'; additionalWork: ActiveAdditionalWorkItem }
  | { kind: 'additional-work-result'; additionalWork: ActiveAdditionalWorkItem };

export type Section02PipelineState =
  | Section02PipelineReturnState
  | {
      kind: 'message';
      title: string;
      message: string;
      backTo: Section02PipelineReturnState;
      retry?: boolean;
    };

export type Section02PipelineEvent =
  | { type: 'OPEN_START_PRODUCTION' }
  | {
      type: 'OPEN_FINISH_PRODUCTION';
      productionOperationId?: string | null;
      canFinishProduction?: boolean;
      machineName?: string | null;
      skuCode?: string | null;
      skuName?: string | null;
    }
  | { type: 'MACHINES_LOADED' }
  | { type: 'OPEN_QR_PLACEHOLDER' }
  | { type: 'MACHINE_SELECTED'; machine: OperatorMachineItem }
  | { type: 'PRODUCTION_STARTED' }
  | { type: 'PRODUCTION_FINISHED' }
  | {
      type: 'FINISH_PRODUCTION_REJECTED';
      machineName?: string | null;
      skuCode?: string | null;
      skuName?: string | null;
    }
  | { type: 'BREAK_TYPES_LOADED' }
  | { type: 'BREAK_STARTED' }
  | { type: 'OPEN_FINISH_BREAK' }
  | { type: 'BREAK_FINISHED' }
  | { type: 'OPEN_START_DOWNTIME' }
  | { type: 'DOWNTIME_TYPES_LOADED'; hasItems: boolean }
  | { type: 'OPEN_CRITICAL_DOWNTIME_WITH_OPERATION'; context: CriticalDowntimeContext }
  | { type: 'OPEN_CRITICAL_DOWNTIME_WITHOUT_OPERATION'; downtimeType: OperatorAvailableDowntimeTypeItem }
  | { type: 'DOWNTIME_MACHINES_LOADED'; hasItems: boolean }
  | { type: 'DOWNTIME_MACHINE_SELECTED'; context: CriticalDowntimeContext }
  | { type: 'DOWNTIME_COMMENT_ENTERED'; comment: string }
  | { type: 'OPERATIONAL_DOWNTIME_STARTED' }
  | { type: 'CRITICAL_DOWNTIME_STARTED'; machineName: string }
  | {
      type: 'OPEN_FINISH_DOWNTIME';
      downtimeId?: string | null;
      downtimeTypeName?: string | null;
      downtimeClass?: string | null;
    }
  | { type: 'DOWNTIME_FINISHED' }
  | { type: 'DOWNTIME_RESULT_CLOSED' }
  | { type: 'DOWNTIME_SOURCES_REFRESHED'; hasItems: boolean }
  | { type: 'SHOW_DOWNTIME_ERROR' }
  | { type: 'SHOW_DOWNTIME_VALIDATION_ERROR'; message: string }
  | { type: 'OPEN_ADDITIONAL_WORK' }
  | { type: 'ADDITIONAL_WORK_MENU_LOADED' }
  | { type: 'OPEN_REQUEST_ADDITIONAL_WORK' }
  | { type: 'ADDITIONAL_WORK_TYPES_LOADED'; hasItems: boolean }
  | {
      type: 'ADDITIONAL_WORK_TYPE_SELECTED';
      additionalWorkType: AdditionalWorkTypesAvailableResponse['additional_work_types'][number];
    }
  | { type: 'ADDITIONAL_WORK_REQUESTED' }
  | { type: 'ADDITIONAL_WORK_APPROVED_SELECTED'; additionalWork: ApprovedAdditionalWorkItem }
  | { type: 'ADDITIONAL_WORK_STARTED' }
  | { type: 'ADDITIONAL_WORK_ACTIVE_SELECTED'; additionalWork: ActiveAdditionalWorkItem }
  | { type: 'ADDITIONAL_WORK_FINISHED' }
  | { type: 'ADDITIONAL_WORK_RESULT_CLOSED' }
  | { type: 'ADDITIONAL_WORK_MENU_REFRESHED' }
  | { type: 'ADDITIONAL_WORK_TYPES_REFRESHED'; hasItems: boolean }
  | { type: 'SHOW_ADDITIONAL_WORK_ERROR' }
  | { type: 'SHOW_ADDITIONAL_WORK_VALIDATION_ERROR'; message: string }
  | { type: 'SHOW_FATAL_ERROR' }
  | { type: 'BACK' };

export const SECTION_02_INITIAL_PIPELINE_STATE: Section02PipelineState = { kind: 'workplace' };

export function section02PipelineReducer(
  state: Section02PipelineState,
  event: Section02PipelineEvent
): Section02PipelineState {
  switch (event.type) {
    case 'MACHINES_LOADED':
      return { kind: 'machine-list' };
    case 'MACHINE_SELECTED':
      return { kind: 'sku-list', machine: event.machine };
    case 'PRODUCTION_STARTED':
    case 'PRODUCTION_FINISHED':
    case 'BREAK_STARTED':
    case 'BREAK_FINISHED':
    case 'OPERATIONAL_DOWNTIME_STARTED':
    case 'DOWNTIME_FINISHED':
    case 'DOWNTIME_RESULT_CLOSED':
      return { kind: 'workplace' };
    case 'DOWNTIME_SOURCES_REFRESHED':
      return { kind: 'downtime-type-list', status: event.hasItems ? 'ready' : 'empty' };
    case 'BREAK_TYPES_LOADED':
      return { kind: 'break-type-list' };
    case 'SHOW_FATAL_ERROR':
      return {
        kind: 'message',
        title: 'Сервис временно недоступен',
        message: 'Не удалось выполнить действие. Повторите позже.',
        backTo: { kind: 'workplace' }
      };
    case 'SHOW_DOWNTIME_ERROR':
      return {
        kind: 'message',
        title: 'Сервис временно недоступен',
        message: 'Не удалось подтвердить результат. Перед повтором обновите данные.',
        backTo: state.kind === 'message' ? state.backTo : state,
        retry: true
      };
    case 'SHOW_DOWNTIME_VALIDATION_ERROR':
      return {
        kind: 'message',
        title: 'Проверьте данные',
        message: event.message,
        backTo: state.kind === 'message' ? state.backTo : state
      };
    case 'SHOW_ADDITIONAL_WORK_ERROR':
      return {
        kind: 'message',
        title: 'Сервис временно недоступен',
        message: 'Не удалось подтвердить результат. Перед повтором обновите данные.',
        backTo: state.kind === 'message' ? state.backTo : state,
        retry: true
      };
    case 'SHOW_ADDITIONAL_WORK_VALIDATION_ERROR':
      return {
        kind: 'message',
        title: 'Проверьте данные',
        message: event.message,
        backTo: state.kind === 'message' ? state.backTo : state
      };
  }

  switch (state.kind) {
    case 'workplace':
      if (event.type === 'OPEN_START_PRODUCTION') {
        return { kind: 'machine-entry' };
      }

      if (event.type === 'OPEN_FINISH_PRODUCTION') {
        if (!event.productionOperationId) {
          return {
            kind: 'message',
            title: 'Производство не найдено',
            message:
              'Система не вернула активную производственную операцию. Обновите рабочее место и повторите действие.',
            backTo: { kind: 'workplace' }
          };
        }

        if (event.canFinishProduction === false) {
          return {
            kind: 'message',
            title: 'Завершение недоступно',
            message:
              'Система сейчас не разрешает завершить производство. Проверьте активный простой или другое блокирующее состояние.',
            backTo: { kind: 'workplace' }
          };
        }

        return {
          kind: 'quantity-entry',
          productionOperationId: event.productionOperationId,
          machineName: event.machineName,
          skuCode: event.skuCode,
          skuName: event.skuName
        };
      }

      if (event.type === 'OPEN_FINISH_BREAK') {
        return { kind: 'confirm-finish-break' };
      }

      if (event.type === 'OPEN_START_DOWNTIME') {
        return { kind: 'downtime-type-list', status: 'loading' };
      }

      if (event.type === 'OPEN_FINISH_DOWNTIME') {
        if (
          !event.downtimeId ||
          !event.downtimeTypeName ||
          (event.downtimeClass !== 'OPERATIONAL' && event.downtimeClass !== 'CRITICAL')
        ) {
          return {
            kind: 'message',
            title: 'Простой не найден',
            message: 'Система не вернула активный простой. Обновите рабочее место и повторите действие.',
            backTo: { kind: 'workplace' }
          };
        }

        return {
          kind: 'confirm-finish-downtime',
          downtimeId: event.downtimeId,
          downtimeTypeName: event.downtimeTypeName,
          downtimeClass: event.downtimeClass
        };
      }

      if (event.type === 'OPEN_ADDITIONAL_WORK') {
        return { kind: 'additional-work-menu', status: 'loading' };
      }

      return state;

    case 'machine-entry':
      if (event.type === 'OPEN_QR_PLACEHOLDER') {
        return {
          kind: 'message',
          title: 'QR-сканирование',
          message: 'QR-сканирование будет подключено отдельным pipeline. Сейчас выберите станок из списка.',
          backTo: { kind: 'machine-entry' }
        };
      }

      if (event.type === 'BACK') {
        return { kind: 'workplace' };
      }

      return state;

    case 'machine-list':
      if (event.type === 'BACK') {
        return { kind: 'machine-entry' };
      }

      return state;

    case 'sku-list':
      if (event.type === 'BACK') {
        return { kind: 'machine-list' };
      }

      return state;

    case 'quantity-entry':
      if (event.type === 'FINISH_PRODUCTION_REJECTED') {
        return {
          kind: 'message',
          title: 'Количество не принято',
          message:
            'Backend не принял введённое количество. Проверьте значение и повторите ввод. Если ошибка повторится, нужен отчёт backend.',
          backTo: {
            kind: 'quantity-entry',
            productionOperationId: state.productionOperationId,
            machineName: event.machineName,
            skuCode: event.skuCode,
            skuName: event.skuName
          }
        };
      }

      if (event.type === 'BACK') {
        return { kind: 'workplace' };
      }

      return state;

    case 'break-type-list':
      if (event.type === 'BACK') {
        return { kind: 'workplace' };
      }

      return state;

    case 'confirm-finish-break':
      if (event.type === 'BACK') {
        return { kind: 'workplace' };
      }

      return state;

    case 'downtime-type-list':
      if (event.type === 'DOWNTIME_TYPES_LOADED') {
        return { kind: 'downtime-type-list', status: event.hasItems ? 'ready' : 'empty' };
      }

      if (event.type === 'OPEN_CRITICAL_DOWNTIME_WITH_OPERATION') {
        return { kind: 'downtime-comment', context: event.context, comment: '' };
      }

      if (event.type === 'OPEN_CRITICAL_DOWNTIME_WITHOUT_OPERATION') {
        return {
          kind: 'downtime-machine-list',
          status: 'loading',
          downtimeType: event.downtimeType
        };
      }

      if (event.type === 'BACK') {
        return { kind: 'workplace' };
      }

      return state;

    case 'downtime-machine-list':
      if (event.type === 'DOWNTIME_MACHINES_LOADED') {
        return {
          ...state,
          status: event.hasItems ? 'ready' : 'empty'
        };
      }

      if (event.type === 'DOWNTIME_MACHINE_SELECTED') {
        return { kind: 'downtime-comment', context: event.context, comment: '' };
      }

      if (event.type === 'BACK') {
        return { kind: 'downtime-type-list', status: 'ready' };
      }

      return state;

    case 'downtime-comment':
      if (event.type === 'DOWNTIME_COMMENT_ENTERED' && event.comment.trim().length > 0) {
        return { kind: 'downtime-confirm', context: state.context, comment: event.comment };
      }

      if (event.type === 'BACK') {
        return state.context.returnTo === 'downtime-machine-list'
          ? { kind: 'downtime-machine-list', status: 'ready', downtimeType: state.context.downtimeType }
          : { kind: 'downtime-type-list', status: 'ready' };
      }

      return state;

    case 'downtime-confirm':
      if (event.type === 'CRITICAL_DOWNTIME_STARTED') {
        return { kind: 'downtime-result', machineName: event.machineName };
      }

      if (event.type === 'BACK') {
        return { kind: 'downtime-comment', context: state.context, comment: state.comment };
      }

      return state;

    case 'downtime-result':
      return state;

    case 'confirm-finish-downtime':
      if (event.type === 'BACK') {
        return { kind: 'workplace' };
      }

      return state;

    case 'additional-work-menu':
      if (
        event.type === 'ADDITIONAL_WORK_MENU_LOADED' ||
        event.type === 'ADDITIONAL_WORK_MENU_REFRESHED'
      ) {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      if (event.type === 'OPEN_REQUEST_ADDITIONAL_WORK') {
        return { kind: 'additional-work-type-list', status: 'loading' };
      }

      if (event.type === 'ADDITIONAL_WORK_APPROVED_SELECTED') {
        return { kind: 'additional-work-start-confirm', additionalWork: event.additionalWork };
      }

      if (event.type === 'ADDITIONAL_WORK_ACTIVE_SELECTED') {
        return { kind: 'additional-work-finish-confirm', additionalWork: event.additionalWork };
      }

      if (event.type === 'BACK') {
        return { kind: 'workplace' };
      }

      return state;

    case 'additional-work-type-list':
      if (
        event.type === 'ADDITIONAL_WORK_TYPES_LOADED' ||
        event.type === 'ADDITIONAL_WORK_TYPES_REFRESHED'
      ) {
        return {
          kind: 'additional-work-type-list',
          status: event.hasItems ? 'ready' : 'empty'
        };
      }

      if (event.type === 'ADDITIONAL_WORK_TYPE_SELECTED') {
        return {
          kind: 'additional-work-request-confirm',
          additionalWorkType: event.additionalWorkType
        };
      }

      if (event.type === 'BACK') {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      return state;

    case 'additional-work-request-confirm':
      if (event.type === 'ADDITIONAL_WORK_MENU_REFRESHED') {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      if (event.type === 'ADDITIONAL_WORK_TYPES_REFRESHED') {
        return {
          kind: 'additional-work-type-list',
          status: event.hasItems ? 'ready' : 'empty'
        };
      }

      if (event.type === 'ADDITIONAL_WORK_REQUESTED') {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      if (event.type === 'BACK') {
        return { kind: 'additional-work-type-list', status: 'ready' };
      }

      return state;

    case 'additional-work-start-confirm':
      if (event.type === 'ADDITIONAL_WORK_MENU_REFRESHED') {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      if (event.type === 'ADDITIONAL_WORK_STARTED') {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      if (event.type === 'BACK') {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      return state;

    case 'additional-work-finish-confirm':
      if (event.type === 'ADDITIONAL_WORK_MENU_REFRESHED') {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      if (event.type === 'ADDITIONAL_WORK_FINISHED') {
        return { kind: 'additional-work-result', additionalWork: state.additionalWork };
      }

      if (event.type === 'BACK') {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      return state;

    case 'additional-work-result':
      if (event.type === 'ADDITIONAL_WORK_MENU_REFRESHED') {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      if (event.type === 'ADDITIONAL_WORK_RESULT_CLOSED') {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      return state;

    case 'message':
      if (
        event.type === 'ADDITIONAL_WORK_MENU_REFRESHED' &&
        isAdditionalWorkState(state.backTo)
      ) {
        return { kind: 'additional-work-menu', status: 'ready' };
      }

      if (
        event.type === 'ADDITIONAL_WORK_TYPES_REFRESHED' &&
        isAdditionalWorkState(state.backTo)
      ) {
        return {
          kind: 'additional-work-type-list',
          status: event.hasItems ? 'ready' : 'empty'
        };
      }

      if (event.type === 'BACK') {
        return state.backTo;
      }

      return state;
  }
}

function isAdditionalWorkState(state: Section02PipelineReturnState): boolean {
  return state.kind.startsWith('additional-work-');
}

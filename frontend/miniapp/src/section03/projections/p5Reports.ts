import type {
  PresentationFormDraftController,
  PresentationGraphBridgeItemInput,
} from '../../foundation/presentation';
import { formatDisplayDate } from '../../foundation/presentation';
import type { PresentationGraphCardLineInput } from '../../foundation/presentation/graphBridge/model';
import type { ManagerWorkplaceState } from '../contracts';
import { decodeSection03ExportRunResponse } from '../contracts';
import type { Section03NodeId } from '../program';
import type { Section03Context } from '../program/context';
import {
  resolveSection03ExplicitReportRange,
  resolveSection03PredefinedReportRange,
} from '../program/reportDates';
import {
  defineSection03ScreenProjection,
  SECTION03_POLICY_ROOTS,
  section03Authority,
  type Section03ScreenProjection,
} from '../presentation';
import {
  actionButton,
  backButton,
  factory,
  interaction,
  message,
  nodeData,
  text,
  type P1NodeInput,
} from './common';

export const SECTION03_P5_SPECIALIZED_NODE_IDS = Object.freeze([
  'S03-R01',
  'S03-R10',
  'S03-R11',
  'S03-R12',
  'S03-R13',
  'S03-R14',
] as const satisfies readonly Section03NodeId[]);

export type Section03P5SpecializedNodeId = typeof SECTION03_P5_SPECIALIZED_NODE_IDS[number];

export class Section03P5ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Section03P5ProjectionError';
  }
}

function screen(
  nodeId: Section03P5SpecializedNodeId,
  ariaLabel: string,
  scroll: readonly PresentationGraphBridgeItemInput[],
  bottom: readonly PresentationGraphBridgeItemInput[],
  fixedTopTitle?: string,
): Section03ScreenProjection {
  return defineSection03ScreenProjection({
    nodeId,
    ariaLabel,
    ...(fixedTopTitle === undefined ? {} : { fixedTopTitle }),
    bridgeProjection: { nodeId, items: [...scroll, ...bottom] },
    slots: {
      fixedTop: [],
      scroll: scroll.map((item) => item.id),
      fixedBottom: bottom.map((item) => item.id),
    },
  });
}

function navigation(
  input: P1NodeInput,
  id: string,
  label: string,
   actionId: string,
  event: Section03Context,
  enabled = true,
): PresentationGraphBridgeItemInput {
  return actionButton({
    id,
    action: factory(input).presentation(
      actionId,
      { instanceId: id, ariaLabel: label },
      event,
    ),
    enabled,
    label,
    ariaLabel: label,
  });
}

function projectMenu(input: P1NodeInput<'S03-R01'>): Section03ScreenProjection {
  const open = navigation(input, 'reports-google-sheets', 'Выгрузка в Google Таблицы', 'navigate0', {});
  const back = backButton(input, 'navigateBack0', {}, 'reports-menu-back');
  return screen('S03-R01', 'Отчёты', [open], [back], 'Отчёты');
}

const periodControls = Object.freeze([
  Object.freeze({ period: 'today' as const, id: 'reports-period-today', label: 'За сегодня' }),
  Object.freeze({ period: 'week' as const, id: 'reports-period-week', label: 'За неделю' }),
  Object.freeze({ period: 'month' as const, id: 'reports-period-month', label: 'За месяц' }),
  Object.freeze({ period: 'last_30_days' as const, id: 'reports-period-last-30-days', label: 'Последние 30 дней' }),
]);

function projectPeriods(input: P1NodeInput<'S03-R10'>): Section03ScreenProjection {
  const nowEpochMs = Date.now();
  const predefined = periodControls.map(({ period, id, label }) => navigation(
    input,
    id,
    label,
    'navigate1',
    resolveSection03PredefinedReportRange(period, nowEpochMs),
  ));
  const custom = navigation(input, 'reports-period-custom', 'Выбрать период вручную', 'navigate0', {});
  const back = backButton(input, 'navigateBack0', {}, 'reports-period-back');
  return screen('S03-R10', 'Выберите период выгрузки', [...predefined, custom], [back], 'Выберите период выгрузки');
}

function requiredController(
  input: P1NodeInput<'S03-R11'> | P1NodeInput<'S03-R12'>,
  fieldId: 'from_date' | 'to_date',
): PresentationFormDraftController {
  const controller = input.formController;
  if (controller === undefined || controller.fieldIds.length !== 1 || controller.fieldIds[0] !== fieldId) {
    throw new Section03P5ProjectionError(`Missing ${fieldId} form controller for ${input.nodeId}.`);
  }
  return controller;
}

function fieldItem(controller: PresentationFormDraftController, fieldId: 'from_date' | 'to_date'): PresentationGraphBridgeItemInput {
  return Object.freeze({ kind: 'form-field' as const, id: `field-${fieldId}`, controller, fieldId });
}

function committedDate(controller: PresentationFormDraftController, fieldId: 'from_date' | 'to_date'): string | null {
  const field = controller.field(fieldId);
  if (field.pending || !controller.valid) return null;
  try {
    const value = controller.commit()[fieldId];
    if (typeof value !== 'string') return null;
    resolveSection03ExplicitReportRange(value, value);
    return value;
  } catch {
    return null;
  }
}

function projectStartDate(input: P1NodeInput<'S03-R11'>): Section03ScreenProjection {
  const controller = requiredController(input, 'from_date');
  const fromDate = committedDate(controller, 'from_date');
  const field = fieldItem(controller, 'from_date');
  const next = navigation(
    input,
    'reports-start-date-next',
    'Далее',
    'navigate0',
    fromDate === null ? {} : { from_date: fromDate },
    fromDate !== null,
  );
  const back = backButton(input, 'navigateBack0', {}, 'reports-start-date-back');
  return screen('S03-R11', 'Дата начала', [field], [next, back], 'Дата начала');
}

function projectEndDate(input: P1NodeInput<'S03-R12'>): Section03ScreenProjection {
  const current = nodeData(input).context;
  if (current.from_date === undefined) throw new Section03P5ProjectionError('Missing R12 from_date.');
  const from = resolveSection03ExplicitReportRange(current.from_date, current.from_date).from_date;
  const controller = requiredController(input, 'to_date');
  const committed = committedDate(controller, 'to_date');
  let range: Readonly<{ from_date: string; to_date: string }> | null = null;
  if (committed !== null) {
    try {
      range = resolveSection03ExplicitReportRange(from, committed);
    } catch {
      range = null;
    }
  }
  const field = fieldItem(controller, 'to_date');
  const next = navigation(input, 'reports-end-date-next', 'Далее', 'navigate0', range ?? { from_date: from }, range !== null);
  const back = backButton(input, 'navigateBack0', { from_date: from }, 'reports-end-date-back');
  return screen('S03-R12', 'Дата окончания', [field], [next, back], 'Дата окончания');
}

function contentOnly(id: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, content: text(value) });
}

function labeled(id: string, label: string, value: string): PresentationGraphCardLineInput {
  return Object.freeze({ id, label: text(label), value: text(value) });
}

function projectConfirmation(input: P1NodeInput<'S03-R13'>): Section03ScreenProjection {
  const loaded = nodeData(input);
  const current = loaded.context;
  if (current.from_date === undefined || current.to_date === undefined) {
    throw new Section03P5ProjectionError('R13 explicit range is missing.');
  }
  const range = resolveSection03ExplicitReportRange(current.from_date, current.to_date);
  const back = backButton(
    input,
    current.period === undefined ? 'navigateBack1' : 'navigateBack0',
    current.period === undefined ? range : {},
    'reports-export-confirm-back',
  );
  const workplace = loaded.data.primary as unknown as ManagerWorkplaceState | null;
  if (workplace === null) throw new Section03P5ProjectionError('R13 fresh workplace is missing.');
  if (!loaded.data.availableActions.includes('OPEN_REPORTS')) {
    return screen('S03-R13', 'Подтверждение выгрузки', [
      message('reports-export-authority-denied', 'Недостаточно прав для создания выгрузки.', SECTION03_POLICY_ROOTS.staticInfoMessage),
    ], [back]);
  }
  const lines = Object.freeze([
    contentOnly('reports-export-prompt', 'Подтвердите выгрузку:'),
    labeled('reports-export-type', 'Тип', 'Выгрузка в Google Таблицы'),
    labeled('reports-export-period', 'Период', `${formatDisplayDate(range.from_date)} — ${formatDisplayDate(range.to_date)}`),
    contentOnly('reports-export-content', 'Состав выгрузки:\nЗарплата свод\nЗарплата детали\nДоп. работы\nСтанки свод\nСтанки детали'),
  ]);
  const confirmation: PresentationGraphBridgeItemInput = Object.freeze({
    kind: 'card' as const,
    id: 'reports-export-confirmation',
    presentationAuthority: section03Authority(SECTION03_POLICY_ROOTS.staticInfoCard, null),
    lines,
    ariaLabel: 'Подтверждение выгрузки',
  });
  const actions = factory(input).business('CREATE_GOOGLE_SHEETS_EXPORT', {
    instanceId: 'reports-export-create', ariaLabel: 'Создать выгрузку',
  }, range);
  if (actions.length !== 1) throw new Section03P5ProjectionError('Runtime denied CREATE_GOOGLE_SHEETS_EXPORT.');
  const confirm: PresentationGraphBridgeItemInput = actionButton({
    id: 'reports-export-create',
     action: actions[0]!,
    label: 'Создать выгрузку',
    ariaLabel: 'Создать выгрузку',
  });
  return screen('S03-R13', 'Подтверждение выгрузки', [confirmation], [confirm, back]);
}

function projectSuccess(input: P1NodeInput<'S03-R14'>): Section03ScreenProjection {
  const current = nodeData(input).context;
  const response = decodeSection03ExportRunResponse({ export_run_id: current.export_run_id });
  const success = message(
    'reports-export-created',
    `Заявка на выгрузку создана.\nExport run: ${response.export_run_id}\nДанные будут сформированы в Google Таблицах после выполнения backend export worker.`,
    SECTION03_POLICY_ROOTS.staticPositiveMessage,
  );
  const home = navigation(input, 'reports-export-home', 'На главный экран', 'navigate0', {});
  return screen('S03-R14', 'Выгрузка создана', [success], [home]);
}

export function projectSection03P5(
  input: P1NodeInput<Section03P5SpecializedNodeId>,
): Section03ScreenProjection {
  switch (input.nodeId) {
    case 'S03-R01': return projectMenu(input as P1NodeInput<'S03-R01'>);
    case 'S03-R10': return projectPeriods(input as P1NodeInput<'S03-R10'>);
    case 'S03-R11': return projectStartDate(input as P1NodeInput<'S03-R11'>);
    case 'S03-R12': return projectEndDate(input as P1NodeInput<'S03-R12'>);
    case 'S03-R13': return projectConfirmation(input as P1NodeInput<'S03-R13'>);
    case 'S03-R14': return projectSuccess(input as P1NodeInput<'S03-R14'>);
  }
}

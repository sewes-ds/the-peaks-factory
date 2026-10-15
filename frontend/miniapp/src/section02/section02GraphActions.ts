import type { PeaksActionButtonSize, PeaksActionButtonVariant } from '../foundation/graphRenderer';

export type S02ActionId =
  | 'start_shift'
  | 'start_production'
  | 'finish_production'
  | 'scan_machine_qr'
  | 'select_machine_from_list'
  | 'select_machine'
  | 'scan_sku_qr'
  | 'select_sku_from_list'
  | 'select_sku'
  | 'start_break'
  | 'finish_break'
  | 'start_downtime'
  | 'finish_downtime_operational'
  | 'finish_downtime_critical'
  | 'additional_work'
  | 'select_additional_work_type'
  | 'request_additional_work'
  | 'start_additional_work'
  | 'finish_additional_work'
  | 'finish_shift'
  | 'salary'
  | 'back';

export type S02ActionDefinition = {
  actionId: S02ActionId;
  label: string;
  icon: string;
  variant: PeaksActionButtonVariant;
  size?: PeaksActionButtonSize;
};

export const S02_ACTION_REGISTRY: Record<S02ActionId, S02ActionDefinition> = {
  start_shift: {
    actionId: 'start_shift',
    label: 'Начать смену',
    icon: 'start_shift.svg',
    variant: 'primaryBlue'
  },
  start_production: {
    actionId: 'start_production',
    label: 'Начать производство',
    icon: 'start_production.svg',
    variant: 'primaryBlue'
  },
  finish_production: {
    actionId: 'finish_production',
    label: 'Завершить производство',
    icon: 'finish_production.svg',
    variant: 'green'
  },
  scan_machine_qr: {
    actionId: 'scan_machine_qr',
    label: 'Сканировать QR станка',
    icon: 'scan_qr.svg',
    variant: 'primaryBlue'
  },
  select_machine_from_list: {
    actionId: 'select_machine_from_list',
    label: 'Выбрать станок из списка',
    icon: 'select_machine_from_list.svg',
    variant: 'lightBlue'
  },
  select_machine: {
    actionId: 'select_machine',
    label: 'Выбрать станок',
    icon: 'select_machine_from_list.svg',
    variant: 'lightBlue'
  },
  scan_sku_qr: {
    actionId: 'scan_sku_qr',
    label: 'Сканировать QR SKU',
    icon: 'scan_qr.svg',
    variant: 'primaryBlue'
  },
  select_sku_from_list: {
    actionId: 'select_sku_from_list',
    label: 'Выбрать SKU из списка',
    icon: 'select_sku_from_list.svg',
    variant: 'lightBlue'
  },
  select_sku: {
    actionId: 'select_sku',
    label: 'Выбрать SKU',
    icon: 'select_sku_from_list.svg',
    variant: 'lightBlue'
  },
  start_break: {
    actionId: 'start_break',
    label: 'Начать перерыв',
    icon: 'start_break.svg',
    variant: 'lightBlue'
  },
  finish_break: {
    actionId: 'finish_break',
    label: 'Завершить перерыв',
    icon: 'finish_break.svg',
    variant: 'yellow'
  },
  start_downtime: {
    actionId: 'start_downtime',
    label: 'Начать простой',
    icon: 'start_downtime.svg',
    variant: 'lightBlue'
  },
  finish_downtime_operational: {
    actionId: 'finish_downtime_operational',
    label: 'Завершить простой',
    icon: 'finish_downtime.svg',
    variant: 'yellow'
  },
  finish_downtime_critical: {
    actionId: 'finish_downtime_critical',
    label: 'Завершить простой',
    icon: 'finish_downtime.svg',
    variant: 'red'
  },
  additional_work: {
    actionId: 'additional_work',
    label: 'Допработа',
    icon: 'additional_work.svg',
    variant: 'gray'
  },
  select_additional_work_type: {
    actionId: 'select_additional_work_type',
    label: 'Выбрать допработу',
    icon: 'additional_work.svg',
    variant: 'gray'
  },
  request_additional_work: {
    actionId: 'request_additional_work',
    label: 'Запросить допработу',
    icon: 'additional_work.svg',
    variant: 'gray'
  },
  start_additional_work: {
    actionId: 'start_additional_work',
    label: 'Начать допработу',
    icon: 'additional_work.svg',
    variant: 'gray'
  },
  finish_additional_work: {
    actionId: 'finish_additional_work',
    label: 'Завершить допработу',
    icon: 'additional_work.svg',
    variant: 'green'
  },
  finish_shift: {
    actionId: 'finish_shift',
    label: 'Завершить смену',
    icon: 'finish_shift.svg',
    variant: 'green'
  },
  salary: {
    actionId: 'salary',
    label: 'Зарплата',
    icon: 'salary.svg',
    variant: 'outlineBlue',
    size: 'salary55'
  },
  back: {
    actionId: 'back',
    label: 'Назад',
    icon: 'back.svg',
    variant: 'outlineBlue',
    size: 'fixed55'
  }
};

export function getS02ActionDefinition(actionId: S02ActionId): S02ActionDefinition {
  return S02_ACTION_REGISTRY[actionId];
}

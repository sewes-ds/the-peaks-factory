import { PeaksGraphNodeRenderer, type PeaksGraphObject } from '../../foundation/graphRenderer';
import { getS02ActionDefinition } from '../../section02/section02GraphActions';
import type { OperatorWorkplaceStateResponse } from '../../section02/operatorWorkplace';

export type Section02OperatorWorkplaceActiveProps = {
  workplaceState: OperatorWorkplaceStateResponse;
  onStartProduction?: () => void;
  onFinishProduction?: () => void;
  onStartBreak?: () => void;
  onFinishBreak?: () => void;
  onStartDowntime?: () => void;
  onFinishDowntime?: () => void;
  onOpenAdditionalWork?: () => void;
  onFinishShift?: () => void;
  onOpenSalary?: () => void;
};

export function Section02OperatorWorkplaceActive({
  workplaceState,
  onStartProduction,
  onFinishProduction,
  onStartBreak,
  onFinishBreak,
  onStartDowntime,
  onFinishDowntime,
  onOpenAdditionalWork,
  onFinishShift,
  onOpenSalary
}: Section02OperatorWorkplaceActiveProps) {
  const production = workplaceState.production;
  const breakState = workplaceState.break;
  const downtime = workplaceState.downtime;
  const canStartDowntime =
    workplaceState.available_pipelines?.includes('START_DOWNTIME') === true &&
    downtime?.can_start_downtime === true;
  const canOpenAdditionalWork =
    workplaceState.available_pipelines?.includes('OPEN_ADDITIONAL_WORK') === true;
  const activeDowntimeClass =
    downtime?.downtime_class === 'OPERATIONAL' || downtime?.downtime_class === 'CRITICAL'
      ? downtime.downtime_class
      : null;
  const productionIsActive = Boolean(production?.is_active || production?.production_operation_id);
  const breakIsActive = Boolean(breakState?.is_active || breakState?.operator_break_id);

  const fixedTopObjects: PeaksGraphObject[] = productionIsActive
    ? [
        {
          kind: 'productionOperationCard',
          id: 'active-production-info',
          tone: 'green',
          lines: [
            { label: 'Оператор', value: readString(workplaceState, ['actor_employee_id', 'employee_id']) || '—' },
            { label: 'Станок', value: production?.machine_name || '—' },
            { label: 'SKU', value: production?.sku_name || production?.sku_code || '—' }
          ]
        }
      ]
    : [];

  const scrollObjects: PeaksGraphObject[] = [];

  if (productionIsActive) {
    scrollObjects.push(actionObject('finish_production', { onClick: onFinishProduction }));
  } else {
    scrollObjects.push(actionObject('start_production', { onClick: onStartProduction }));
  }

  if (breakIsActive) {
    scrollObjects.push(actionObject('finish_break', { onClick: onFinishBreak }));
  } else {
    scrollObjects.push(actionObject('start_break', { onClick: onStartBreak }));
  }

  if (downtime?.can_finish_downtime === true && activeDowntimeClass) {
    const isCritical = activeDowntimeClass === 'CRITICAL';
    scrollObjects.push(
      actionObject(isCritical ? 'finish_downtime_critical' : 'finish_downtime_operational', {
        label: downtime.downtime_type_name ? `Завершить: ${downtime.downtime_type_name}` : undefined,
        onClick: onFinishDowntime
      })
    );
  } else if (downtime?.can_finish_downtime !== true && canStartDowntime) {
    scrollObjects.push(actionObject('start_downtime', { onClick: onStartDowntime }));
  }

  if (canOpenAdditionalWork) {
    scrollObjects.push(actionObject('additional_work', { onClick: onOpenAdditionalWork }));
  }
  scrollObjects.push(actionObject('finish_shift', { onClick: onFinishShift }));
  scrollObjects.push(actionObject('salary', { onClick: onOpenSalary }));

  return (
    <PeaksGraphNodeRenderer
      view={{
        nodeId: 'S02-N02_OPERATOR_WORKPLACE',
        ariaLabel: 'Рабочее место оператора',
        fixedTopObjects,
        scrollObjects
      }}
    />
  );
}

function actionObject(
  actionId: Parameters<typeof getS02ActionDefinition>[0],
  overrides: Partial<Extract<PeaksGraphObject, { kind: 'actionButton' }>> = {}
): PeaksGraphObject {
  const action = getS02ActionDefinition(actionId);

  return {
    kind: 'actionButton',
    actionId: action.actionId,
    icon: action.icon,
    label: overrides.label ?? action.label,
    size: overrides.size ?? action.size,
    variant: overrides.variant ?? action.variant,
    disabled: overrides.disabled,
    onClick: overrides.onClick
  };
}

function readString(source: unknown, keys: string[]): string | null {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return null;
  }

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }
  }

  return null;
}

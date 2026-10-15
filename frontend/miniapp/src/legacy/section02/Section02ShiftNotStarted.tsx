import { PeaksGraphNodeRenderer } from '../../foundation/graphRenderer';
import { getS02ActionDefinition } from '../../section02/section02GraphActions';

export type Section02ShiftNotStartedProps = {
  onStartShift: () => void;
  startShiftPending?: boolean;
  onOpenSalary?: () => void;
};

export function Section02ShiftNotStarted({
  onStartShift,
  startShiftPending = false,
  onOpenSalary
}: Section02ShiftNotStartedProps) {
  const startShift = getS02ActionDefinition('start_shift');
  const salary = getS02ActionDefinition('salary');

  return (
    <PeaksGraphNodeRenderer
      view={{
        nodeId: 'S02-N01',
        ariaLabel: 'Смена не начата',
        scrollObjects: [
          {
            kind: 'actionButton',
            actionId: startShift.actionId,
            icon: startShift.icon,
            label: startShift.label,
            variant: startShift.variant,
            disabled: startShiftPending,
            onClick: onStartShift
          },
          {
            kind: 'actionButton',
            actionId: salary.actionId,
            icon: salary.icon,
            label: salary.label,
            size: salary.size,
            variant: salary.variant,
            onClick: onOpenSalary
          }
        ]
      }}
    />
  );
}

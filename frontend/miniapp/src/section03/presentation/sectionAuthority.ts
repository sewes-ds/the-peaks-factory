import type {
  ControlSemanticKey,
  ControlSurface,
  PresentationGraphAuthorityRequest,
} from '../../foundation/presentation';
import type {
  ManagerAdditionalWorkItem,
  ManagerEmployee,
  ManagerMachine,
  ManagerOpenTaskItem,
} from '../contracts';
import type { Section03BackendPresentationTuple } from '../generated/managerPresentationContract';
import {
  SECTION03_POLICY_ROOTS,
  SECTION03_PRESENTATION_POLICY,
} from './sectionPolicy';

export function section03Authority(
  rootId: string,
  evidence: unknown,
): PresentationGraphAuthorityRequest {
  return Object.freeze({
    policy: SECTION03_PRESENTATION_POLICY,
    rootId,
    evidence,
  });
}

export function section03ActionAuthority(
  actionRole: ControlSemanticKey,
  surface: ControlSurface,
): PresentationGraphAuthorityRequest {
  const rootId = SECTION03_POLICY_ROOTS.action[`${actionRole}:${surface}`];
  if (rootId === undefined) {
    throw new Error(`Unsupported Section 03 action authority ${actionRole}:${surface}.`);
  }
  return section03Authority(rootId, null);
}

export function section03MachineTuple(
  machine: Pick<ManagerMachine, 'ui_state' | 'ui_variant'>,
): Section03BackendPresentationTuple {
  return Object.freeze({
    family: 'machine',
    tuple: Object.freeze({
      ui_state: machine.ui_state,
      ui_variant: machine.ui_variant,
    }),
  });
}

export function section03EmployeeTuple(
  employee: Pick<ManagerEmployee, 'ui_state' | 'ui_variant'>,
): Section03BackendPresentationTuple {
  return Object.freeze({
    family: 'employee',
    tuple: Object.freeze({
      ui_state: employee.ui_state,
      ui_variant: employee.ui_variant,
    }),
  });
}

export function section03AdditionalWorkTuple(
  work: Pick<ManagerAdditionalWorkItem, 'status' | 'ui_variant'>,
): Section03BackendPresentationTuple {
  return Object.freeze({
    family: 'additional_work',
    tuple: Object.freeze({
      status: work.status,
      ui_variant: work.ui_variant,
    }),
  });
}

export function section03NotificationTuple(
  task: Pick<ManagerOpenTaskItem, 'task_kind' | 'ui_color_token' | 'ui_variant'>,
): Section03BackendPresentationTuple {
  return Object.freeze({
    family: 'notification',
    tuple: Object.freeze({
      task_kind: task.task_kind,
      ui_color_token: task.ui_color_token,
      ui_variant: task.ui_variant,
    }),
  });
}

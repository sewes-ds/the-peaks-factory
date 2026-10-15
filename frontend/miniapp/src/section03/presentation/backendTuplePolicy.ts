import type { PlatformPresentationResolution } from '../../foundation/presentation';
import {
  type Section03BackendPresentationFamily,
  type Section03BackendPresentationTuple,
} from '../generated/managerPresentationContract';
import {
  SECTION03_POLICY_ROOTS,
  SECTION03_PRESENTATION_POLICY,
  resolveSection03Presentation,
} from './sectionPolicy';

const rootByFamily = Object.freeze({
  machine: SECTION03_POLICY_ROOTS.backendMachineList,
  employee: SECTION03_POLICY_ROOTS.backendEmployeeList,
  additional_work: SECTION03_POLICY_ROOTS.backendAdditionalWorkList,
  notification: SECTION03_POLICY_ROOTS.backendNotificationList,
} as const satisfies Readonly<Record<Section03BackendPresentationFamily, string>>);

/** @deprecated Compatibility export; Section 03 now has one unified policy. */
export const SECTION03_BACKEND_PRESENTATION_POLICY =
  SECTION03_PRESENTATION_POLICY;

export function resolveSection03BackendPresentationTuple(
  input: Section03BackendPresentationTuple,
): PlatformPresentationResolution {
  return resolveSection03Presentation({
    rootId: rootByFamily[input.family],
    evidence: input,
    interaction: { kind: 'inert' },
    availability: 'inert',
  });
}

import {
  definePlatformStateBinding,
  failPlatformExternalContract,
  type PlatformStateBinding,
} from '../../foundation/presentation';
import {
  Section03GeneratedContractError,
  decodeSection03BackendPresentationTuple,
  type Section03BackendPresentationFamily,
  type Section03BackendPresentationTuple,
} from '../generated/managerPresentationContract';

export function resolveSection03BackendStateBinding(
  expectedFamily: Section03BackendPresentationFamily,
  evidence: unknown,
): PlatformStateBinding {
  let decoded: Section03BackendPresentationTuple;
  try {
    decoded = decodeSection03BackendPresentationTuple(evidence);
  } catch (error: unknown) {
    if (error instanceof Section03GeneratedContractError) {
      return failPlatformExternalContract(error.code);
    }
    throw error;
  }
  if (decoded.family !== expectedFamily) {
    return failPlatformExternalContract(
      'SECTION03_BACKEND_PRESENTATION_FAMILY_MISMATCH',
    );
  }
  const variant = decoded.tuple.ui_variant;
  if (
    expectedFamily === 'additional_work' &&
    decoded.family === 'additional_work' &&
    decoded.tuple.status === 'approved' &&
    variant === 'grey'
  ) {
    return definePlatformStateBinding('state-positive-neutral-context');
  }
  switch (variant) {
    case 'light_blue':
    case 'white':
      return definePlatformStateBinding('state-info');
    case 'green':
      return definePlatformStateBinding('state-positive');
    case 'yellow':
      return definePlatformStateBinding('state-warning');
    case 'red':
      return definePlatformStateBinding('state-danger');
    case 'grey':
      return definePlatformStateBinding(
        expectedFamily === 'additional_work' || expectedFamily === 'notification'
          ? 'state-neutral'
          : 'state-info',
      );
    default:
      return failPlatformExternalContract(
        'SECTION03_BACKEND_PRESENTATION_VARIANT_UNSUPPORTED',
      );
  }
}

import type { ControlFeedbackRequest } from './control';
import { resolveControlFeedback } from './control';

const request: ControlFeedbackRequest = {
  availability: 'enabled',
  preserveToneWhenDisabled: false,
};
const result = resolveControlFeedback(request);

// @ts-expect-error availability is closed
const invalidAvailability: ControlFeedbackRequest['availability'] = 'loading';
const invalidPreservation: ControlFeedbackRequest = {
  availability: 'disabled',
  // @ts-expect-error preservation is boolean
  preserveToneWhenDisabled: 'true',
};
// @ts-expect-error output is readonly
result.interactive = false;

void invalidAvailability;
void invalidPreservation;

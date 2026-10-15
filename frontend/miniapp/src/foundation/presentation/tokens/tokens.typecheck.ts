import {
  PEAKS_COLOR_TOKENS,
  PEAKS_FEEDBACK_TOKENS,
  type PeaksCssVariableReference,
} from './index';

const validReference: PeaksCssVariableReference = PEAKS_COLOR_TOKENS.brand.blue;
const feedbackReference: PeaksCssVariableReference =
  PEAKS_FEEDBACK_TOKENS.disabledOpacity;

// @ts-expect-error physical colors cannot be TypeScript token references
const invalidPhysical: PeaksCssVariableReference = '#0861BB';
// @ts-expect-error arbitrary CSS variables are outside the PEAKS registry namespace
const invalidVariable: PeaksCssVariableReference = 'var(--other-color)';

void validReference;
void feedbackReference;
void invalidPhysical;
void invalidVariable;

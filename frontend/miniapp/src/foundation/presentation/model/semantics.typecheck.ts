import type {
  PresentationAvailability,
  PresentationEmphasis,
  PresentationFillMode,
  PresentationIntent,
  PresentationSurface,
  PresentationTextTone,
  PresentationTone,
} from './semantics';

const intent: PresentationIntent = 'navigation';
const tone: PresentationTone = 'info';
const surface: PresentationSurface = 'card';
const emphasis: PresentationEmphasis = 'primary';
const availability: PresentationAvailability = 'enabled';
const fillMode: PresentationFillMode = 'solid';
const textTone: PresentationTextTone = 'inverse';

// @ts-expect-error closed presentation intent rejects arbitrary renderer values
const invalidIntent: PresentationIntent = 'primaryBlue';
// @ts-expect-error closed presentation tone rejects arbitrary values
const invalidTone: PresentationTone = 'blue';
// @ts-expect-error closed presentation surface rejects arbitrary values
const invalidSurface: PresentationSurface = 'button';
// @ts-expect-error closed presentation emphasis rejects arbitrary values
const invalidEmphasis: PresentationEmphasis = 'main';
// @ts-expect-error closed availability rejects arbitrary values
const invalidAvailability: PresentationAvailability = 'loading';
// @ts-expect-error closed fill mode rejects arbitrary values
const invalidFillMode: PresentationFillMode = 'filled';
// @ts-expect-error closed text tone rejects arbitrary values
const invalidTextTone: PresentationTextTone = 'gray';

void intent;
void tone;
void surface;
void emphasis;
void availability;
void fillMode;
void textTone;
void invalidIntent;
void invalidTone;
void invalidSurface;
void invalidEmphasis;
void invalidAvailability;
void invalidFillMode;
void invalidTextTone;

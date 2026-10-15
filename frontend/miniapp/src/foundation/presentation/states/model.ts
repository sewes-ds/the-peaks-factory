import type { PresentationPaintToken } from '../palette';
import type { PresentationTone } from '../model';
import type { StatePresentationKey, StatePresentationSurface } from './keys';

export type StateFillMode = 'soft' | 'outline' | 'transparent';

export type StatePresentationTokens = Readonly<{
  background: PresentationPaintToken;
  border: PresentationPaintToken;
  text: Exclude<PresentationPaintToken, 'transparent'>;
  marker: Exclude<PresentationPaintToken, 'transparent'>;
}>;

export type StatePresentation = Readonly<{
  key: StatePresentationKey;
  surface: StatePresentationSurface;
  tone: PresentationTone;
  fillMode: StateFillMode;
  tokens: StatePresentationTokens;
  preserveToneWhenDisabled: true;
}>;

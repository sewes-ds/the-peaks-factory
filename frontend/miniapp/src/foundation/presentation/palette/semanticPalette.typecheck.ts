import { resolvePresentationFillToken, type PresentationPaintToken } from './semanticPalette';
const token: PresentationPaintToken = resolvePresentationFillToken('soft', 'info');
// @ts-expect-error physical values are not presentation tokens
const invalid: PresentationPaintToken = '#0861BB';
void token; void invalid;

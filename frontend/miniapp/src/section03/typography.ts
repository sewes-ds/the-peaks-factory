import {
  createPlatformFontReadinessController,
  type PlatformFontResourceDescriptor,
} from '../foundation/fontReadiness';

export const SECTION03_FONT_FAMILY = 'Peaks Arimo';
export const SECTION03_FONT_SLOW_THRESHOLD_MS = 3_000;
export const SECTION03_FONT_SPECIMEN = 'Станки PEAKS 0123456789';

export const SECTION03_FONT_URLS = Object.freeze([
  new URL('../assets/fonts/arimo-cyrillic-v36.woff2', import.meta.url).href,
  new URL('../assets/fonts/arimo-latin-v36.woff2', import.meta.url).href,
] as const);

const CYRILLIC_UNICODE_RANGE =
  'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';
const LATIN_UNICODE_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, ' +
  'U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, ' +
  'U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

export const SECTION03_TYPOGRAPHY_RESOURCE:
PlatformFontResourceDescriptor = Object.freeze({
  family: SECTION03_FONT_FAMILY,
  requiredFaces: Object.freeze([
    Object.freeze({ style: 'normal' as const, weight: 400 }),
    Object.freeze({ style: 'normal' as const, weight: 700 }),
  ]),
  resourceId: 'SECTION03_ARIMO_LOCAL_V36',
  sources: Object.freeze([
    Object.freeze({
      style: 'normal' as const,
      unicodeRange: CYRILLIC_UNICODE_RANGE,
      url: SECTION03_FONT_URLS[0],
      weightRange: '400 700',
    }),
    Object.freeze({
      style: 'normal' as const,
      unicodeRange: LATIN_UNICODE_RANGE,
      url: SECTION03_FONT_URLS[1],
      weightRange: '400 700',
    }),
  ]),
  specimen: SECTION03_FONT_SPECIMEN,
});

export const SECTION03_FONT_READINESS =
  createPlatformFontReadinessController({
    resource: SECTION03_TYPOGRAPHY_RESOURCE,
    slowThresholdMs: SECTION03_FONT_SLOW_THRESHOLD_MS,
  });

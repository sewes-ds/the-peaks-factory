import { createPlatformFontReadinessController, type PlatformFontResourceDescriptor } from '../foundation/fontReadiness';

export const SECTION02_TYPOGRAPHY_RESOURCE: PlatformFontResourceDescriptor = Object.freeze({
  family: 'Peaks Arimo',
  requiredFaces: Object.freeze([
    Object.freeze({ style: 'normal' as const, weight: 400 }),
    Object.freeze({ style: 'normal' as const, weight: 700 }),
  ]),
  resourceId: 'SECTION02_ARIMO_LOCAL_V36',
  sources: Object.freeze([
    Object.freeze({
      style: 'normal' as const,
      unicodeRange: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
      url: new URL('../assets/fonts/arimo-cyrillic-v36.woff2', import.meta.url).href,
      weightRange: '400 700',
    }),
    Object.freeze({
      style: 'normal' as const,
      unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
      url: new URL('../assets/fonts/arimo-latin-v36.woff2', import.meta.url).href,
      weightRange: '400 700',
    }),
  ]),
  specimen: 'Рабочее место PEAKS 0123456789',
});

export const SECTION02_FONT_READINESS = createPlatformFontReadinessController({ resource: SECTION02_TYPOGRAPHY_RESOURCE, slowThresholdMs: 3_000 });

import { describe, expect, it } from 'vitest';
import { resolveStatePresentation } from './resolver';
describe('state model', () => { it('uses immutable state-only shape', () => { const value = resolveStatePresentation({ key: 'state-info', surface: 'card' }); expect(value.preserveToneWhenDisabled).toBe(true); expect(Object.isFrozen(value.tokens)).toBe(true); expect('intent' in value).toBe(false); expect('availability' in value).toBe(false); }); });

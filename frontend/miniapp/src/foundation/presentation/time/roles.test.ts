import { describe, expect, it } from 'vitest'; import { OPERATIONAL_TIME_ZONE, TIME_PRESENTATION_ROLES } from './roles';
describe('time roles', () => { it('is exact', () => { expect(OPERATIONAL_TIME_ZONE).toBe('Asia/Tashkent'); expect(TIME_PRESENTATION_ROLES).toEqual(['time-only','date-time-multiline','elapsed-duration']); expect(Object.isFrozen(TIME_PRESENTATION_ROLES)).toBe(true); }); });

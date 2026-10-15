import { describe, expect, it } from 'vitest';

import { SECTION03_BUSINESS_ACTIONS } from './business';

describe('Section 03 business action inventory', () => {
  it('covers each mutation path with authority, success and fresh-read evidence', () => {
    expect(SECTION03_BUSINESS_ACTIONS).toHaveLength(16);
    expect(new Set(SECTION03_BUSINESS_ACTIONS.map((item) => item.actionId)).size).toBe(16);
    expect(SECTION03_BUSINESS_ACTIONS.flatMap((item) => item.nodes)).toHaveLength(18);
    for (const item of SECTION03_BUSINESS_ACTIONS) {
      expect(item.path).toMatch(/^\//);
      expect(item.authority.length).toBeGreaterThan(0);
      expect(item.success.length).toBeGreaterThan(0);
      expect(item.freshRead).toBe(true);
    }
  });

  it('returns employee shift close only to the employee list', () => {
    const close = SECTION03_BUSINESS_ACTIONS.find(
      (item) => item.actionId === 'CLOSE_EMPLOYEE_SHIFT',
    );
    expect(close?.success).toBe('S03-E01');
    expect(JSON.stringify(close)).not.toContain('S03-E02');
  });
});

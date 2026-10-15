import { describe, expect, it } from 'vitest';
import { ATTENTION_COPY, formatAuditAction } from './presentation';

describe('admin presentation', () => {
  it('has approved copy for every overview attention code', () => {
    expect(Object.keys(ATTENTION_COPY).sort()).toEqual([
      'ADDITIONAL_WORK_OPEN',
      'BROKEN_MACHINES',
      'SKU_PRODUCTIVITY_MISSING'
    ]);
  });

  it('keeps known audit actions understandable and unknown actions visible', () => {
    expect(formatAuditAction('admin_session_started')).toBe('Выполнен вход в админ-панель');
    expect(formatAuditAction('future_action')).toBe('future action');
  });
});

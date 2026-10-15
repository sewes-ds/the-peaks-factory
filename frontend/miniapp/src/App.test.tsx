import { describe, expect, it } from 'vitest';
import { resolveSection02SelectorFromLocation, resolveSection03ManagerMode, resolveSection03SelectorFromLocation } from './App';

describe('App Section 03 routing selection', () => {
  it('uses the main manager implementation by default', () => {
    expect(resolveSection03SelectorFromLocation({ search: '', hash: '' })).toBeNull();
    expect(resolveSection03ManagerMode(null)).toBe('main');
  });

  it('routes only the explicit legacy selector to the emergency implementation', () => {
    expect(resolveSection03SelectorFromLocation({ search: '?section03=legacy', hash: '' })).toBe('legacy');
    expect(resolveSection03ManagerMode('legacy')).toBe('legacy');
  });

  it('keeps retired and unknown selector values on the main authenticated flow', () => {
    expect(resolveSection03SelectorFromLocation({ search: '?section03=unknown&s03=1', hash: '#s03' })).toBeNull();
    expect(resolveSection03SelectorFromLocation({ search: '?section03=graph', hash: '' })).toBeNull();
  });

  it('gives the explicit legacy value precedence over additional values', () => {
    expect(resolveSection03SelectorFromLocation({ search: '?section03=unknown&section03=legacy', hash: '' })).toBe('legacy');
  });
});

describe('App Section 02 routing selection', () => {
  it('uses the main operator implementation by default and for unknown values', () => {
    expect(resolveSection02SelectorFromLocation({ search: '' })).toBeNull();
    expect(resolveSection02SelectorFromLocation({ search: '?section02=unknown' })).toBeNull();
  });

  it('routes only the explicit legacy selector to the emergency implementation', () => {
    expect(resolveSection02SelectorFromLocation({ search: '?section02=legacy' })).toBe('legacy');
    expect(resolveSection02SelectorFromLocation({ search: '?section02=unknown&section02=legacy' })).toBe('legacy');
  });
});

import { describe, expect, it } from 'vitest';
import { SECTION03_NODE_IDS } from '../program/ids';
import { validateSection03NodeContext } from '../program/registry';
import { SECTION03_FIXTURES, SECTION03_FIXTURE_NODE_IDS } from './registry';

describe('Section 03 fixture registry', () => {
  it('owns one valid deterministic fixture for each exact node', () => {
    expect(SECTION03_FIXTURE_NODE_IDS).toEqual(SECTION03_NODE_IDS);
    expect(Object.keys(SECTION03_FIXTURES)).toEqual(SECTION03_NODE_IDS);
    for (const nodeId of SECTION03_NODE_IDS) {
      expect(() => validateSection03NodeContext(nodeId, SECTION03_FIXTURES[nodeId].context)).not.toThrow();
    }
  });
});

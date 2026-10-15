import { describe, expect, it } from 'vitest';
import appSource from '../../App.tsx?raw';
import hostSource from './Section02OperatorPipelineHost.tsx?raw';
import shiftNotStartedSource from './Section02ShiftNotStarted.tsx?raw';

describe('Section 02 graph node ownership', () => {
  it('keeps the emergency S02-N01 route owned by App and the legacy shift component', () => {
    expect(appSource).toContain("screenId: 'S02-N01'");
    expect(appSource).toContain('onShiftInactive={handleShiftInactive}');
    expect(shiftNotStartedSource).toContain("nodeId: 'S02-N01'");
    expect(hostSource).not.toContain("nodeId: 'S02-N01'");
    expect(hostSource).not.toContain('startShiftFromInactiveState');
    expect(hostSource).not.toContain('startOperatorShift');
    expect(hostSource).toContain('onShiftInactive?.(refreshedState)');
  });
});

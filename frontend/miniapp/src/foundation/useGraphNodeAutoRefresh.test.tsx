// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphNodeAutoRefreshState } from './useGraphNodeAutoRefresh';
import { useGraphNodeAutoRefresh } from './useGraphNodeAutoRefresh';

type RuntimeState = Readonly<{
  status: 'ready';
  nodeId: string;
  context: Readonly<Record<string, unknown>>;
}>;

function ready(nodeId = 'LIVE'): RuntimeState {
  return Object.freeze({ status: 'ready', nodeId, context: Object.freeze({ employee_id: '7' }) });
}

describe('useGraphNodeAutoRefresh', () => {
  let container: HTMLDivElement;
  let root: Root;
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function renderHarness(input: Readonly<{
    state: RuntimeState;
    interactionPending?: boolean;
    refreshResult?: 'ready' | 'error';
  }>) {
    const refresh = vi.fn(async ({ context }: Readonly<{ context: unknown }>) => Object.freeze({
      status: input.refreshResult ?? 'ready',
      nodeId: input.state.nodeId,
      context,
    }));
    const runtime = Object.freeze({ getState: () => input.state, refresh });
    const successful = vi.fn();
    let hookState: GraphNodeAutoRefreshState | null = null;

    function Harness() {
      hookState = useGraphNodeAutoRefresh({
        runtime: runtime as never,
        eligibleNodeIds: new Set(['LIVE']),
        interactionPending: input.interactionPending ?? false,
        onSuccessfulRefresh: successful,
      });
      return null;
    }

    act(() => root.render(<Harness />));
    return { refresh, successful, get hookState() { return hookState; } };
  }

  it('refreshes only the eligible open node every five seconds', async () => {
    const live = renderHarness({ state: ready() });
    await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
    expect(live.refresh).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(live.refresh).toHaveBeenCalledTimes(1);
    expect(live.refresh).toHaveBeenCalledWith({ context: { employee_id: '7' } });
    expect(live.successful).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    root = createRoot(container);
    const ineligible = renderHarness({ state: ready('FORM') });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(ineligible.refresh).not.toHaveBeenCalled();
  });

  it('pauses for a pending command or hidden Mini App and refreshes on return to foreground', async () => {
    const pending = renderHarness({ state: ready(), interactionPending: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(pending.refresh).not.toHaveBeenCalled();

    act(() => root.unmount());
    root = createRoot(container);
    visibility = 'hidden';
    const hidden = renderHarness({ state: ready() });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(hidden.refresh).not.toHaveBeenCalled();

    visibility = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(hidden.refresh).toHaveBeenCalledTimes(1);
  });

  it('exposes retry only after three consecutive refresh failures', async () => {
    const failing = renderHarness({ state: ready(), refreshResult: 'error' });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(failing.hookState?.persistentError).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(failing.hookState?.persistentError).toBe(true);

    await act(async () => {
      failing.hookState?.retry();
      await Promise.resolve();
    });
    expect(failing.refresh).toHaveBeenCalledTimes(4);
  });
});

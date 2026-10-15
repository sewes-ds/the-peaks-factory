import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GraphActivationContext,
  GraphActivationProgram,
  GraphActivationRuntime,
} from './graphRuntime';

const REFRESH_INTERVAL_MS = 5_000;
const PERSISTENT_FAILURE_COUNT = 3;

export type GraphNodeAutoRefreshState = Readonly<{
  persistentError: boolean;
  retry: () => void;
}>;

export function useGraphNodeAutoRefresh<
  const TProgram extends GraphActivationProgram,
>(input: Readonly<{
  runtime: GraphActivationRuntime<TProgram>;
  eligibleNodeIds: ReadonlySet<string>;
  interactionPending: boolean;
  contextForRefresh?: (context: GraphActivationContext) => GraphActivationContext;
  onSuccessfulRefresh: () => void;
}>): GraphNodeAutoRefreshState {
  const inFlightRef = useRef(false);
  const pendingRef = useRef(input.interactionPending);
  const contextForRefreshRef = useRef(input.contextForRefresh);
  const onSuccessfulRefreshRef = useRef(input.onSuccessfulRefresh);
  const [failureCount, setFailureCount] = useState(0);

  pendingRef.current = input.interactionPending;
  contextForRefreshRef.current = input.contextForRefresh;
  onSuccessfulRefreshRef.current = input.onSuccessfulRefresh;

  const refresh = useCallback(async (force = false): Promise<void> => {
    if (inFlightRef.current || pendingRef.current) return;
    if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const current = input.runtime.getState();
    if (current.status !== 'ready' || !input.eligibleNodeIds.has(current.nodeId)) return;

    inFlightRef.current = true;
    try {
      const context = contextForRefreshRef.current?.(current.context) ?? current.context;
      const result = await input.runtime.refresh({ context });
      if (result.status === 'ready') {
        setFailureCount(0);
        onSuccessfulRefreshRef.current();
      } else if (result.status === 'error') {
        setFailureCount((count) => count + 1);
      }
    } catch {
      setFailureCount((count) => count + 1);
    } finally {
      inFlightRef.current = false;
    }
  }, [input.eligibleNodeIds, input.runtime]);

  useEffect(() => {
    const interval = window.setInterval(() => { void refresh(); }, REFRESH_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  return Object.freeze({
    persistentError: failureCount >= PERSISTENT_FAILURE_COUNT,
    retry: () => { setFailureCount(0); void refresh(true); },
  });
}

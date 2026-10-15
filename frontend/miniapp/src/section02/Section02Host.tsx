import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactElement, type ReactNode } from 'react';
import type { ApiClient } from '../foundation/apiClient';
import { resolvePlatformFontReadinessFeedback, usePlatformFontReadiness, type PlatformFontReadinessController } from '../foundation/fontReadiness';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime, type GraphActivationRuntime, type GraphPresentationExecutionRuntime } from '../foundation/graphRuntime';
import {
  PresentationFeedbackBlock,
  PresentationScreenTemplate,
  createPresentationGraphBridge,
  definePresentationGraphExecutionPort,
  resolveContentFeedback,
  resolveControlFeedback,
  usePresentationFormDraftController,
} from '../foundation/presentation';
import { assetUrl } from '../foundation/runtimePaths';
import { useGraphNodeAutoRefresh } from '../foundation/useGraphNodeAutoRefresh';
import { telegramQrScanner, type TelegramQrScanner } from '../foundation/telegramQr';
import { section02FormFields } from './forms';
import type { Section02Context } from './context';
import type { Section02NodeId } from './ids';
import { createSection02ScreenProjection } from './projection';
import { createSection02Program, type Section02Program } from './program';
import {
  createSection02RuntimeBinding,
  SECTION02_ADDITIONAL_WORK_START_RACE_MESSAGE,
  type Section02InteractionChange,
} from './runtimeBinding';
import { Section02Screen } from './Section02Screen';
import { SECTION02_FONT_READINESS } from './typography';

export type Section02HostProps = Readonly<{
  apiClient: ApiClient;
  initialNodeId: Section02NodeId;
  initialContext?: Section02Context;
  fontReadinessController?: PlatformFontReadinessController;
  qrScanner?: TelegramQrScanner;
}>;

type Session = Readonly<{
  program: Section02Program;
  runtime: GraphActivationRuntime<Section02Program>;
  presentationExecution: GraphPresentationExecutionRuntime<Section02Program>;
}>;

type HostState =
  | Readonly<{ kind: 'loading'; version: number }>
  | Readonly<{ kind: 'activation-error'; version: number }>
  | Readonly<{ kind: 'ready'; interactionPending: boolean; visibleInteractionError: string | null; version: number }>;

const SECTION02_FAILURE_MESSAGE = 'Не удалось открыть раздел. Повторите попытку.';
const SECTION02_FAILURE_CODE = 'S02_RENDER_FAILURE';

function createSession(apiClient: ApiClient, qrScanner: TelegramQrScanner): Session {
  const program = createSection02Program(apiClient, qrScanner);
  const runtime = createGraphActivationRuntime(program);
  return Object.freeze({ program, runtime, presentationExecution: createGraphPresentationExecutionRuntime(runtime) });
}

function errorText(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : String(error);
}

const SECTION02_AUTO_REFRESH_NODES: ReadonlySet<Section02NodeId> = new Set([
  'S02-N01', 'S02-N02', 'S02-N11', 'S02-SAL01', 'S02-SAL02',
]);

function feedback(
  message: string,
  kind: 'loading' | 'recoverable-error' | 'terminal-error',
  onRetry?: () => void,
) {
  return <PresentationFeedbackBlock
    message={message}
    presentation={resolveContentFeedback({ kind })}
    retryFeedback={onRetry === undefined ? undefined : resolveControlFeedback({ availability: 'enabled', preserveToneWhenDisabled: true })}
    retryLabel={onRetry === undefined ? undefined : 'Повторить'}
    onRetry={onRetry}
  />;
}

function Section02FailureShell({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const presentation = resolveContentFeedback({ kind: 'recoverable-error' });
  return (
    <main
      aria-label={SECTION02_FAILURE_MESSAGE}
      className="peaks-section02-screen"
      data-diagnostic-code={SECTION02_FAILURE_CODE}
      data-feedback-shell="section02"
    >
      <PresentationScreenTemplate
        accessibilityLabel={SECTION02_FAILURE_MESSAGE}
        activationKey="section02-feedback-shell"
        busy={false}
        header={<div className="peaks-section02-header"><img alt="PEAKS" className="peaks-section02-header__logo" src={assetUrl('assets/brand/peaks_logo.png')} /></div>}
        scroll={[
          <PresentationFeedbackBlock
            key="section02-failure"
            message={SECTION02_FAILURE_MESSAGE}
            presentation={presentation}
            retryFeedback={resolveControlFeedback({ availability: 'enabled', preserveToneWhenDisabled: true })}
            retryLabel="Повторить"
            onRetry={onRetry}
          />,
        ]}
      />
    </main>
  );
}

class Section02RenderBoundary extends Component<
  Readonly<{ children: ReactNode; onRetry: () => void }>,
  Readonly<{ failed: boolean }>
> {
  state = Object.freeze({ failed: false });

  static getDerivedStateFromError(): Readonly<{ failed: boolean }> {
    return Object.freeze({ failed: true });
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The stable diagnostic code is exposed by the safe shell; raw render data is never shown.
  }

  render() {
    return this.state.failed
      ? <Section02FailureShell onRetry={this.props.onRetry} />
      : this.props.children;
  }
}

function ReadyScreen(input: Readonly<{
  session: Session;
  interactionPending: boolean;
  visibleInteractionError: string | null;
  refreshUnavailable: boolean;
  onRefreshRetry: () => void;
  onInteractionStateChange: (change: Section02InteractionChange) => void;
}>) {
  const state = input.session.runtime.getState();
  const lastReadyRef = useRef<ReactElement | null>(null);
  const nodeId = state.status === 'ready' ? state.nodeId : 'S02-N01';
  const fields = section02FormFields(nodeId);
  const context: Readonly<Record<string, unknown>> = state.status === 'ready'
    ? state.context as Readonly<Record<string, unknown>>
    : Object.freeze({});
  const formController = usePresentationFormDraftController({
    activationKey: state.status === 'ready' ? String(state.activationId) : state.status,
    fields,
    initialValues: Object.freeze(Object.fromEntries(fields.map((field) => {
      const value = context[field.id];
      return [field.id, typeof value === 'string' ? value : ''];
    }))),
    pending: input.interactionPending,
  });
  if (state.status !== 'ready') {
    if (lastReadyRef.current !== null) return lastReadyRef.current;
    return feedback(state.status === 'error' ? errorText(state.error.originalError ?? state.error) : 'Получаем свежее состояние раздела.', state.status === 'error' ? 'terminal-error' : 'loading');
  }
  const binding = createSection02RuntimeBinding({ runtime: input.session.runtime, presentationExecution: input.session.presentationExecution, nodeId: state.nodeId, onInteractionStateChange: input.onInteractionStateChange });
  const port = definePresentationGraphExecutionPort({
    activationId: state.activationId,
    nodeId: state.nodeId,
    describe: binding.actionFactory.describe as unknown as (action: object) => ReturnType<typeof binding.actionFactory.describe>,
    execute: binding.execute,
  });
  const screen = createSection02ScreenProjection({
    nodeId: state.nodeId, ready: state, actionFactory: binding.actionFactory,
    ...(fields.length === 0 ? {} : { formController }),
  });
  const view = createPresentationGraphBridge(port).resolve(screen.bridgeProjection, { interactionPending: input.interactionPending });
  const output = <Section02Screen
    screen={screen}
    view={view}
    interactionPending={input.interactionPending}
    feedback={input.visibleInteractionError !== null
      ? feedback(input.visibleInteractionError, 'terminal-error')
      : input.refreshUnavailable
        ? feedback('Не удалось обновить данные. Показано последнее успешное состояние.', 'recoverable-error', input.onRefreshRetry)
        : undefined}
  />;
  lastReadyRef.current = output;
  return output;
}

export function Section02Host({ apiClient, initialNodeId, initialContext = Object.freeze({}), fontReadinessController = SECTION02_FONT_READINESS, qrScanner = telegramQrScanner }: Section02HostProps) {
  const sessionRef = useRef<Session | null>(null);
  const mountedRef = useRef(false);
  const activationAttemptRef = useRef<string | null>(null);
  const fontReadiness = usePlatformFontReadiness(fontReadinessController);
  const [hostState, setHostState] = useState<HostState>(() => Object.freeze({ kind: 'loading', version: 0 }));
  const [activationRetry, setActivationRetry] = useState(0);
  if (sessionRef.current === null) sessionRef.current = createSession(apiClient, qrScanner);
  const session = sessionRef.current;
  const autoRefresh = useGraphNodeAutoRefresh({
    runtime: session.runtime,
    eligibleNodeIds: SECTION02_AUTO_REFRESH_NODES,
    interactionPending: hostState.kind === 'ready' && hostState.interactionPending,
    onSuccessfulRefresh: () => {
      if (!mountedRef.current || sessionRef.current !== session) return;
      setHostState((current) => current.kind === 'ready'
        ? Object.freeze({ ...current, version: current.version + 1 })
        : current);
    },
  });
  const onInteractionStateChange = (change: Section02InteractionChange) => {
    if (!mountedRef.current) return;
    if (change.status === 'pending') {
      setHostState((current) => Object.freeze({ kind: 'ready', interactionPending: true, visibleInteractionError: null, version: current.version + 1 }));
      return;
    }
    const result = change.result.result;
    const visibleInteractionError = result.status !== 'error' || change.expectedConflictRecovered
      ? null
      : change.actionId === 'START_ADDITIONAL_WORK'
        ? SECTION02_ADDITIONAL_WORK_START_RACE_MESSAGE
        : errorText(result.error);
    setHostState((current) => Object.freeze({ kind: 'ready', interactionPending: false, visibleInteractionError, version: current.version + 1 }));
  };
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => { fontReadinessController.start(); }, [fontReadinessController]);
  useEffect(() => {
    const attemptKey = `${fontReadiness.attempt}:${activationRetry}`;
    if (!['READY', 'READY_AFTER_RETRY'].includes(fontReadiness.state) || activationAttemptRef.current === attemptKey) return;
    activationAttemptRef.current = attemptKey;
    void session.runtime.activate({ nodeId: initialNodeId, context: initialContext }).then((result) => {
      if (!mountedRef.current || sessionRef.current !== session) return;
      if (result.status === 'error') setHostState((current) => Object.freeze({ kind: 'activation-error', version: current.version + 1 }));
      else setHostState((current) => Object.freeze({ kind: 'ready', interactionPending: false, visibleInteractionError: null, version: current.version + 1 }));
    }).catch(() => {
      if (mountedRef.current && sessionRef.current === session) setHostState((current) => Object.freeze({ kind: 'activation-error', version: current.version + 1 }));
    });
  }, [activationRetry, fontReadiness.attempt, fontReadiness.state, initialContext, initialNodeId, session]);
  const retryActivation = () => {
    setHostState((current) => Object.freeze({ kind: 'loading', version: current.version + 1 }));
    setActivationRetry((current) => current + 1);
  };
  const fontFeedback = resolvePlatformFontReadinessFeedback(fontReadiness);
  if (fontFeedback !== null) {
    const presentation = resolveContentFeedback({ kind: fontFeedback.kind });
    return <PresentationFeedbackBlock
      message={fontFeedback.message}
      presentation={presentation}
      retryFeedback={fontFeedback.retryAllowed ? resolveControlFeedback({ availability: 'enabled', preserveToneWhenDisabled: true }) : undefined}
      retryLabel={fontFeedback.retryAllowed ? 'Повторить' : undefined}
      onRetry={fontFeedback.retryAllowed ? fontReadinessController.retry : undefined}
    />;
  }
  if (hostState.kind === 'loading') return feedback('Получаем свежее состояние раздела.', 'loading');
  if (hostState.kind === 'activation-error') return <Section02FailureShell onRetry={retryActivation} />;
  return (
    <Section02RenderBoundary key={activationRetry} onRetry={retryActivation}>
      <ReadyScreen
        session={session}
        interactionPending={hostState.interactionPending}
        onInteractionStateChange={onInteractionStateChange}
        visibleInteractionError={hostState.visibleInteractionError}
        refreshUnavailable={autoRefresh.persistentError}
        onRefreshRetry={autoRefresh.retry}
      />
    </Section02RenderBoundary>
  );
}

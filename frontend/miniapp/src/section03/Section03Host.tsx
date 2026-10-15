import { cloneElement, useEffect, useRef, useState, type ReactElement } from 'react';
import { ApiClientError, type ApiClient } from '../foundation/apiClient';
import {
  resolvePlatformFontReadinessFeedback,
  usePlatformFontReadiness,
  type PlatformFontReadinessController,
} from '../foundation/fontReadiness';
import {
  createGraphActivationRuntime,
  createGraphPresentationExecutionRuntime,
  type GraphActivationRuntime,
  type GraphPresentationExecutionRuntime,
} from '../foundation/graphRuntime';
import {
  PresentationFeedbackBlock,
  createPresentationGraphBridge,
  definePresentationGraphExecutionPort,
  resolveContentFeedback,
  resolveControlFeedback,
  usePresentationFormDraftController,
} from '../foundation/presentation';
import {
  SECTION03_INITIAL_ACTIVATION,
  createSection03Program,
  type Section03Program,
} from './program';
import { createSection03ScreenProjection } from './projection';
import {
  Section03Screen,
  type Section03ScreenProps,
} from './Section03Screen';
import { Section03SystemFeedback } from './Section03SystemFeedback';
import { section03FormFields } from './presentation';
import {
  createSection03RuntimeBinding,
  type Section03InteractionChange,
} from './runtimeBinding';
import { SECTION03_FONT_READINESS } from './typography';
import { useGraphNodeAutoRefresh } from '../foundation/useGraphNodeAutoRefresh';
import type { GraphActivationContext } from '../foundation/graphRuntime';
import type { Section03NodeId } from './program';

export type Section03HostProps = Readonly<{
  apiClient: ApiClient;
  fontReadinessController?: PlatformFontReadinessController;
}>;

type Session = Readonly<{
  program: Section03Program;
  runtime: GraphActivationRuntime<Section03Program>;
  presentationExecution: GraphPresentationExecutionRuntime<Section03Program>;
}>;

type HostState =
  | Readonly<{ kind: 'loading'; version: number }>
  | Readonly<{ kind: 'activation-error'; version: number }>
  | Readonly<{
      kind: 'ready';
      interactionPending: boolean;
      visibleInteractionError: string | null;
      version: number;
    }>;

const SECTION03_AUTO_REFRESH_NODES: ReadonlySet<Section03NodeId> = new Set([
  'S03-N01', 'S03-M01', 'S03-M02', 'S03-D01',
  'S03-E01', 'S03-E02', 'S03-E12', 'S03-E21', 'S03-E22',
  'S03-AW01', 'S03-AW10', 'S03-AW20', 'S03-AW30', 'S03-AW50',
  'S03-SAL01', 'S03-SAL02', 'S03-NOT01',
]);

function refreshContext(context: GraphActivationContext): GraphActivationContext {
  return Object.freeze({ ...context, refresh_nonce: Date.now() });
}

function createSession(apiClient: ApiClient): Session {
  const program = createSection03Program(apiClient);
  const runtime = createGraphActivationRuntime(program);
  return Object.freeze({
    program,
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
  });
}

const ADDITIONAL_WORK_ASSIGNMENT_ERROR_CODES = new Set([
  'additional_work_assignment_already_exists',
  'additional_work_target_not_available',
  'additional_work_type_not_available',
  'additional_work_assignment_forbidden',
  'additional_work_assignment_conflict',
]);

function publicAssignmentMessage(error: unknown): string | null {
  let current = error;
  const visited = new Set<unknown>();
  while (current !== null && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    if (current instanceof ApiClientError) {
      const payload = current.payload as Readonly<Record<string, unknown>> | null;
      const publicError = payload?.error as Readonly<Record<string, unknown>> | undefined;
      if (
        typeof publicError?.code === 'string' &&
        ADDITIONAL_WORK_ASSIGNMENT_ERROR_CODES.has(publicError.code) &&
        typeof publicError.message === 'string' &&
        publicError.message.trim().length > 0
      ) return publicError.message.trim();
    }
    current = (current as Readonly<{ originalError?: unknown }>).originalError;
  }
  return null;
}

export function section03InteractionErrorText(error: unknown): string {
  return publicAssignmentMessage(error) ?? 'Не удалось выполнить действие. Обновите данные и повторите.';
}

function errorText(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : String(error);
}

function ReadyScreen(input: Readonly<{
  session: Session;
  interactionPending: boolean;
  visibleInteractionError: string | null;
  refreshUnavailable: boolean;
  onRefreshRetry: () => void;
  onInteractionStateChange: (change: Section03InteractionChange) => void;
}>) {
  const ready = input.session.runtime.getState();
  const lastReadyRef = useRef<ReactElement<Section03ScreenProps> | null>(null);
  const activeNodeId = ready.status === 'ready' ? ready.nodeId : 'S03-N01';
  const fields = section03FormFields(activeNodeId);
  const context: Readonly<Record<string, unknown>> = ready.status === 'ready'
    ? ready.context as Readonly<Record<string, unknown>>
    : Object.freeze({});
  const initialValues = Object.freeze(Object.fromEntries(fields.map((field) => {
    const value = context[field.id];
    return [field.id, typeof value === 'string' ? value : ''];
  })));
  const formController = usePresentationFormDraftController({
    activationKey: ready.status === 'ready' ? String(ready.activationId) : ready.status,
    fields,
    initialValues,
    pending: input.interactionPending,
  });
  if (ready.status !== 'ready') {
    if (lastReadyRef.current !== null) {
      return cloneElement(lastReadyRef.current, {
        feedback: input.visibleInteractionError !== null ? (
          <PresentationFeedbackBlock
            message={input.visibleInteractionError}
            presentation={resolveContentFeedback({ kind: 'terminal-error' })}
          />
        ) : input.refreshUnavailable ? (
          <PresentationFeedbackBlock
            message="Не удалось обновить данные. Показано последнее успешное состояние."
            presentation={resolveContentFeedback({ kind: 'recoverable-error' })}
            retryFeedback={resolveControlFeedback({ availability: 'enabled', preserveToneWhenDisabled: true })}
            retryLabel="Повторить"
            onRetry={input.onRefreshRetry}
          />
        ) : undefined,
      });
    }
    const message = ready.status === 'error'
      ? errorText(ready.error.originalError ?? ready.error)
      : 'Получаем свежее состояние раздела.';
    return <Section03SystemFeedback kind={ready.status === 'error' ? 'terminal-error' : 'loading'} message={message} />;
  }
  const binding = createSection03RuntimeBinding({
    runtime: input.session.runtime,
    presentationExecution: input.session.presentationExecution,
    nodeId: ready.nodeId,
    onInteractionStateChange: input.onInteractionStateChange,
  });
  const describe = binding.actionFactory.describe as unknown as (action: object) => ReturnType<typeof binding.actionFactory.describe>;
  const port = definePresentationGraphExecutionPort({
    activationId: ready.activationId,
    nodeId: ready.nodeId,
    describe,
    execute: binding.execute,
  });
  const screen = createSection03ScreenProjection({
    nodeId: ready.nodeId,
    ready,
    actionFactory: binding.actionFactory,
    ...(fields.length === 0 ? {} : { formController }),
  } as never);
  const view = createPresentationGraphBridge(port).resolve(
    screen.bridgeProjection,
    { interactionPending: input.interactionPending },
  );
  const output = (
    <Section03Screen
      interactionPending={input.interactionPending}
      screen={screen}
      view={view}
      feedback={input.visibleInteractionError !== null ? (
        <PresentationFeedbackBlock
          message={input.visibleInteractionError}
          presentation={resolveContentFeedback({ kind: 'terminal-error' })}
        />
      ) : input.refreshUnavailable ? (
        <PresentationFeedbackBlock
          message="Не удалось обновить данные. Показано последнее успешное состояние."
          presentation={resolveContentFeedback({ kind: 'recoverable-error' })}
          retryFeedback={resolveControlFeedback({ availability: 'enabled', preserveToneWhenDisabled: true })}
          retryLabel="Повторить"
          onRetry={input.onRefreshRetry}
        />
      ) : undefined}
    />
  );
  lastReadyRef.current = output;
  return output;
}

export function Section03Host({
  apiClient,
  fontReadinessController = SECTION03_FONT_READINESS,
}: Section03HostProps) {
  const sessionRef = useRef<Session | null>(null);
  const mountedRef = useRef(false);
  const activationAttemptRef = useRef<number | null>(null);
  const fontReadiness = usePlatformFontReadiness(fontReadinessController);
  const [hostState, setHostState] = useState<HostState>(() => Object.freeze({
    kind: 'loading' as const,
    version: 0,
  }));
  if (sessionRef.current === null) sessionRef.current = createSession(apiClient);
  const session = sessionRef.current;
  const autoRefresh = useGraphNodeAutoRefresh({
    runtime: session.runtime,
    eligibleNodeIds: SECTION03_AUTO_REFRESH_NODES,
    interactionPending: hostState.kind === 'ready' && hostState.interactionPending,
    contextForRefresh: refreshContext,
    onSuccessfulRefresh: () => {
      if (!mountedRef.current || sessionRef.current !== session) return;
      setHostState((current) => current.kind === 'ready'
        ? Object.freeze({ ...current, version: current.version + 1 })
        : current);
    },
  });

  const handleInteractionStateChange = (change: Section03InteractionChange): void => {
    if (!mountedRef.current) return;
    if (change.status === 'pending') {
      setHostState((current) => Object.freeze({
        kind: 'ready' as const,
        interactionPending: true,
        visibleInteractionError: null,
        version: current.version + 1,
      }));
      return;
    }
    const result = change.result.result;
    setHostState((current) => Object.freeze({
      kind: 'ready' as const,
      interactionPending: false,
      visibleInteractionError: result.status === 'error'
        ? section03InteractionErrorText(result.error)
        : null,
      version: current.version + 1,
    }));
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    fontReadinessController.start();
  }, [fontReadinessController]);

  useEffect(() => {
    if (
      !['READY', 'READY_AFTER_RETRY'].includes(fontReadiness.state) ||
      activationAttemptRef.current === fontReadiness.attempt
    ) return;
    activationAttemptRef.current = fontReadiness.attempt;
    void session.runtime.activate(SECTION03_INITIAL_ACTIVATION)
      .then((result) => {
        if (!mountedRef.current || sessionRef.current !== session) return;
        setHostState((current) => Object.freeze({
          kind: 'ready' as const,
          interactionPending: false,
          visibleInteractionError: result.status === 'error'
            ? errorText(result.error.originalError ?? result.error)
            : null,
          version: current.version + 1,
        }));
      })
      .catch(() => {
        if (!mountedRef.current || sessionRef.current !== session) return;
        setHostState((current) => Object.freeze({
          kind: 'activation-error' as const,
          version: current.version + 1,
        }));
      });
  }, [fontReadiness.attempt, fontReadiness.state, session]);

  const fontFeedback = resolvePlatformFontReadinessFeedback(fontReadiness);
  if (fontFeedback !== null) {
    return (
      <Section03SystemFeedback
        diagnosticCode={fontReadiness.diagnosticCode}
        fontReadinessState={fontReadiness.state}
        kind={fontFeedback.kind}
        message={fontFeedback.message}
        onRetry={fontFeedback.retryAllowed
          ? fontReadinessController.retry
          : undefined}
      />
    );
  }

  if (hostState.kind === 'loading') {
    return <Section03SystemFeedback kind="loading" message="Получаем свежее состояние раздела." />;
  }
  if (hostState.kind === 'activation-error') {
    return <Section03SystemFeedback kind="terminal-error" message="Не удалось получить состояние раздела." />;
  }
  return (
    <ReadyScreen
      interactionPending={hostState.interactionPending}
      onInteractionStateChange={handleInteractionStateChange}
      session={session}
      visibleInteractionError={hostState.visibleInteractionError}
      refreshUnavailable={autoRefresh.persistentError}
      onRefreshRetry={autoRefresh.retry}
    />
  );
}

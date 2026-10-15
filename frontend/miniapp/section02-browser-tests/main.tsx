import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../src/foundation/platformRoot.css';
import '../src/foundation/peaksTheme.css';
import '../src/foundation/layoutPrimitives.css';
import './browser.css';
import { inspectPlatformGeometry } from '../scripts/platform-geometry-gate.mjs';
import { ApiClientError, type ApiRequestOptions } from '../src/foundation/apiClient';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../src/foundation/graphRuntime';
import { createPlatformFontReadinessController } from '../src/foundation/fontReadiness';
import { createPresentationGraphBridge, definePresentationGraphExecutionPort, usePresentationFormDraftController } from '../src/foundation/presentation';
import { SECTION02_FIXTURE_CONTEXTS, createSection02FixtureApiClient, type Section02FixtureRequest } from '../src/section02/__fixtures__/section02Fixtures';
import { section02FormFields } from '../src/section02/forms';
import { isSection02NodeId, type Section02NodeId } from '../src/section02/ids';
import { createSection02ScreenProjection } from '../src/section02/projection';
import { createSection02Program } from '../src/section02/program';
import { createSection02RuntimeBinding } from '../src/section02/runtimeBinding';
import { Section02Host } from '../src/section02/Section02Host';
import { Section02Screen } from '../src/section02/Section02Screen';

const params = new URLSearchParams(location.search);
const requestedNode = params.get('node');
if (!isSection02NodeId(requestedNode)) throw new Error(`Invalid Section 02 browser node: ${requestedNode}`);
const nodeId: Section02NodeId = requestedNode;
const ownerStateScenario = params.get('owner-state') === 'idle';
const additionalWorkConflictScenario = params.get('owner-state') === 'additional-work-conflict';
const requests: Section02FixtureRequest[] = [];
const consoleErrors: string[] = [];
const originalConsoleError = console.error.bind(console);
console.error = (...values: readonly unknown[]) => { consoleErrors.push(values.map(String).join(' ')); originalConsoleError(...values); };
window.addEventListener('error', (event) => consoleErrors.push(event.message));
window.addEventListener('unhandledrejection', (event) => consoleErrors.push(String(event.reason)));

type VisibleRect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;

function visibleRect(element: HTMLElement): VisibleRect {
  const elementRect = element.getBoundingClientRect();
  const scrollOwner = element.closest<HTMLElement>('[data-presentation-scroll-slot="true"]');
  if (scrollOwner === null) return elementRect;
  const scrollRect = scrollOwner.getBoundingClientRect();
  return Object.freeze({
    left: Math.max(elementRect.left, scrollRect.left),
    right: Math.min(elementRect.right, scrollRect.right),
    top: Math.max(elementRect.top, scrollRect.top),
    bottom: Math.min(elementRect.bottom, scrollRect.bottom),
  });
}

function intersects(left: VisibleRect, right: VisibleRect): boolean {
  return Math.min(left.right, right.right) - Math.max(left.left, right.left) > 0.5 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 0.5;
}

function measure() {
  const geometry = inspectPlatformGeometry(document, window, { expectedNormalizationContract: 'PGR-1', rootSelectors: ['#root', 'main'] });
  const semanticRoots = [...document.querySelectorAll<HTMLElement>('[data-state-key], [data-control-key]')];
  const semanticFailures = semanticRoots.flatMap((element, index) => {
    const exact = Number(element.hasAttribute('data-state-key')) + Number(element.hasAttribute('data-control-key'));
    return exact === 1 ? [] : [`root-${index}:exactly-one-authority`];
  });
  const clippingFailures = semanticRoots.flatMap((element, index) => element.scrollWidth > element.clientWidth + 1 ? [`root-${index}:horizontal-clipping`] : []);
  const widthFailures = semanticRoots.flatMap((element, index) => {
    const owner = element.closest<HTMLElement>('.peaks-presentation-template-item');
    if (owner === null) return [];
    return owner.getBoundingClientRect().width - element.getBoundingClientRect().width > 1
      ? [`root-${index}:not-full-width`]
      : [];
  });
  const overlaps: string[] = [];
  semanticRoots.forEach((left, leftIndex) => semanticRoots.slice(leftIndex + 1).forEach((right, offset) => {
    if (!left.contains(right) && !right.contains(left) && intersects(visibleRect(left), visibleRect(right))) overlaps.push(`${leftIndex}:${leftIndex + offset + 1}`);
  }));
  const externalLeakage = requests.filter((request) =>
    !request.path.startsWith('/operator/') && request.path !== '/additional-works/request'
  );
  const template = document.querySelector<HTMLElement>('.peaks-presentation-screen-template');
  const scroll = document.querySelector<HTMLElement>('[data-presentation-scroll-slot="true"]');
  const footer = document.querySelector<HTMLElement>('.peaks-presentation-screen-template__fixed-bottom');
  const templateRect = template?.getBoundingClientRect() ?? null;
  const scrollRect = scroll?.getBoundingClientRect() ?? null;
  const footerRect = footer?.getBoundingClientRect() ?? null;
  const layoutFailures = [
    ...(templateRect === null ? ['missing-template'] : []),
    ...(scrollRect === null ? ['missing-scroll-owner'] : []),
    ...(templateRect !== null && (templateRect.top < -0.5 || templateRect.bottom > innerHeight + 0.5) ? ['template-outside-viewport'] : []),
    ...(footerRect !== null && templateRect !== null && (footerRect.top < templateRect.top || footerRect.bottom > templateRect.bottom + 0.5) ? ['footer-outside-template'] : []),
    ...(scrollRect !== null && templateRect !== null && (scrollRect.top < templateRect.top || scrollRect.bottom > templateRect.bottom + 0.5) ? ['scroll-outside-template'] : []),
    ...(document.documentElement.scrollHeight > innerHeight + 1 ? ['document-vertical-growth'] : []),
  ];
  const errors = [...geometry.failures, ...semanticFailures, ...clippingFailures, ...widthFailures, ...overlaps.map((value) => `overlap:${value}`), ...layoutFailures, ...consoleErrors, ...externalLeakage.map((request) => `external:${request.path}`)];
  return Object.freeze({
    node_id: nodeId,
    viewport: Object.freeze({ width: innerWidth, height: innerHeight }),
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    pgr_1: geometry.status,
    horizontal_overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    document_vertical_growth: document.documentElement.scrollHeight > innerHeight + 1,
    template_height: templateRect?.height ?? null,
    scroll_client_height: scroll?.clientHeight ?? null,
    scroll_height: scroll?.scrollHeight ?? null,
    footer_bottom: footerRect?.bottom ?? null,
    semantic_root_count: semanticRoots.length,
    exactly_one_authority: semanticFailures.length === 0,
    overlap_count: overlaps.length,
    clipping_count: clippingFailures.length,
    console_error_count: consoleErrors.length,
    request_count: requests.length,
    production_request_leakage: externalLeakage.length,
    errors: Object.freeze(errors),
  });
}

function Ready(input: Readonly<{ session: ReturnType<typeof session>; version: number }>) {
  const state = input.session.runtime.getState();
  const activeNode = state.status === 'ready' ? state.nodeId : nodeId;
  const fields = section02FormFields(activeNode);
  const context = SECTION02_FIXTURE_CONTEXTS[activeNode];
  const controller = usePresentationFormDraftController({
    activationKey: state.status === 'ready' ? String(state.activationId) : state.status,
    fields,
    initialValues: Object.freeze(Object.fromEntries(fields.map((field) => [field.id, typeof context[field.id as keyof typeof context] === 'string' ? context[field.id as keyof typeof context] as string : '']))),
    pending: false,
  });
  useEffect(() => {
    if (state.status !== 'ready') return;
    const output = document.createElement('pre');
    output.id = 'section02-browser-result';
    output.textContent = JSON.stringify(measure());
    document.body.append(output);
    return () => output.remove();
  }, [state.status, input.version]);
  if (state.status !== 'ready') return <div>loading</div>;
  const binding = createSection02RuntimeBinding({ runtime: input.session.runtime, presentationExecution: input.session.presentationExecution, nodeId: state.nodeId, onInteractionStateChange: () => undefined });
  const port = definePresentationGraphExecutionPort({ activationId: state.activationId, nodeId: state.nodeId, describe: binding.actionFactory.describe as unknown as (action: object) => ReturnType<typeof binding.actionFactory.describe>, execute: binding.execute });
  const screen = createSection02ScreenProjection({ nodeId: state.nodeId, ready: state, actionFactory: binding.actionFactory, ...(fields.length === 0 ? {} : { formController: controller }) });
  const view = createPresentationGraphBridge(port).resolve(screen.bridgeProjection, { interactionPending: false });
  return <Section02Screen screen={screen} view={view} interactionPending={false} />;
}

function session() {
  const program = createSection02Program(createSection02FixtureApiClient(nodeId, requests));
  const runtime = createGraphActivationRuntime(program);
  return Object.freeze({ program, runtime, presentationExecution: createGraphPresentationExecutionRuntime(runtime) });
}

function App() {
  const current = useMemo(session, []);
  const [version, setVersion] = useState(0);
  useEffect(() => { void current.runtime.activate({ nodeId, context: SECTION02_FIXTURE_CONTEXTS[nodeId] }).then(() => setVersion((value) => value + 1)); }, [current]);
  return <Ready session={current} version={version} />;
}

const SANITIZED_OWNER_WORKPLACE_STATE = {
  actor_employee_id: '1',
  actor_full_name: 'Иванов Иван Иванович',
  shift: { is_active: true, employee_shift_id: '1', started_at: '2026-08-14T08:00:00.000Z' },
  production: { is_active: false, production_operation_id: null, machine_id: null, machine_name: null, sku_id: null, sku_code: null, sku_name: null, can_finish_production: false },
  break: { is_active: false, operator_break_id: null, break_type_id: null, break_type_name: null, can_finish_break: false },
  downtime: { slot_state: 'NONE', downtime_id: null, downtime_type_name: null, downtime_class: null, ui_color_token: null, can_start_downtime: true, can_finish_downtime: false },
  additional_work_summary: { has_active_additional_work: false, active_additional_work_id: null },
  additional_work_start: { blockers: [] },
  salary: { can_view_salary: true },
  finish_shift: { can_finish_now: true, blockers: [], warnings: ['APPROVED_ADDITIONAL_WORKS_NOT_STARTED'], next_required_pipeline: 'CONFIRM_FINISH_SHIFT_WITH_WARNING' },
  available_pipelines: ['FINISH_SHIFT', 'VIEW_SALARY', 'OPEN_ADDITIONAL_WORK', 'REQUEST_ADDITIONAL_WORK', 'START_PRODUCTION', 'START_DOWNTIME', 'START_BREAK', 'START_ADDITIONAL_WORK'],
};

function OwnerStateScenario() {
  const resources = useMemo(() => {
    const apiClient = createSection02FixtureApiClient('S02-N02', requests);
    const originalRequest = apiClient.request.bind(apiClient);
    apiClient.request = <TResponse,>(path: string, options?: ApiRequestOptions) => {
      if (path === '/operator/workplace-state') {
        requests.push(Object.freeze({ method: 'GET', path, body: null }));
        return Promise.resolve(SANITIZED_OWNER_WORKPLACE_STATE as TResponse);
      }
      return originalRequest<TResponse>(path, options);
    };
    const fontReadinessController = createPlatformFontReadinessController({
      environment: Object.freeze({
        clearTimer: (handle) => globalThis.clearTimeout(handle), isVisible: () => true, loadAttempt: async () => undefined,
        now: () => Date.now(), preloadSource: () => undefined, setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
        subscribeVisibility: () => () => undefined,
      }),
      resource: Object.freeze({
        family: 'Browser Test', requiredFaces: Object.freeze([Object.freeze({ style: 'normal' as const, weight: 400 })]),
        resourceId: 'S02_OWNER_BROWSER_FONT', sources: Object.freeze([Object.freeze({ style: 'normal' as const, unicodeRange: 'U+0000-00FF', url: '/test.woff2', weightRange: '400' })]), specimen: 'Test',
      }),
    });
    return Object.freeze({ apiClient, fontReadinessController });
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const main = document.querySelector<HTMLElement>('main[data-node-id="S02-N02"]');
      if (main === null || !main.textContent?.includes('Начать производство')) return;
      window.clearInterval(timer);
      const output = document.createElement('pre');
      output.id = 'section02-browser-result';
      const workplaceCard = main.querySelector<HTMLElement>('.peaks-presentation-card');
      output.textContent = JSON.stringify({
        ...measure(),
        owner_production_equivalent: true,
        meaningful_root_content: main.textContent.trim().length > 0,
        exact_root_labels: [...main.querySelectorAll('button')].map((button) => button.textContent),
        exact_root_semantics: [...main.querySelectorAll<HTMLElement>('button')].map((button) => button.dataset.controlKey),
        idle_operator_card: workplaceCard?.dataset.stateKey === 'state-info'
          && workplaceCard.textContent?.includes('ОператорИванов И.И.') === true
          && !workplaceCard.textContent.includes('Станок')
          && !workplaceCard.textContent.includes('SKU')
          && !workplaceCard.textContent.includes('Доп. работа'),
        no_visible_title: main.querySelector('.peaks-presentation-screen-template__title') === null,
      });
      document.body.append(output);
    }, 20);
    return () => {
      window.clearInterval(timer);
      resources.fontReadinessController.dispose();
    };
  }, [resources]);
  return <Section02Host
    apiClient={resources.apiClient}
    initialNodeId="S02-N02"
    fontReadinessController={resources.fontReadinessController}
  />;
}

function AdditionalWorkConflictScenario() {
  const started = useRef(false);
  const resources = useMemo(() => {
    const fixtureClient = createSection02FixtureApiClient('S02-N11', requests);
    const originalRequest = fixtureClient.request.bind(fixtureClient);
    let typeReads = 0;
    fixtureClient.request = async <TResponse,>(path: string, options?: ApiRequestOptions) => {
      if (path === '/operator/additional-work-types/available') {
        typeReads += 1;
        requests.push(Object.freeze({ method: 'GET', path, body: null }));
        return {
          additional_work_types: typeReads === 1
            ? [
                { additional_work_type_id: '81', display_name: 'Инвентаризация материалов' },
                { additional_work_type_id: '82', display_name: 'Помощь упаковке' },
              ]
            : [{ additional_work_type_id: '82', display_name: 'Помощь упаковке' }],
        } as TResponse;
      }
      if (path === '/additional-works/request' && options?.method === 'POST') {
        requests.push(Object.freeze({ method: 'POST', path, body: options.body ?? null }));
        throw new ApiClientError('Backend request failed', 409, {
          error: { code: 'conflict', message: 'Operation violates current business state' },
        });
      }
      return originalRequest<TResponse>(path, options);
    };
    const fontReadinessController = createPlatformFontReadinessController({
      environment: Object.freeze({
        clearTimer: (handle) => globalThis.clearTimeout(handle), isVisible: () => true, loadAttempt: async () => undefined,
        now: () => Date.now(), preloadSource: () => undefined, setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
        subscribeVisibility: () => () => undefined,
      }),
      resource: Object.freeze({
        family: 'Browser Test', requiredFaces: Object.freeze([Object.freeze({ style: 'normal' as const, weight: 400 })]),
        resourceId: 'S02_CONFLICT_BROWSER_FONT', sources: Object.freeze([Object.freeze({ style: 'normal' as const, unicodeRange: 'U+0000-00FF', url: '/test.woff2', weightRange: '400' })]), specimen: 'Test',
      }),
    });
    return Object.freeze({ apiClient: fixtureClient, fontReadinessController });
  }, []);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const waitFor = async <T,>(read: () => T | null): Promise<T> => {
      for (let attempt = 0; attempt < 300; attempt += 1) {
        const value = read();
        if (value !== null) return value;
        await new Promise((done) => window.setTimeout(done, 20));
      }
      throw new Error('Additional-work conflict browser scenario timed out.');
    };
    const button = (label: string) => waitFor(() =>
      [...document.querySelectorAll('button')].find((item) => item.textContent?.includes(label)) ?? null
    );
    const activeNode = (expected: string) => waitFor(() => {
      const main = document.querySelector<HTMLElement>('main');
      return main?.dataset.nodeId === expected ? main : null;
    });
    void (async () => {
      await activeNode('S02-N11');
      (await button('Запросить допработу')).click();
      await activeNode('S02-AW01');
      (await button('Инвентаризация материалов')).click();
      await activeNode('S02-AW02');
      (await button('Запросить:')).click();
      const main = await activeNode('S02-AW01');
      const snapshot = measure();
      const duplicateHidden = !main.textContent?.includes('Инвентаризация материалов');
      const alternativeVisible = main.textContent?.includes('Помощь упаковке') === true;
      const noSystemWarning = main.querySelector('[role="alert"]') === null
        && !main.textContent?.includes('Operation violates current business state');
      const postCount = requests.filter((request) =>
        request.method === 'POST' && request.path === '/additional-works/request'
      ).length;
      const scenarioErrors = [
        ...(snapshot.errors as readonly string[]),
        ...(duplicateHidden ? [] : ['duplicate-type-remained-selectable']),
        ...(alternativeVisible ? [] : ['alternative-type-missing']),
        ...(noSystemWarning ? [] : ['system-warning-visible']),
        ...(postCount === 1 ? [] : [`request-post-count:${postCount}`]),
      ];
      const output = document.createElement('pre');
      output.id = 'section02-browser-result';
      output.textContent = JSON.stringify({
        ...snapshot,
        node_id: 'S02-AW01:additional-work-conflict-refresh',
        status: scenarioErrors.length === 0 ? 'PASS' : 'FAIL',
        errors: scenarioErrors,
        owner_additional_work_conflict: true,
        duplicate_hidden: duplicateHidden,
        alternative_visible: alternativeVisible,
        no_system_warning: noSystemWarning,
        request_post_count: postCount,
      });
      document.body.append(output);
    })().catch((error) => {
      consoleErrors.push(String(error));
      const output = document.createElement('pre');
      output.id = 'section02-browser-result';
      output.textContent = JSON.stringify({
        node_id: 'S02-AW01:additional-work-conflict-refresh',
        status: 'FAIL',
        errors: [...consoleErrors],
        owner_additional_work_conflict: true,
      });
      document.body.append(output);
    });
    return () => resources.fontReadinessController.dispose();
  }, [resources]);
  return <Section02Host
    apiClient={resources.apiClient}
    initialNodeId="S02-N11"
    fontReadinessController={resources.fontReadinessController}
  />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  additionalWorkConflictScenario
    ? <AdditionalWorkConflictScenario />
    : <React.StrictMode>{ownerStateScenario ? <OwnerStateScenario /> : <App />}</React.StrictMode>,
);

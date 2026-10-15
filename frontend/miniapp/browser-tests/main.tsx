import React, { useLayoutEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../src/foundation/platformRoot.css';
import '../src/foundation/peaksTheme.css';
import '../src/foundation/layoutPrimitives.css';
import {
  inspectPlatformGeometry,
  type PlatformGeometrySnapshot,
} from '../scripts/platform-geometry-gate.mjs';
import './browser.css';
import {
  createGraphActivationRuntime,
  createGraphPresentationExecutionRuntime,
} from '../src/foundation/graphRuntime';
import type { GraphActionInstanceCommonInput } from '../src/foundation/graphProtocol';
import {
  CONTROL_SEMANTIC_KEYS,
  STATE_PRESENTATION_KEYS,
  createPresentationGraphBridge,
  definePresentationGraphExecutionPort,
  PresentationGraphBridgeItems,
  PresentationScreenTemplate,
  resolveControlPresentation,
  resolveStatePresentation,
  usePresentationFormDraftController,
} from '../src/foundation/presentation';
import { SECTION03_FIXTURES } from '../src/section03/fixtures/registry';
import { SECTION03_P1_FIXTURES } from '../src/section03/fixtures/p1';
import { SECTION03_P2A1_FIXTURES } from '../src/section03/fixtures/p2a1Employees';
import { SECTION03_P2A2A_FIXTURES } from '../src/section03/fixtures/p2a2aShiftClose';
import { SECTION03_P2A2B_FIXTURES } from '../src/section03/fixtures/p2a2bBlockers';
import { SECTION03_P2B1_FIXTURES } from '../src/section03/fixtures/p2b1CompletedWorks';
import { SECTION03_P2B2_FIXTURES } from '../src/section03/fixtures/p2b2Salary';
import { SECTION03_P3A1_FIXTURES } from '../src/section03/fixtures/p3a1AdditionalWorkRequests';
import { SECTION03_P3A2_FIXTURES } from '../src/section03/fixtures/p3a2AdditionalWorkLifecycle';
import { SECTION03_P3A3_FIXTURES } from '../src/section03/fixtures/p3a3AssignAdditionalWork';
import { SECTION03_P3A4_FIXTURES } from '../src/section03/fixtures/p3a4AdditionalWorkAccrual';
import {
  P4A1_EMPTY_RESPONSE,
  P4A1_FINISHED_RESPONSE,
  SECTION03_P4A1_FIXTURES,
} from '../src/section03/fixtures/p4a1CorrectionsEntry';
import { SECTION03_P4A2_FIXTURES } from '../src/section03/fixtures/p4a2FinancialCorrectionCreate';
import { SECTION03_P4A3_FIXTURES } from '../src/section03/fixtures/p4a3FinancialCorrectionReversal';
import {
  P4A4_MACHINE_OPERATIONS_RESPONSE,
  SECTION03_P4A4_FIXTURES,
} from '../src/section03/fixtures/p4a4ProductionCorrection';
import {
  P4A5_NOTIFICATIONS_EMPTY_RESPONSE,
  SECTION03_P4A5_FIXTURES,
} from '../src/section03/fixtures/p4a5Notifications';
import {
  P5_REPORTS_AUTHORIZED_RESPONSE,
  SECTION03_P5_FIXTURES,
} from '../src/section03/fixtures/p5Reports';
import { createSection03Program, type Section03NodeId } from '../src/section03/program';
import { isSection03NodeId } from '../src/section03/program/ids';
import { createSection03ScreenProjection } from '../src/section03/projection';
import {
  factory as section03GraphActionFactory,
  type RuntimeActionFactory,
} from '../src/section03/projections/common';
import { Section03Screen } from '../src/section03/Section03Screen';
import { section03FormFields } from '../src/section03/presentation';
import { createSection03RuntimeBinding } from '../src/section03/runtimeBinding';
import { Section03Host } from '../src/section03/Section03Host';
import { SECTION03_FORWARD_TARGETS } from '../src/section03/program/reachability';
import type { Section03Context } from '../src/section03/program/context';
import {
  createBrowserFixtureApiClient,
  createBrowserFixtureApiHarness,
  createBrowserP1FixtureApiHarness,
  createBrowserP1VariantApiClient,
  createBrowserP2A1FixtureApiHarness,
  createBrowserP2A1VariantApiClient,
  createBrowserP2A2aFixtureApiHarness,
  createBrowserP2A2aVariantApiClient,
  createBrowserP2A2bFixtureApiHarness,
  createBrowserP2A2bVariantApiClient,
  createBrowserP2B1FixtureApiHarness,
  createBrowserP2B1VariantApiClient,
  createBrowserP2B2FixtureApiHarness,
  createBrowserP2B2VariantApiClient,
  createBrowserP3A1FixtureApiHarness,
  createBrowserP3A1VariantApiClient,
  createBrowserP3A2FixtureApiHarness,
  createBrowserP3A2VariantApiClient,
  createBrowserP3A3FixtureApiHarness,
  createBrowserP3A3VariantApiClient,
  createBrowserP3A4FixtureApiHarness,
  createBrowserP3A4VariantApiClient,
  createBrowserP4A1FixtureApiHarness,
  createBrowserP4A1VariantApiClient,
  createBrowserP4A2FixtureApiHarness,
  createBrowserP4A2VariantApiClient,
  createBrowserP4A3FixtureApiHarness,
  createBrowserP4A3VariantApiClient,
  createBrowserP4A4FixtureApiHarness,
  createBrowserP4A4VariantApiClient,
  createBrowserP4A5FixtureApiHarness,
  createBrowserP4A5VariantApiClient,
  createBrowserP5FixtureApiHarness,
  createBrowserP5VariantApiClient,
  type BrowserFixtureRequest,
} from './fixtureApi';
import {
  SECTION03_P1_DOM_SCENARIOS,
  type Section03P1DomScenarioId,
} from './p1DomScenarioRegistry';
import {
  SECTION03_P2A1_DOM_SCENARIOS,
  type Section03P2A1DomScenarioId,
} from './p2a1DomScenarioRegistry';
import {
  SECTION03_P2A2A_DOM_SCENARIOS,
  type Section03P2A2aDomScenarioId,
} from './p2a2aDomScenarioRegistry';
import {
  SECTION03_P2A2B_DOM_SCENARIOS,
  type Section03P2A2bDomScenarioId,
} from './p2a2bDomScenarioRegistry';
import {
  SECTION03_P2B1_DOM_SCENARIOS,
  type Section03P2B1DomScenarioId,
} from './p2b1DomScenarioRegistry';
import {
  SECTION03_P2B2_DOM_SCENARIOS,
  type Section03P2B2DomScenarioId,
} from './p2b2DomScenarioRegistry';
import {
  SECTION03_P3A1_DOM_SCENARIOS,
  type Section03P3A1DomScenarioId,
} from './p3a1DomScenarioRegistry';
import {
  SECTION03_P3A2_DOM_SCENARIOS,
  type Section03P3A2DomScenarioId,
} from './p3a2DomScenarioRegistry';
import {
  SECTION03_P3A3_DOM_SCENARIOS,
  type Section03P3A3DomScenarioId,
} from './p3a3DomScenarioRegistry';
import {
  SECTION03_P3A4_DOM_SCENARIOS,
  type Section03P3A4DomScenarioId,
} from './p3a4DomScenarioRegistry';
import {
  SECTION03_P4A1_DOM_SCENARIOS,
  type Section03P4A1DomScenarioId,
} from './p4a1DomScenarioRegistry';
import {
  SECTION03_P4A2_DOM_SCENARIOS,
  type Section03P4A2DomScenarioId,
} from './p4a2DomScenarioRegistry';
import {
  SECTION03_P4A3_DOM_SCENARIOS,
  type Section03P4A3DomScenarioId,
} from './p4a3DomScenarioRegistry';
import {
  SECTION03_P4A4_DOM_SCENARIOS,
  type Section03P4A4DomScenarioId,
} from './p4a4DomScenarioRegistry';
import {
  SECTION03_P4A5_DOM_SCENARIOS,
  type Section03P4A5DomScenarioId,
} from './p4a5DomScenarioRegistry';
import {
  SECTION03_P5_DOM_SCENARIOS,
  type Section03P5DomScenarioId,
} from './p5ReportsDomScenarioRegistry';
import {
  SECTION03_BROWSER_SCENARIO_REGISTRY,
  SECTION03_BROWSER_SCENARIOS,
  type Section03BrowserScenarioId,
} from './scenarioRegistry';

type LayoutResult = Readonly<{
  node_id: Section03NodeId;
  fixture_id: string | null;
  status: 'PASS' | 'FAIL';
  horizontal_overflow: boolean;
  platform_geometry: PlatformGeometrySnapshot;
  platform_geometry_failures: readonly string[];
  overlap_count: number;
  control_overflow_count: number;
  min_height_failures: number;
  flex_shrink_failures: number;
  fixed_overlap_count: number;
  card_line_clipping_count: number;
  input_failures: number;
  missing_visible_text: readonly string[];
  unexpected_visible_text: readonly string[];
  long_content_height: number;
  long_content_min_height: number;
  browser_console_errors: readonly string[];
  errors: readonly string[];
  ordered_item_ids: readonly string[];
  task_state_keys: readonly string[];
  semantic_root_count: number;
  semantic_roots: readonly SemanticRootEvidence[];
  semantic_failures: readonly string[];
  computed_paint_failures: readonly string[];
  back_usable: boolean;
  task_rows_operable: boolean;
}>;

type SemanticRootEvidence = Readonly<{
  authority_kind: 'state' | 'control';
  key: string;
  surface: string;
  expected: Readonly<{
    background: string;
    border: string;
    text: string;
    marker: string;
  }>;
  computed: Readonly<{
    background: string;
    border: string;
    text: string;
    marker: string | null;
  }>;
}>;

const browserConsoleErrors: string[] = [];
const originalConsoleError = console.error.bind(console);
console.error = (...values: readonly unknown[]) => {
  browserConsoleErrors.push(values.map((value) => String(value)).join(' '));
  originalConsoleError(...values);
};
window.addEventListener('error', (event) => browserConsoleErrors.push(event.message));
window.addEventListener('unhandledrejection', (event) => browserConsoleErrors.push(String(event.reason)));

function intersects(a: DOMRect, b: DOMRect): boolean {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
}

function semanticRootSurface(
  element: HTMLElement,
  authorityKind: 'state' | 'control',
): string | null {
  if (authorityKind === 'control') {
    if (element.classList.contains('peaks-presentation-action-button')) return 'action-button';
    if (element.classList.contains('peaks-presentation-control-list-button')) return 'list-button';
    return null;
  }
  if (element.classList.contains('peaks-presentation-state-list-button')) return 'list-button';
  if (element.classList.contains('peaks-presentation-entity-row')) return 'entity-row';
  if (element.classList.contains('peaks-presentation-card')) return 'card';
  if (element.classList.contains('peaks-presentation-summary-line')) return 'summary-line';
  if (element.classList.contains('peaks-presentation-message')) return 'message';
  return null;
}

function normalizedPaintToken(token: string): string {
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.color = token;
  probe.style.display = 'none';
  document.body.append(probe);
  const normalized = getComputedStyle(probe).color;
  probe.remove();
  return normalized;
}

function measureSemanticRoots(): Readonly<{
  roots: readonly SemanticRootEvidence[];
  semanticFailures: readonly string[];
  computedPaintFailures: readonly string[];
}> {
  const roots: SemanticRootEvidence[] = [];
  const semanticFailures: string[] = [];
  const computedPaintFailures: string[] = [];
  const selector = [
    '.peaks-presentation-action-button',
    '.peaks-presentation-control-list-button',
    '.peaks-presentation-state-list-button',
    '.peaks-presentation-entity-row',
    '.peaks-presentation-card',
    '.peaks-presentation-summary-line',
    '.peaks-presentation-message',
    '[data-state-key]',
    '[data-control-key]',
  ].join(',');

  for (const [index, element] of [...document.querySelectorAll<HTMLElement>(selector)].entries()) {
    const hasStateKey = element.hasAttribute('data-state-key');
    const hasControlKey = element.hasAttribute('data-control-key');
    if (hasStateKey === hasControlKey) {
      semanticFailures.push(`root-${index}:exactly-one-authority-key`);
      continue;
    }
    const authorityKind = hasStateKey ? 'state' : 'control';
    const key = element.getAttribute(hasStateKey ? 'data-state-key' : 'data-control-key') ?? '';
    const surface = semanticRootSurface(element, authorityKind);
    if (surface === null) {
      semanticFailures.push(`root-${index}:${authorityKind}:${key}:unknown-surface`);
      continue;
    }
    if (authorityKind === 'state' && !STATE_PRESENTATION_KEYS.includes(key as never)) {
      semanticFailures.push(`root-${index}:state:${key}:unknown-key`);
      continue;
    }
    if (authorityKind === 'control' && !CONTROL_SEMANTIC_KEYS.includes(key as never)) {
      semanticFailures.push(`root-${index}:control:${key}:unknown-key`);
      continue;
    }

    let expected: SemanticRootEvidence['expected'];
    try {
      if (authorityKind === 'state') {
        const presentation = resolveStatePresentation({ key, surface });
        expected = Object.freeze({
          background: presentation.tokens.background,
          border: presentation.tokens.border,
          text: presentation.tokens.text,
          marker: presentation.tokens.marker,
        });
      } else {
        const presentation = resolveControlPresentation({ key, surface });
        expected = Object.freeze({
          background: presentation.tokens.background,
          border: presentation.tokens.border,
          text: presentation.tokens.text,
          marker: presentation.tokens.border,
        });
      }
    } catch (error) {
      semanticFailures.push(
        `root-${index}:${authorityKind}:${key}:${surface}:resolver:${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    const variablePairs = [
      ['background', '--peaks-presentation-background'],
      ['border', '--peaks-presentation-border'],
      ['text', '--peaks-presentation-text'],
      ['marker', '--peaks-presentation-marker'],
    ] as const;
    for (const [paint, variable] of variablePairs) {
      const actual = element.style.getPropertyValue(variable).trim();
      if (actual !== expected[paint]) {
        semanticFailures.push(
          `root-${index}:${authorityKind}:${key}:${surface}:${variable}:${actual || '<missing>'}!=${expected[paint]}`,
        );
      }
    }

    const computedStyle = getComputedStyle(element);
    const markerElement = element.querySelector<HTMLElement>(':scope > .peaks-presentation-state-marker');
    const computed = Object.freeze({
      background: computedStyle.backgroundColor,
      border: computedStyle.borderTopColor,
      text: computedStyle.color,
      marker: markerElement === null ? null : getComputedStyle(markerElement).backgroundColor,
    });
    const computedPairs = [
      ['background', computed.background, normalizedPaintToken(expected.background)],
      ['border', computed.border, normalizedPaintToken(expected.border)],
      ['text', computed.text, normalizedPaintToken(expected.text)],
    ] as const;
    for (const [paint, actual, expectedComputed] of computedPairs) {
      if (actual !== expectedComputed) {
        computedPaintFailures.push(
          `root-${index}:${authorityKind}:${key}:${surface}:${paint}:${actual}!=${expectedComputed}`,
        );
      }
    }
    const markerRequired = authorityKind === 'state' && (surface === 'list-button' || surface === 'entity-row');
    if (markerRequired && computed.marker === null) {
      computedPaintFailures.push(`root-${index}:state:${key}:${surface}:marker:<missing>`);
    } else if (computed.marker !== null) {
      const expectedMarker = normalizedPaintToken(expected.marker);
      if (computed.marker !== expectedMarker) {
        computedPaintFailures.push(
          `root-${index}:${authorityKind}:${key}:${surface}:marker:${computed.marker}!=${expectedMarker}`,
        );
      }
    }
    roots.push(Object.freeze({ authority_kind: authorityKind, key, surface, expected, computed }));
  }

  return Object.freeze({
    roots: Object.freeze(roots),
    semanticFailures: Object.freeze(semanticFailures),
    computedPaintFailures: Object.freeze(computedPaintFailures),
  });
}

function publish(result: LayoutResult): void {
  let script = document.querySelector('#layout-result');
  if (script === null) {
    script = document.createElement('script');
    script.id = 'layout-result';
    script.setAttribute('type', 'application/json');
    document.body.append(script);
  }
  script.textContent = JSON.stringify(result);
  const visible = document.querySelector('#browser-result');
  if (visible !== null) visible.textContent = JSON.stringify(result);
  document.documentElement.dataset.layoutStatus = result.status;
}

const cardContentLinesView = createPresentationGraphBridge(
  definePresentationGraphExecutionPort({
    activationId: 1,
    nodeId: 'CARD-CONTENT-LINES',
    describe: () => {
      throw new Error('The card content-line fixture contains no actions.');
    },
    execute: async () => undefined,
  }),
).resolve({
  nodeId: 'CARD-CONTENT-LINES',
  items: [{
    kind: 'card',
    id: 'card-content-lines',
    stateKey: 'state-warning',
    ariaLabel: 'Подтверждение действия',
    lines: [
      {
        id: 'heading',
        content: { kind: 'text', text: 'Подтвердите действие:' },
      },
      {
        id: 'employee',
        label: { kind: 'text', text: 'ФИО' },
        value: {
          kind: 'text',
          text: 'Александрова Екатерина Константиновна',
        },
      },
      {
        id: 'activity',
        content: {
          kind: 'text',
          text: 'Перевести сотрудника на блокирующую операцию\nи сохранить текущую смену без изменений',
        },
      },
      {
        id: 'comment',
        label: { kind: 'text', text: 'Комментарий' },
        value: {
          kind: 'text',
          text: 'Длинный комментарий для проверки переноса внутри карточки\nи роста её высоты без обрезания содержимого',
        },
      },
    ],
  }],
}, { interactionPending: false });

function CardContentLinesFixture() {
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const expected = [
        { shape: 'content', content: 'Подтвердите действие:' },
        {
          shape: 'labeled',
          label: 'ФИО',
          value: 'Александрова Екатерина Константиновна',
        },
        {
          shape: 'content',
          content: 'Перевести сотрудника на блокирующую операцию\nи сохранить текущую смену без изменений',
        },
        {
          shape: 'labeled',
          label: 'Комментарий',
          value: 'Длинный комментарий для проверки переноса внутри карточки\nи роста её высоты без обрезания содержимого',
        },
      ];
      const card = document.querySelector<HTMLElement>(
        '.peaks-presentation-card',
      );
      const lines = [...document.querySelectorAll<HTMLElement>(
        '.peaks-presentation-card__line',
      )];
      const actual = lines.map((line) => {
        const content = line.querySelector<HTMLElement>(
          '.peaks-presentation-card__content',
        );
        if (content !== null) {
          return { shape: 'content', content: content.textContent ?? '' };
        }
        return {
          shape: 'labeled',
          label: line.querySelector<HTMLElement>(
            '.peaks-presentation-card__label',
          )?.textContent ?? '',
          value: line.querySelector<HTMLElement>(
            '.peaks-presentation-card__value',
          )?.textContent ?? '',
        };
      });
      const contentLines = lines.filter((line) => (
        line.classList.contains('peaks-presentation-card__line--content')
      ));
      const contentLabelCount = contentLines.filter((line) => (
        line.querySelector('.peaks-presentation-card__label') !== null ||
        line.querySelector('.peaks-presentation-card__value') !== null
      )).length;
      let overlapCount = 0;
      for (let index = 1; index < lines.length; index += 1) {
        const previous = lines[index - 1]!.getBoundingClientRect();
        const current = lines[index]!.getBoundingClientRect();
        if (current.top < previous.bottom - 0.5) overlapCount += 1;
      }
      const cardRect = card?.getBoundingClientRect();
      const clippingCount = cardRect === undefined
        ? lines.length
        : lines.filter((line) => {
            const rect = line.getBoundingClientRect();
            return (
              rect.left < cardRect.left - 0.5 ||
              rect.right > cardRect.right + 0.5 ||
              rect.top < cardRect.top - 0.5 ||
              rect.bottom > cardRect.bottom + 0.5 ||
              line.scrollHeight > line.clientHeight + 1
            );
          }).length;
      const rootElement = document.documentElement;
      const item = document.querySelector<HTMLElement>(
        '.peaks-presentation-template-item',
      );
      const cardHeight = cardRect?.height ?? 0;
      const cardMinHeight = card === null
        ? 0
        : Number.parseFloat(getComputedStyle(card).minHeight) || 0;
      const errors = [
        ...(JSON.stringify(actual) === JSON.stringify(expected)
          ? []
          : ['visible-order']),
        ...(contentLines.length === 2 && contentLabelCount === 0
          ? []
          : ['content-label-elements']),
        ...(overlapCount === 0 ? [] : ['line-overlap']),
        ...(clippingCount === 0 ? [] : ['line-clipping']),
        ...(rootElement.scrollWidth <= rootElement.clientWidth + 1
          ? []
          : ['horizontal-overflow']),
        ...(cardHeight > cardMinHeight + 1 ? [] : ['card-did-not-grow']),
        ...(item !== null && getComputedStyle(item).flexShrink === '0'
          ? []
          : ['item-flex-shrink']),
        ...(browserConsoleErrors.length === 0 ? [] : ['console-errors']),
      ];
      const result = {
        status: errors.length === 0 ? 'PASS' : 'FAIL',
        viewport: { width: innerWidth, height: innerHeight },
        visible_order: actual,
        content_line_count: contentLines.length,
        content_label_element_count: contentLabelCount,
        overlap_count: overlapCount,
        clipping_count: clippingCount,
        horizontal_overflow:
          rootElement.scrollWidth > rootElement.clientWidth + 1,
        card_height: cardHeight,
        card_min_height: cardMinHeight,
        card_grows: cardHeight > cardMinHeight + 1,
        item_flex_shrink: item === null
          ? null
          : getComputedStyle(item).flexShrink,
        browser_console_errors: [...browserConsoleErrors],
        errors,
      };
      const output = document.createElement('script');
      output.id = 'card-content-lines-result';
      output.type = 'application/json';
      output.textContent = JSON.stringify(result);
      document.body.append(output);
      document.documentElement.dataset.cardContentLinesStatus = result.status;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <PresentationScreenTemplate
      accessibilityLabel="Проверка строк карточки"
      activationKey="card-content-lines"
      busy={false}
      scroll={[
        <PresentationGraphBridgeItems
          items={cardContentLinesView.items}
          key="card-content-lines"
        />,
      ]}
    />
  );
}

function measure(nodeId: Section03NodeId): LayoutResult {
  const errors: string[] = [];
  const parameters = new URLSearchParams(location.search);
  const fixtureId = parameters.get('p1-fixture') ??
    parameters.get('p2a1-fixture') ??
    parameters.get('p2a2a-fixture') ??
    parameters.get('p2a2b-fixture') ??
    parameters.get('p2b1-fixture') ??
    parameters.get('p2b2-fixture') ??
    parameters.get('p3a1-fixture') ??
    parameters.get('p3a2-fixture') ??
    parameters.get('p3a3-fixture') ??
    parameters.get('p3a4-fixture') ??
    parameters.get('p4a1-fixture') ??
    parameters.get('p4a2-fixture') ??
    parameters.get('p4a3-fixture') ??
    parameters.get('p4a4-fixture') ??
    parameters.get('p4a5-fixture') ??
    parameters.get('p5-fixture');
  const fixture = fixtureId === null
    ? undefined
    : [
        ...SECTION03_P1_FIXTURES,
        ...SECTION03_P2A1_FIXTURES,
        ...SECTION03_P2A2A_FIXTURES,
        ...SECTION03_P2A2B_FIXTURES,
        ...SECTION03_P2B1_FIXTURES,
        ...SECTION03_P2B2_FIXTURES,
        ...SECTION03_P3A1_FIXTURES,
        ...SECTION03_P3A2_FIXTURES,
        ...SECTION03_P3A3_FIXTURES,
        ...SECTION03_P3A4_FIXTURES,
        ...SECTION03_P4A1_FIXTURES,
        ...SECTION03_P4A2_FIXTURES,
        ...SECTION03_P4A3_FIXTURES,
        ...SECTION03_P4A4_FIXTURES,
        ...SECTION03_P4A5_FIXTURES,
        ...SECTION03_P5_FIXTURES,
      ]
        .find((candidate) => candidate.fixtureId === fixtureId);
  const visibleDomText = document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const visibleControlValues = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')]
    .map((element) => element.value)
    .join('\n');
  const visibleFixtureText = `${visibleDomText}\n${visibleControlValues}`;
  const missingVisibleText = fixture?.visibleText.filter(
    (value) => !visibleFixtureText.includes(value.replaceAll('\\n', '\n')),
  ) ?? [];
  const unexpectedVisibleText = fixture !== undefined && 'absentText' in fixture
    ? fixture.absentText?.filter((value: string) => visibleFixtureText.includes(value)) ?? []
    : [];
  if (missingVisibleText.length > 0) errors.push('fixture-visible-text-missing');
  if (unexpectedVisibleText.length > 0) errors.push('fixture-absent-text-visible');
  const p4a5Fixture = fixtureId === null
    ? undefined
    : SECTION03_P4A5_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId);
  const p4a5TaskRows = [...document.querySelectorAll<HTMLButtonElement>('.peaks-presentation-state-list-button')]
    .filter((element) => element.getAttribute('aria-label')?.startsWith('Открыть задачу '));
  const p4a5TaskStateKeys = p4a5TaskRows.map((element) => element.dataset.stateKey ?? '');
  const p4a5ExpectedTaskStates = p4a5Fixture?.expectedStateKeys.slice(
    0,
    p4a5Fixture.orderedItemIds[0] === 'notifications-empty' ? 0 : p4a5Fixture.orderedItemIds.length - 1,
  ) ?? [];
  if (p4a5Fixture !== undefined && JSON.stringify(p4a5TaskStateKeys) !== JSON.stringify(p4a5ExpectedTaskStates)) {
    errors.push('p4a5-task-state-order');
  }
  const backControl = [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((element) => element.getAttribute('aria-label') === 'Назад');
  const backUsable = backControl !== undefined && !backControl.disabled && backControl.getAttribute('aria-disabled') !== 'true';
  const taskRowsOperable = p4a5TaskRows.every((element) => !element.disabled && element.getAttribute('aria-disabled') !== 'true');
  if (p4a5Fixture !== undefined && !backUsable) errors.push('p4a5-back-unusable');
  if (p4a5Fixture !== undefined && !taskRowsOperable) errors.push('p4a5-task-row-inoperable');
  const platformGeometry = inspectPlatformGeometry(document, window, {
    expectedNormalizationContract: 'PGR-1',
  });
  const horizontalOverflow = platformGeometry.document.document_scroll_width >
    platformGeometry.document.document_client_width + 1 ||
    platformGeometry.document.body_scroll_width >
      platformGeometry.document.document_client_width + 1;
  if (platformGeometry.status !== 'PASS') errors.push('platform-geometry-contract');
  const slotSelectors = [
    '.peaks-presentation-screen-template__fixed-top',
    '.peaks-presentation-screen-template__scroll',
    '.peaks-presentation-screen-template__fixed-bottom',
  ];
  let overlapCount = 0;
  for (const selector of slotSelectors) {
    const items = [...document.querySelectorAll(`${selector} > .peaks-presentation-template-item`)];
    for (let index = 1; index < items.length; index += 1) {
      if (intersects(items[index - 1]!.getBoundingClientRect(), items[index]!.getBoundingClientRect())) overlapCount += 1;
    }
  }
  if (overlapCount > 0) errors.push('adjacent-item-overlap');
  const controls = [...document.querySelectorAll<HTMLElement>('button,input,textarea')];
  const controlOverflowCount = controls.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left < -0.5 || rect.right > window.innerWidth + 0.5 || rect.width < 0 || rect.height < 0;
  }).length;
  if (controlOverflowCount > 0) errors.push('control-overflow');
  const minHeightFailures = controls.filter((element) => {
    const minimum = Number.parseFloat(getComputedStyle(element).minHeight) || 0;
    return element.getBoundingClientRect().height + 0.5 < minimum;
  }).length;
  if (minHeightFailures > 0) errors.push('interactive-min-height');
  const templateItems = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-template-item')];
  const flexShrinkFailures = templateItems.filter((element) => getComputedStyle(element).flexShrink !== '0').length;
  if (flexShrinkFailures > 0) errors.push('slot-flex-shrink');
  const scroll = document.querySelector<HTMLElement>('.peaks-presentation-screen-template__scroll');
  const fixed = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-screen-template__fixed-top,.peaks-presentation-screen-template__fixed-bottom')];
  const fixedOverlapCount = scroll === null ? 1 : fixed.filter((element) => intersects(element.getBoundingClientRect(), scroll.getBoundingClientRect())).length;
  if (fixedOverlapCount > 0) errors.push('fixed-slot-overlap');
  const cards = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card')];
  const cardLineClippingCount = cards.reduce((count, card) => {
    const cardRect = card.getBoundingClientRect();
    return count + [...card.querySelectorAll<HTMLElement>('.peaks-presentation-card__line')]
      .filter((line) => {
        const rect = line.getBoundingClientRect();
        return rect.left < cardRect.left - 0.5 ||
          rect.right > cardRect.right + 0.5 ||
          rect.top < cardRect.top - 0.5 ||
          rect.bottom > cardRect.bottom + 0.5 ||
          line.scrollHeight > line.clientHeight + 1;
      }).length;
  }, 0);
  if (cardLineClippingCount > 0) errors.push('card-line-clipping');
  const inputs = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')];
  const inputFailures = inputs.filter((element) => element.tabIndex < 0 || element.getBoundingClientRect().width <= 0).length;
  if (inputFailures > 0) errors.push('input-not-focusable');
  const longControl = document.querySelector<HTMLElement>(
    '.peaks-presentation-state-list-button,.peaks-presentation-control-list-button,.peaks-presentation-card',
  );
  const longContentHeight = longControl?.getBoundingClientRect().height ?? 0;
  const longContentMinHeight = longControl === null ? 0 : Number.parseFloat(getComputedStyle(longControl).minHeight) || 0;
  const semantic = measureSemanticRoots();
  if (semantic.roots.length === 0) errors.push('semantic-root-missing');
  if (semantic.semanticFailures.length > 0) errors.push('semantic-authority-contract');
  if (semantic.computedPaintFailures.length > 0) errors.push('computed-paint-contract');
  return Object.freeze({
    node_id: nodeId,
    fixture_id: fixtureId,
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    horizontal_overflow: horizontalOverflow,
    platform_geometry: platformGeometry,
    platform_geometry_failures: platformGeometry.failures,
    overlap_count: overlapCount,
    control_overflow_count: controlOverflowCount,
    min_height_failures: minHeightFailures,
    flex_shrink_failures: flexShrinkFailures,
    fixed_overlap_count: fixedOverlapCount,
    card_line_clipping_count: cardLineClippingCount,
    input_failures: inputFailures,
    missing_visible_text: Object.freeze([...missingVisibleText]),
    unexpected_visible_text: Object.freeze([...unexpectedVisibleText]),
    long_content_height: longContentHeight,
    long_content_min_height: longContentMinHeight,
    browser_console_errors: Object.freeze([...browserConsoleErrors]),
    errors: Object.freeze(errors),
    ordered_item_ids: Object.freeze([...(p4a5Fixture?.orderedItemIds ?? [])]),
    task_state_keys: Object.freeze(p4a5TaskStateKeys),
    semantic_root_count: semantic.roots.length,
    semantic_roots: semantic.roots,
    semantic_failures: semantic.semanticFailures,
    computed_paint_failures: semantic.computedPaintFailures,
    back_usable: backUsable,
    task_rows_operable: taskRowsOperable,
  });
}

function ReadyFixture(input: Readonly<{
  nodeId: Section03NodeId;
  runtime: ReturnType<typeof createGraphActivationRuntime<ReturnType<typeof createSection03Program>>>;
  presentationExecution: ReturnType<typeof createGraphPresentationExecutionRuntime<ReturnType<typeof createSection03Program>>>;
}>) {
  const ready = input.runtime.getState();
  const fields = section03FormFields(input.nodeId);
  const fixtureVariant = new URLSearchParams(location.search).has('p1-fixture') ||
    new URLSearchParams(location.search).has('p2a1-fixture') ||
    new URLSearchParams(location.search).has('p2a2a-fixture') ||
    new URLSearchParams(location.search).has('p2a2b-fixture') ||
    new URLSearchParams(location.search).has('p2b1-fixture') ||
    new URLSearchParams(location.search).has('p2b2-fixture') ||
    new URLSearchParams(location.search).has('p3a1-fixture') ||
    new URLSearchParams(location.search).has('p3a4-fixture') ||
    new URLSearchParams(location.search).has('p4a1-fixture') ||
    new URLSearchParams(location.search).has('p4a2-fixture') ||
    new URLSearchParams(location.search).has('p4a3-fixture') ||
    new URLSearchParams(location.search).has('p4a4-fixture') ||
    new URLSearchParams(location.search).has('p4a5-fixture') ||
    new URLSearchParams(location.search).has('p5-fixture');
  const p2a2aFixtureId = new URLSearchParams(location.search).get('p2a2a-fixture');
  const p2a2aFixture = SECTION03_P2A2A_FIXTURES.find(
    (fixture) => fixture.fixtureId === p2a2aFixtureId,
  );
  const p2a2bFixtureId = new URLSearchParams(location.search).get('p2a2b-fixture');
  const p2a2bFixture = SECTION03_P2A2B_FIXTURES.find(
    (fixture) => fixture.fixtureId === p2a2bFixtureId,
  );
  const p3a4FixtureId = new URLSearchParams(location.search).get('p3a4-fixture');
  const p3a4Fixture = SECTION03_P3A4_FIXTURES.find(
    (fixture) => fixture.fixtureId === p3a4FixtureId,
  );
  const p4a2FixtureId = new URLSearchParams(location.search).get('p4a2-fixture');
  const p4a2Fixture = SECTION03_P4A2_FIXTURES.find(
    (fixture) => fixture.fixtureId === p4a2FixtureId,
  );
  const p4a3FixtureId = new URLSearchParams(location.search).get('p4a3-fixture');
  const p4a3Fixture = SECTION03_P4A3_FIXTURES.find(
    (fixture) => fixture.fixtureId === p4a3FixtureId,
  );
  const p4a4FixtureId = new URLSearchParams(location.search).get('p4a4-fixture');
  const p4a4Fixture = SECTION03_P4A4_FIXTURES.find(
    (fixture) => fixture.fixtureId === p4a4FixtureId,
  );
  const p5FixtureId = new URLSearchParams(location.search).get('p5-fixture');
  const p5Fixture = SECTION03_P5_FIXTURES.find(
    (fixture) => fixture.fixtureId === p5FixtureId,
  );
  const readyContext: Readonly<Record<string, unknown>> = ready.status === 'ready'
    ? ready.context as Readonly<Record<string, unknown>>
    : Object.freeze({});
  const initialValues = Object.freeze(Object.fromEntries(fields.map((field) => {
    const contextValue = readyContext[field.id];
    return [
      field.id,
      typeof contextValue === 'string'
        ? contextValue
        : p2a2aFixture?.formValue ??
          p2a2bFixture?.formValue ??
          (p3a4Fixture !== undefined && 'formValue' in p3a4Fixture ? p3a4Fixture.formValue : undefined) ??
          p4a2Fixture?.formValue ??
          p4a3Fixture?.formValue ??
          p4a4Fixture?.formValue ??
          p5Fixture?.formValue ??
          (fixtureVariant
          ? ''
          : field.kind === 'numeric'
            ? '125.5'
            : field.kind === 'date'
              ? '2026-07-31'
              : 'Длинное валидное значение поля для проверки многострочного ввода'),
    ];
  })));
  const controller = usePresentationFormDraftController({
    activationKey: ready.status === 'ready' ? String(ready.activationId) : ready.status,
    fields,
    initialValues,
  });
  useLayoutEffect(() => {
    if (ready.status !== 'ready') return;
    publish(measure(input.nodeId));
  }, [input.nodeId, ready.status === 'ready' ? ready.activationId : ready.status]);
  if (ready.status !== 'ready') {
    return <div data-browser-status={ready.status}>{JSON.stringify(ready)}</div>;
  }
  const binding = createSection03RuntimeBinding({
    runtime: input.runtime,
    presentationExecution: input.presentationExecution,
    nodeId: input.nodeId,
    onInteractionStateChange: () => undefined,
  });
  const describe = binding.actionFactory.describe as unknown as (action: object) => ReturnType<typeof binding.actionFactory.describe>;
  const port = definePresentationGraphExecutionPort({ activationId: ready.activationId, nodeId: ready.nodeId, describe, execute: binding.execute });
  const screen = createSection03ScreenProjection({
    nodeId: input.nodeId,
    ready,
    actionFactory: binding.actionFactory,
    ...(fields.length === 0 ? {} : { formController: controller }),
  } as never);
  const view = createPresentationGraphBridge(port).resolve(screen.bridgeProjection, { interactionPending: false });
  return <Section03Screen interactionPending={false} screen={screen} view={view} />;
}

function BrowserHarness(input: Readonly<{
  nodeId: Section03NodeId;
  runtime: ReturnType<typeof createGraphActivationRuntime<ReturnType<typeof createSection03Program>>>;
  presentationExecution: ReturnType<typeof createGraphPresentationExecutionRuntime<ReturnType<typeof createSection03Program>>>;
}>) {
  return (
    <>
      <ReadyFixture
        nodeId={input.nodeId}
        runtime={input.runtime}
        presentationExecution={input.presentationExecution}
      />
      <pre id="browser-result" />
    </>
  );
}

const scenarioEvent = Object.freeze({
  employee_id: 'EMP-1', employee_full_name: 'Иванов Иван Иванович', machine_id: 'M-1', downtime_id: 'D-1', downtime_type_id: 'DT-1',
  downtime_type_name: 'Критический простой',
  production_operation_id: 'PO-1', additional_work_id: 'AW-1', additional_work_type_id: 'AWT-1', additional_work_type_name: 'Инвентаризация',
  work_type: 'production', operation_id: 'OP-1', salary_entry_id: 'SE-1', employee_shift_id: 'SHIFT-1',
  salary_correction_type_id: 'SCT-1', correction_mode: 'accrual', production_correction_mode: 'final', period: 'today',
  from_date: '2026-07-01', to_date: '2026-07-31', comment_finish: 'Подтверждённый комментарий завершения',
  comment_start: 'Подтверждённая причина критического простоя', quantity_produced: '12.5',
  shift_finish_reason: 'Смена завершена по подтверждённой причине', amount_uzs: '125000',
  without_accrual_reason: 'Работа учтена без начисления', financial_correction_reason: 'Подтверждённая корректировка',
  reversal_reason: 'Подтверждённая причина сторно', correction_quantity: '15',
  production_correction_reason: 'Подтверждённая производственная корректировка', refresh_nonce: 1,
} satisfies Section03Context);

function representativeBrowserContext(
  nodeId: Section03NodeId,
): Section03Context {
  const current = SECTION03_FIXTURES[nodeId].context;
  if (nodeId === 'S03-AW10' || nodeId === 'S03-AW11' || nodeId === 'S03-AW12') {
    return Object.freeze({ ...current, additional_work_id: 'REQ-1' });
  }
  if (nodeId === 'S03-AW20' || nodeId === 'S03-AW21') {
    return Object.freeze({ ...current, additional_work_id: 'APP-1' });
  }
  if (nodeId === 'S03-AW30' || nodeId === 'S03-AW31') {
    return Object.freeze({ ...current, additional_work_id: 'ACT-1' });
  }
  if (nodeId.startsWith('S03-AW5')) {
    return Object.freeze({ ...current, additional_work_id: 'WAIT-1' });
  }
  if (nodeId === 'S03-CF12' || nodeId === 'S03-CF13' || nodeId === 'S03-CF14') {
    return Object.freeze({
      ...current,
      salary_correction_type_id: 'TYPE-ACCRUAL',
    });
  }
  if (nodeId === 'S03-CF24' || nodeId === 'S03-CF25') {
    return Object.freeze({ ...current, salary_entry_id: 'SAL-PROD' });
  }
  if (nodeId === 'S03-R14') {
    return Object.freeze({ ...current, export_run_id: '42' });
  }
  return current;
}

function isScenarioId(value: string | null): value is Section03BrowserScenarioId {
  return value !== null && (SECTION03_BROWSER_SCENARIOS as readonly string[]).includes(value);
}

function scenarioActionInput(
  instanceId: string,
  ariaLabel: string,
): GraphActionInstanceCommonInput {
  return Object.freeze({ instanceId, ariaLabel });
}

function scenarioActionFactory(
  binding: ReturnType<typeof createSection03RuntimeBinding>,
): RuntimeActionFactory {
  return section03GraphActionFactory({
    nodeId: binding.ready.nodeId,
    ready: binding.ready,
    actionFactory: binding.actionFactory,
  });
}

async function runScenario(scenarioId: Section03BrowserScenarioId) {
  const definition = SECTION03_BROWSER_SCENARIO_REGISTRY[scenarioId];
  const fixture = createBrowserFixtureApiHarness();
  const program = createSection03Program(fixture.apiClient);
  const runtime = createGraphActivationRuntime(program);
  const presentationExecution = createGraphPresentationExecutionRuntime(runtime);
  const visited: Section03NodeId[] = [];
  const backChecks: string[] = [];
  let duplicateSuppressions = 0;
  let previousNode: Section03NodeId | null = null;
  const scenarioContext: Record<string, string | number> = {
    ...scenarioEvent,
  };
  if (scenarioId === 'additional-work-approve' || scenarioId === 'additional-work-reject') {
    scenarioContext.additional_work_id = 'REQ-1';
  }
  if (scenarioId === 'additional-work-cancel') scenarioContext.additional_work_id = 'APP-1';
  if (scenarioId === 'additional-work-finish') scenarioContext.additional_work_id = 'ACT-1';
  if (scenarioId === 'additional-work-accrue' || scenarioId === 'additional-work-without-accrual') {
    scenarioContext.additional_work_id = 'WAIT-1';
  }
  if (scenarioId === 'financial-correction-create-approve') {
    scenarioContext.salary_correction_type_id = 'TYPE-ACCRUAL';
  }
  if (scenarioId === 'salary-entry-reversal') scenarioContext.salary_entry_id = 'SAL-PROD';
  if (scenarioId === 'production-correction-employee') {
    delete scenarioContext.machine_id;
    scenarioContext.correction_scope = 'employee';
  }
  if (scenarioId === 'production-correction-machine') {
    delete scenarioContext.employee_id;
    scenarioContext.correction_scope = 'machine';
  }
  const runtimeEvent = Object.freeze(scenarioContext) as Section03Context;

  const currentBinding = (nodeId: Section03NodeId) => createSection03RuntimeBinding({
    runtime,
    presentationExecution,
    nodeId,
    onInteractionStateChange: () => undefined,
  });
  const navigate = async (target: Section03NodeId) => {
    const current = runtime.getState();
    if (current.status !== 'ready') throw new Error(`Scenario ${scenarioId} has no ready source for ${target}.`);
    if (current.nodeId === target) return;
    const binding = currentBinding(current.nodeId);
    let actionId: string;
    let event: Section03Context = runtimeEvent;
    if (current.nodeId === 'S03-M01' && target === 'S03-M02') {
      actionId = 'openMachineWarning';
      event = Object.freeze({ machine_id: 'M-1' });
    } else if (current.nodeId === 'S03-M02' && target === 'S03-M03O') {
      actionId = 'openOperationalDowntimeFinish';
      event = runtimeEvent;
    } else if (current.nodeId === 'S03-M02' && target === 'S03-M03C') {
      actionId = 'p1OpenCriticalFinish';
    } else if (current.nodeId === 'S03-M02' && target === 'S03-D10') {
      actionId = 'p1OpenDowntimeStart';
    } else if (current.nodeId === 'S03-M03C' && target === 'S03-M04C') {
      actionId = 'p1ContinueCriticalFinish';
    } else if (current.nodeId === 'S03-D01' && target === 'S03-D10') {
      actionId = 'p1OpenDowntimeStart';
    } else if (current.nodeId === 'S03-D10' && target === 'S03-D11') {
      actionId = 'p1SelectDowntimeTypeWithoutMachine';
    } else if (current.nodeId === 'S03-D10' && target === 'S03-D12') {
      actionId = 'p1SelectDowntimeTypeWithMachine';
    } else if (current.nodeId === 'S03-D11' && target === 'S03-D12') {
      actionId = 'p1SelectDowntimeMachine';
    } else if (current.nodeId === 'S03-D12' && target === 'S03-D13') {
      actionId = 'p1ContinueDowntimeStart';
    } else if ((current.nodeId === 'S03-CP10' || current.nodeId === 'S03-CP20') && target === 'S03-CP11') {
      actionId = 'navigate0';
      event = Object.freeze({
        ...runtimeEvent,
        correction_scope: current.nodeId === 'S03-CP10' ? 'employee' : 'machine',
      });
    } else {
      const targets = SECTION03_FORWARD_TARGETS[current.nodeId] as readonly Section03NodeId[];
      const index = targets.indexOf(target);
      if (index < 0) throw new Error(`Scenario ${scenarioId} cannot navigate ${current.nodeId} -> ${target}.`);
      actionId = `navigate${index}`;
    }
    const instance = scenarioActionFactory(binding).presentation(
      actionId,
      scenarioActionInput(
        `${scenarioId}-${current.nodeId}-${target}`,
        `Перейти к ${target}`,
      ),
      event,
    );
    await binding.execute(instance);
    const settled = runtime.getState();
    if (settled.status !== 'ready' || settled.nodeId !== target) {
      throw new Error(`Scenario ${scenarioId} transition missed ${target}: ${JSON.stringify(settled)}.`);
    }
    previousNode = current.nodeId;
    visited.push(target);
  };
  const exerciseBack = async (nodeId: Section03NodeId) => {
    if (previousNode === null) return;
    const binding = currentBinding(nodeId);
    const p1BackAction = nodeId === 'S03-M03O'
      ? 'p1BackToMachineCard'
      : nodeId === 'S03-M04C'
        ? 'p1BackToCriticalFinishForm'
        : nodeId === 'S03-D13'
          ? 'p1BackToDowntimeComment'
          : 'back';
    const instance = scenarioActionFactory(binding).presentation(
      p1BackAction,
      scenarioActionInput(`${scenarioId}-back-${nodeId}`, 'Назад'),
      p1BackAction === 'back' ? {} : runtimeEvent,
    );
    await binding.execute(instance);
    const backed = runtime.getState();
    if (backed.status !== 'ready' || backed.nodeId !== previousNode) throw new Error(`Scenario ${scenarioId} Back missed ${previousNode}.`);
    backChecks.push(`${nodeId}->${previousNode}`);
    await navigate(nodeId);
  };

  for (const step of definition.steps) {
    if (step.kind === 'navigate') {
      if (runtime.getState().status === 'idle') {
        const activated = await runtime.activate({ nodeId: step.nodeId, context: SECTION03_FIXTURES[step.nodeId].context });
        if (activated.status !== 'ready') throw new Error(`Scenario ${scenarioId} failed initial activation.`);
        visited.push(step.nodeId);
      } else {
        await navigate(step.nodeId);
      }
      continue;
    }
    const current = runtime.getState();
    if (current.status !== 'ready') throw new Error(`Scenario ${scenarioId} business source is not ready.`);
    await exerciseBack(current.nodeId);
    const rebound = runtime.getState();
    if (rebound.status !== 'ready') throw new Error(`Scenario ${scenarioId} business rebound is not ready.`);
    let interactionPending = false;
    const binding = createSection03RuntimeBinding({
      runtime,
      presentationExecution,
      nodeId: rebound.nodeId,
      onInteractionStateChange: (change) => { interactionPending = change.status === 'pending'; },
    });
    const event = step.actionId === 'FINISH_DOWNTIME'
      ? Object.freeze({ downtime_id: 'D-1', comment_finish: scenarioEvent.comment_finish })
      : runtimeEvent;
    const instances = scenarioActionFactory(binding).business(
      step.actionId,
      scenarioActionInput(`${scenarioId}-${step.actionId}`, step.actionId),
      event,
    );
    if (instances.length !== 1) throw new Error(`Scenario ${scenarioId} business action ${step.actionId} is unavailable.`);
    const guardedExecute = async () => {
      if (interactionPending) { duplicateSuppressions += 1; return; }
      await binding.execute(instances[0]!);
    };
    await Promise.all([guardedExecute(), guardedExecute()]);
    const settled = runtime.getState();
    if (settled.status !== 'ready' || settled.nodeId !== step.successNodeId) throw new Error(`Scenario ${scenarioId} business action missed ${step.successNodeId}.`);
    previousNode = rebound.nodeId;
    visited.push(step.successNodeId);
  }
  if (scenarioId === 'employee-salary') {
    for (const expectedTarget of ['S03-SAL01', 'S03-E02'] as const) {
      const current = runtime.getState();
      if (current.status !== 'ready') throw new Error(`Scenario ${scenarioId} has no ready Back source.`);
      const source = current.nodeId;
      const binding = currentBinding(source);
      await binding.execute(scenarioActionFactory(binding).presentation(
        'back',
        scenarioActionInput(`${scenarioId}-exact-back-${source}`, 'Назад'),
        {},
      ));
      const backed = runtime.getState();
      if (backed.status !== 'ready' || backed.nodeId !== expectedTarget) {
        throw new Error(`Scenario ${scenarioId} Back missed ${source}->${expectedTarget}.`);
      }
      backChecks.push(`${source}->${expectedTarget}`);
    }
  }
  const mutationPaths = fixture.requests.filter((request) => request.method === 'POST').map((request) => request.path);
  if (JSON.stringify(mutationPaths) !== JSON.stringify(definition.mutationPaths)) {
    throw new Error(`Scenario ${scenarioId} mutation paths differ: ${JSON.stringify(mutationPaths)}.`);
  }
  const businessStepCount = definition.steps.filter((step) => step.kind === 'business').length;
  if (businessStepCount !== duplicateSuppressions) {
    throw new Error(`Scenario ${scenarioId} duplicate suppression count is ${duplicateSuppressions}.`);
  }
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    mutation_paths: Object.freeze(mutationPaths),
    duplicate_suppressions: duplicateSuppressions,
    external_requests: 0,
  });
}

function isP1DomScenarioId(value: string | null): value is Section03P1DomScenarioId {
  return value !== null && (SECTION03_P1_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function waitForDom<T>(read: () => T | null, description: string): Promise<T> {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const value = read();
    if (value !== null) return value;
    await new Promise((resolve) => window.setTimeout(resolve, 20));
  }
  throw new Error(`DOM wait timed out: ${description}.`);
}

async function runP1DomScenario(
  scenarioId: Section03P1DomScenarioId,
  requests: BrowserFixtureRequest[],
) {
  let domClicks = 0;
  let typedFields = 0;
  let pendingChecks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];

  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `node ${nodeId}`);
    visited.push(nodeId);
    return nodeId;
  };
  const button = (ariaLabel: string) => {
    const found = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.getAttribute('aria-label') === ariaLabel);
    if (found === undefined) throw new Error(`Button not found: ${ariaLabel} at ${currentNode()}.`);
    return found;
  };
  const assertText = (value: string) => {
    if (!(document.querySelector('main[data-node-id]')?.textContent ?? '').includes(value)) {
      throw new Error(`Visible text missing at ${currentNode()}: ${value}.`);
    }
  };
  const clickTo = async (ariaLabel: string, target: Section03NodeId) => {
    const control = button(ariaLabel);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') {
      throw new Error(`Button unexpectedly disabled: ${ariaLabel} at ${currentNode()}.`);
    }
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const typeTextarea = async (value: string) => {
    const field = await waitForDom(
      () => document.querySelector<HTMLTextAreaElement>('textarea'),
      `textarea at ${currentNode()}`,
    );
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter === undefined) throw new Error('Native textarea value setter is unavailable.');
    setter.call(field, value);
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    typedFields += 1;
    await new Promise((resolve) => window.setTimeout(resolve, 25));
    if (field.value !== value) throw new Error(`Typed textarea value was not visible at ${currentNode()}.`);
  };
  const assertNextDisabled = (expected: boolean) => {
    const next = button('Далее');
    const disabled = next.disabled && next.getAttribute('aria-disabled') === 'true';
    if (disabled !== expected) throw new Error(`Next disabled=${disabled}, expected ${expected} at ${currentNode()}.`);
  };
  const clickBusiness = async (ariaLabel: string, target: Section03NodeId) => {
    const before = requests.filter((request) => request.method === 'POST').length;
    domClicks += 1;
    button(ariaLabel).click();
    const pending = await waitForDom(() => {
      const candidate = [...document.querySelectorAll<HTMLButtonElement>('button')]
        .find((item) => item.getAttribute('aria-label') === ariaLabel);
      return candidate !== undefined && candidate.disabled && candidate.getAttribute('aria-busy') === 'true'
        ? candidate
        : null;
    }, `pending ${ariaLabel}`);
    pendingChecks += 1;
    domClicks += 1;
    pending.click();
    await waitNode(target);
    const after = requests.filter((request) => request.method === 'POST').length;
    if (after !== before + 1) throw new Error(`Duplicate business request for ${ariaLabel}: ${after - before}.`);
  };

  const openMachines = () => clickTo('Открыть раздел Станки', 'S03-M01');
  const openDowntimes = () => clickTo('Открыть раздел Простои', 'S03-D01');
  const openProduction = () => clickTo('Открыть карточку станка Станок в производстве', 'S03-M02');
  const openOperational = () => clickTo('Открыть карточку станка Станок операционного простоя', 'S03-M02');
  const openCritical = () => clickTo('Открыть карточку станка Станок критического простоя', 'S03-M02');
  const selectType = (target: 'S03-D11' | 'S03-D12') => clickTo('Критический простой', target);

  await waitNode('S03-N01');
  assertText('Работают: 2');
  assertText('Открытые задачи: 2');

  if (scenarioId === 'main-machines-back') {
    await openMachines();
    assertText('SKU: Корпус редуктора');
    await openProduction();
    assertText('Станок в производстве');
    await backTo('S03-M01');
    await backTo('S03-N01');
  } else if (scenarioId === 'main-downtimes-open-card-back') {
    await openDowntimes();
    assertText('Наладка');
    await clickTo('Открыть Станок операционного простоя', 'S03-M02');
    await backTo('S03-D01');
  } else if (scenarioId === 'operational-finish-from-machines') {
    await openMachines();
    await openOperational();
    await clickTo('Завершить: Наладка', 'S03-M03O');
    assertText('Подтвердите завершение простоя');
    await clickBusiness('Завершить: Наладка', 'S03-M01');
  } else if (scenarioId === 'critical-finish-from-machines') {
    await openMachines();
    await openCritical();
    await clickTo('Завершить: Поломка шпинделя', 'S03-M03C');
    await typeTextarea('   ');
    assertNextDisabled(true);
    await typeTextarea('  Проверенный комментарий DOM  ');
    assertNextDisabled(false);
    await clickTo('Далее', 'S03-M04C');
    assertText('Проверенный комментарий DOM');
    await clickBusiness('Завершить: Поломка шпинделя', 'S03-M01');
  } else if (scenarioId === 'start-from-machine-card') {
    await openMachines();
    await openProduction();
    await clickTo('Начать простой', 'S03-D10');
    await selectType('S03-D12');
    await typeTextarea('  Причина остановки DOM  ');
    await clickTo('Далее', 'S03-D13');
    assertText('Подтвердите начало простоя:');
    assertText('Причина остановки DOM');
    await clickBusiness('Начать: Критический простой', 'S03-N01');
  } else if (scenarioId === 'start-from-downtime-section') {
    await openDowntimes();
    await clickTo('Начать простой', 'S03-D10');
    await selectType('S03-D11');
    await clickTo('Станок в производстве', 'S03-D12');
    await typeTextarea('  Причина из раздела простоев  ');
    await clickTo('Далее', 'S03-D13');
    await clickBusiness('Начать: Критический простой', 'S03-N01');
  } else if (scenarioId === 'operational-conflict-during-machine-selection') {
    await openDowntimes();
    await clickTo('Начать простой', 'S03-D10');
    await selectType('S03-D11');
    await clickTo('Станок операционного простоя', 'S03-M03O');
    await clickBusiness('Завершить: Наладка', 'S03-D12');
    await typeTextarea('  Причина после завершения операционного простоя  ');
    await clickTo('Далее', 'S03-D13');
    await clickBusiness('Начать: Критический простой', 'S03-N01');
  } else {
    await openMachines();
    await backTo('S03-N01');
    await openMachines();
    await openOperational();
    await backTo('S03-M01');
    await openOperational();
    await clickTo('Завершить: Наладка', 'S03-M03O');
    await backTo('S03-M02');
    await backTo('S03-M01');
    await openCritical();
    await clickTo('Завершить: Поломка шпинделя', 'S03-M03C');
    await backTo('S03-M02');
    await clickTo('Завершить: Поломка шпинделя', 'S03-M03C');
    await typeTextarea('Комментарий матрицы');
    await clickTo('Далее', 'S03-M04C');
    await backTo('S03-M03C');
    await backTo('S03-M02');
    await backTo('S03-M01');
    await backTo('S03-N01');
    await openDowntimes();
    await clickTo('Открыть Станок операционного простоя', 'S03-M02');
    await backTo('S03-D01');
    await backTo('S03-N01');
    await openDowntimes();
    await clickTo('Начать простой', 'S03-D10');
    await backTo('S03-D01');
    await clickTo('Начать простой', 'S03-D10');
    await selectType('S03-D11');
    await backTo('S03-D10');
    await selectType('S03-D11');
    await clickTo('Станок в производстве', 'S03-D12');
    await backTo('S03-D11');
    await clickTo('Станок в производстве', 'S03-D12');
    await typeTextarea('Комментарий старта матрицы');
    await clickTo('Далее', 'S03-D13');
    await backTo('S03-D12');
    await backTo('S03-D11');
    await backTo('S03-D10');
    await backTo('S03-D01');
    await backTo('S03-N01');
    await openMachines();
    await openProduction();
    await clickTo('Начать простой', 'S03-D10');
    await backTo('S03-M02');
    await clickTo('Начать простой', 'S03-D10');
    await selectType('S03-D12');
    await backTo('S03-D10');
  }

  const mutations = requests.filter((request) => request.method === 'POST');
  const finish = (downtimeId: string, comment: string) => Object.freeze({
    method: 'POST', path: `/machine-downtimes/${downtimeId}/finish`, body: Object.freeze({ comment, reason: comment }),
  });
  const start = (machineId: string, productionOperationId: string, comment: string) => Object.freeze({
    method: 'POST', path: '/machine-downtimes/start', body: Object.freeze({
      machine_id: machineId, downtime_type_id: 'DT-CRIT', production_operation_id: productionOperationId, comment,
    }),
  });
  const expectedMutations: readonly Readonly<{ method: string; path: string; body: unknown }>[] =
    scenarioId === 'operational-finish-from-machines'
      ? [finish('D-OP', 'Завершено начальником производства')]
      : scenarioId === 'critical-finish-from-machines'
        ? [finish('D-CRIT', 'Проверенный комментарий DOM')]
        : scenarioId === 'start-from-machine-card'
          ? [start('M-PROD', 'PO-1', 'Причина остановки DOM')]
          : scenarioId === 'start-from-downtime-section'
            ? [start('M-PROD', 'PO-1', 'Причина из раздела простоев')]
            : scenarioId === 'operational-conflict-during-machine-selection'
              ? [
                  finish('D-OP', 'Завершено начальником производства'),
                  start('M-OP', 'PO-OP', 'Причина после завершения операционного простоя'),
                ]
              : [];
  if (JSON.stringify(mutations) !== JSON.stringify(expectedMutations)) {
    throw new Error(`P1 mutation mismatch for ${scenarioId}: ${JSON.stringify(mutations)}.`);
  }
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    typed_fields: typedFields,
    pending_checks: pendingChecks,
    mutation_requests: Object.freeze(mutations),
    external_requests: 0,
  });
}

function publishP1DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p1-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP2A1DomScenarioId(
  value: string | null,
): value is Section03P2A1DomScenarioId {
  return value !== null &&
    (SECTION03_P2A1_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP2A1DomScenario(
  scenarioId: Section03P2A1DomScenarioId,
  fixture: ReturnType<typeof createBrowserP2A1FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () =>
    document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(
      () => currentNode() === nodeId ? nodeId : null,
      `P2A1 node ${nodeId}`,
    );
    visited.push(nodeId);
  };
  const findButton = (ariaLabel: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.getAttribute('aria-label') === ariaLabel);
  const button = (ariaLabel: string) => {
    const found = findButton(ariaLabel);
    if (found === undefined) {
      throw new Error(`P2A1 button not found: ${ariaLabel} at ${currentNode()}.`);
    }
    return found;
  };
  const clickTo = async (ariaLabel: string, target: Section03NodeId) => {
    const control = button(ariaLabel);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') {
      throw new Error(`P2A1 button disabled: ${ariaLabel} at ${currentNode()}.`);
    }
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const assertVisible = (ariaLabel: string, expected: boolean) => {
    const visible = findButton(ariaLabel) !== undefined;
    if (visible !== expected) {
      throw new Error(
        `P2A1 ${ariaLabel} visible=${visible}, expected ${expected} at ${currentNode()}.`,
      );
    }
  };
  const openEmployees = () =>
    clickTo('Открыть раздел Сотрудники', 'S03-E01');
  const openEmployeeCard = async () => {
    const control = await waitForDom(
      () => [...document.querySelectorAll<HTMLButtonElement>('button')]
        .find((candidate) => candidate.getAttribute('aria-label')
          ?.startsWith('Открыть карточку сотрудника ')) ?? null,
      'employee list row',
    );
    domClicks += 1;
    control.click();
    await waitNode('S03-E02');
  };
  const reloadCardWith = async (fixtureId: string) => {
    fixture.setFixture(fixtureId);
    await backTo('S03-E01');
    await openEmployeeCard();
  };

  await waitNode('S03-N01');
  await openEmployees();
  await openEmployeeCard();

  if (scenarioId === 'employee-list-card-back') {
    const actualOrder = [...document.querySelectorAll<HTMLElement>(
      '.peaks-presentation-card__line',
    )].map((line) => (
      line.querySelector<HTMLElement>('.peaks-presentation-card__label')?.textContent ??
      line.querySelector<HTMLElement>('.peaks-presentation-card__content')?.textContent ??
      ''
    ));
    const expectedOrder = [
      'Сотрудник', 'Время начала смены', 'SKU', 'Станок',
      'Поломка шпинделя', 'Комментарий', 'Время начала производства',
      'Время начала простоя', 'Продолжительность простоя',
      'Обеденный перерыв', 'Время начала перерыва',
      'Продолжительность перерыва', 'Инвентаризация инструмента',
      'Время начала доп. работы', 'Продолжительность доп. работы',
    ];
    if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
      throw new Error(`P2A1 card order mismatch: ${JSON.stringify(actualOrder)}.`);
    }
    await backTo('S03-E01');
    await backTo('S03-N01');
  } else if (scenarioId === 'employee-card-authority-and-routing') {
    if (fixture.requests.filter((request) =>
      request.path === '/manager/employees/EMP-1').length !== 1) {
      throw new Error(
        `P2A1 employee card did not use canonical EMP-1: ${JSON.stringify(fixture.requests)}.`,
      );
    }
    assertVisible('Зарплата', true);
    assertVisible('Выполненные работы', true);
    assertVisible('Завершить смену Сидоров Сергей Сергеевич', true);
    await clickTo('Зарплата', 'S03-SAL01');
    if (!fixture.requests.some((request) =>
      request.path === '/manager/employees/EMP-1/salary')) {
      throw new Error(
        `P2A1 salary route did not use canonical EMP-1: ${JSON.stringify(fixture.requests)}.`,
      );
    }
    await backTo('S03-E02');
    await clickTo('Выполненные работы', 'S03-E20');
    await backTo('S03-E02');
    await clickTo('Завершить смену Сидоров Сергей Сергеевич', 'S03-E12');
    await backTo('S03-E02');

    await reloadCardWith('S03-E02:salary-completed-denied');
    assertVisible('Зарплата', false);
    assertVisible('Выполненные работы', false);
    assertVisible('Завершить смену Смирнова Светлана Сергеевна', true);

    await reloadCardWith('S03-E02:finish-unauthorized');
    assertVisible('Зарплата', true);
    assertVisible('Выполненные работы', true);
    assertVisible('Завершить смену Кузнецов Константин Константинович', false);

    await reloadCardWith('S03-E02:no-blockers-finish-authorized');
    await clickTo('Завершить смену Петров Пётр Петрович', 'S03-E10');
    await backTo('S03-E02');
  } else {
    await clickTo('Завершить смену Сидоров Сергей Сергеевич', 'S03-E12');
    await clickTo('Производство', 'S03-E13');
    await backTo('S03-E12');
    await clickTo('Перерыв', 'S03-E16');
    await backTo('S03-E12');
    await clickTo('Доп. работа', 'S03-E17');
    fixture.resolveBlockers();
    await backTo('S03-E12');
    assertVisible('Производство', false);
    assertVisible('Перерыв', false);
    assertVisible('Доп. работа', false);
    await backTo('S03-E02');
  }

  const mutationRequests = fixture.requests.filter(
    (request) => request.method === 'POST',
  );
  if (mutationRequests.length !== 0) {
    throw new Error(`P2A1 emitted business requests: ${JSON.stringify(mutationRequests)}.`);
  }
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    mutation_requests: Object.freeze(mutationRequests),
    canonical_employee_id:
      scenarioId === 'employee-card-authority-and-routing' ? 'EMP-1' : null,
    external_requests: 0,
  });
}

function publishP2A1DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p2a1-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP2A2aDomScenarioId(
  value: string | null,
): value is Section03P2A2aDomScenarioId {
  return value !== null &&
    (SECTION03_P2A2A_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP2A2aDomScenario(
  scenarioId: Section03P2A2aDomScenarioId,
  fixture: ReturnType<typeof createBrowserP2A2aFixtureApiHarness>,
) {
  let domClicks = 0;
  let pendingChecks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () =>
    document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(
      () => currentNode() === nodeId ? nodeId : null,
      `P2A2a node ${nodeId}`,
    );
    visited.push(nodeId);
  };
  const findButton = (ariaLabel: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.getAttribute('aria-label') === ariaLabel);
  const button = (ariaLabel: string) => {
    const found = findButton(ariaLabel);
    if (found === undefined) {
      throw new Error(`P2A2a button not found: ${ariaLabel} at ${currentNode()}.`);
    }
    return found;
  };
  const clickTo = async (ariaLabel: string, target: Section03NodeId) => {
    const control = button(ariaLabel);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') {
      throw new Error(`P2A2a button disabled: ${ariaLabel} at ${currentNode()}.`);
    }
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const textarea = () => {
    const field = document.querySelector<HTMLTextAreaElement>('textarea');
    if (field === null) throw new Error(`P2A2a textarea missing at ${currentNode()}.`);
    return field;
  };
  const typeReason = async (value: string) => {
    const field = textarea();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    if (setter === undefined) throw new Error('Native textarea setter unavailable.');
    setter.call(field, value);
    field.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: value,
    }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 25));
    if (field.value !== value) throw new Error('P2A2a textarea did not accept DOM input.');
  };
  const assertVisibleText = (value: string) => {
    if (!(document.body.textContent ?? '').includes(value)) {
      throw new Error(`P2A2a visible text missing: ${value} at ${currentNode()}.`);
    }
  };
  const assertFinishVisible = (expected: boolean) => {
    const visible = findButton('Завершить смену Петров Пётр Петрович') !== undefined;
    if (visible !== expected) {
      throw new Error(`P2A2a finish visible=${visible}, expected ${expected}.`);
    }
  };
  const openForm = async () => {
    await clickTo('Открыть раздел Сотрудники', 'S03-E01');
    await clickTo(
      'Открыть карточку сотрудника Петров Пётр Петрович',
      'S03-E02',
    );
    await clickTo('Завершить смену Петров Пётр Петрович', 'S03-E10');
  };
  const clickCloseWithDuplicate = async (target?: Section03NodeId) => {
    const label = 'Завершить смену Петров Пётр Петрович';
    domClicks += 1;
    button(label).click();
    const pending = await waitForDom(() => {
      const candidate = findButton(label);
      return candidate !== undefined &&
        candidate.disabled &&
        candidate.getAttribute('aria-disabled') === 'true' &&
        candidate.getAttribute('aria-busy') === 'true'
        ? candidate
        : null;
    }, 'P2A2a pending close');
    pendingChecks += 1;
    domClicks += 1;
    pending.click();
    if (target !== undefined) await waitNode(target);
  };

  await waitNode('S03-N01');
  await openForm();
  const reason = '  Причина из реального DOM события  ';
  await typeReason('   ');
  const whitespaceNext = button('Далее');
  if (!whitespaceNext.disabled || whitespaceNext.getAttribute('aria-disabled') !== 'true') {
    throw new Error('P2A2a whitespace reason enabled Далее.');
  }
  await typeReason(reason);
  if (scenarioId === 'shift-close-authority-and-error') {
    fixture.setAuthorized(false);
  }
  await clickTo('Далее', 'S03-E11');
  assertVisibleText('Причина из реального DOM события');
  assertVisibleText('Подтвердите завершение смены:');

  if (scenarioId === 'shift-close-happy-path') {
    await clickCloseWithDuplicate('S03-E01');
  } else if (scenarioId === 'shift-close-authority-and-error') {
    assertFinishVisible(false);
    if (findButton('Назад') === undefined) {
      throw new Error('P2A2a unauthorized E11 hid Back.');
    }
    fixture.setAuthorized(true);
    await backTo('S03-E10');
    await clickTo('Далее', 'S03-E11');
    assertFinishVisible(true);
    await clickCloseWithDuplicate();
    await waitForDom(
      () => document.querySelector<HTMLElement>('[data-presentation-feedback-slot="true"]')
        ?.textContent?.includes('Не удалось выполнить действие. Обновите данные и повторите.') === true
        ? true : null,
      'P2A2a close error feedback',
    );
    if (currentNode() !== 'S03-E11') throw new Error('P2A2a failure left E11.');
    assertVisibleText('Причина из реального DOM события');
  } else {
    await backTo('S03-E10');
    if (textarea().value !== 'Причина из реального DOM события') {
      throw new Error(`P2A2a Back lost trimmed reason: ${textarea().value}.`);
    }
    await backTo('S03-E02');
    await clickTo('Завершить смену Петров Пётр Петрович', 'S03-E10');
    if (textarea().value !== '') {
      throw new Error(`P2A2a fresh E10 retained stale reason: ${textarea().value}.`);
    }
  }

  const mutations = fixture.requests.filter((request) => request.method === 'POST');
  const expectedMutations = scenarioId === 'shift-close-back-and-reset' ? 0 : 1;
  if (mutations.length !== expectedMutations) {
    throw new Error(`P2A2a mutation count ${mutations.length}, expected ${expectedMutations}.`);
  }
  if (mutations[0] !== undefined && JSON.stringify(mutations[0]) !== JSON.stringify({
    method: 'POST',
    path: '/shifts/EMP-SHIFT-CLOSE/emergency-close',
    body: { reason: 'Причина из реального DOM события' },
  })) {
    throw new Error(`P2A2a close request mismatch: ${JSON.stringify(mutations[0])}.`);
  }
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    pending_checks: pendingChecks,
    mutation_requests: Object.freeze(mutations),
    external_requests: 0,
  });
}

function publishP2A2aDomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p2a2a-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP2A2bDomScenarioId(value: string | null): value is Section03P2A2bDomScenarioId {
  return value !== null && (SECTION03_P2A2B_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP2A2bDomScenario(
  scenarioId: Section03P2A2bDomScenarioId,
  fixture: ReturnType<typeof createBrowserP2A2bFixtureApiHarness>,
) {
  let domClicks = 0;
  let pendingChecks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P2A2b node ${nodeId}`);
    visited.push(nodeId);
  };
  const findButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === label);
  const button = (label: string) => {
    const found = findButton(label);
    if (found === undefined) throw new Error(`P2A2b button not found: ${label} at ${currentNode()}.`);
    return found;
  };
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = button(label);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') {
      throw new Error(`P2A2b button disabled: ${label} at ${currentNode()}.`);
    }
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const setQuantity = async (value: string) => {
    const field = document.querySelector<HTMLInputElement>('input');
    if (field === null) throw new Error(`P2A2b quantity input missing at ${currentNode()}.`);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter === undefined) throw new Error('Native input setter unavailable.');
    setter.call(field, value);
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 25));
  };
  const mutateWithDuplicate = async (label: string, target: Section03NodeId) => {
    domClicks += 1;
    button(label).click();
    const pending = await waitForDom(() => {
      const candidate = findButton(label);
      return candidate !== undefined && candidate.disabled &&
        candidate.getAttribute('aria-disabled') === 'true' &&
        candidate.getAttribute('aria-busy') === 'true' ? candidate : null;
    }, `P2A2b pending ${label}`);
    pendingChecks += 1;
    domClicks += 1;
    pending.click();
    await waitNode(target);
  };

  await waitNode('S03-N01');
  await clickTo('Открыть раздел Сотрудники', 'S03-E01');
  await clickTo('Открыть карточку сотрудника Петров Пётр Петрович', 'S03-E02');
  await clickTo('Завершить смену Петров Пётр Петрович', 'S03-E12');

  let expectedRequest: BrowserFixtureRequest;
  let expectedTarget: Section03NodeId;
  if (scenarioId.startsWith('production-')) {
    await clickTo('Производство', 'S03-E13');
    await backTo('S03-E12');
    await clickTo('Производство', 'S03-E13');
    const next = button('Далее');
    if (!next.disabled || next.getAttribute('aria-disabled') !== 'true') throw new Error('P2A2b empty quantity enabled Далее.');
    await setQuantity('12.5000');
    await clickTo('Далее', 'S03-E14');
    await backTo('S03-E13');
    const retained = document.querySelector<HTMLInputElement>('input')?.value;
    if (retained !== '12.5') throw new Error(`P2A2b Back quantity mismatch: ${retained}.`);
    await clickTo('Далее', 'S03-E14');
    expectedTarget = scenarioId === 'production-blocker-remains' ? 'S03-E12' : 'S03-E10';
    await mutateWithDuplicate('Завершить производство', expectedTarget);
    expectedRequest = { method: 'POST', path: '/production-operations/PO-BLOCK/finish', body: {
      quantity_produced: '12.5', comment: 'Завершено начальником производства при завершении смены сотрудника',
    } };
  } else if (scenarioId === 'break-blocker-outcomes') {
    await clickTo('Перерыв', 'S03-E16');
    await backTo('S03-E12');
    await clickTo('Перерыв', 'S03-E16');
    expectedTarget = 'S03-E10';
    await mutateWithDuplicate('Завершить перерыв', expectedTarget);
    expectedRequest = { method: 'POST', path: '/operator-breaks/EMP-BLOCK/emergency-finish', body: {
      reason: 'Завершено начальником производства при завершении смены сотрудника',
    } };
  } else {
    await clickTo('Доп. работа', 'S03-E17');
    await backTo('S03-E12');
    await clickTo('Доп. работа', 'S03-E17');
    expectedTarget = 'S03-E10';
    await mutateWithDuplicate('Завершить доп. работу', expectedTarget);
    expectedRequest = { method: 'POST', path: '/additional-works/AW-BLOCK/finish', body: {
      comment: 'Завершено начальником производства при завершении смены сотрудника',
    } };
  }
  const mutations = fixture.requests.filter((request) => request.method === 'POST');
  if (mutations.length !== 1 || JSON.stringify(mutations[0]) !== JSON.stringify(expectedRequest)) {
    throw new Error(`P2A2b request mismatch: ${JSON.stringify(mutations)}.`);
  }
  return Object.freeze({
    scenario: scenarioId, status: 'PASS' as const, visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks), dom_clicks: domClicks, pending_checks: pendingChecks,
    mutation_requests: Object.freeze(mutations), outcome_target: expectedTarget, external_requests: 0,
  });
}

function publishP2A2bDomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p2a2b-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP2B1DomScenarioId(value: string | null): value is Section03P2B1DomScenarioId {
  return value !== null && (SECTION03_P2B1_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP2B1DomScenario(
  scenarioId: Section03P2B1DomScenarioId,
  fixture: ReturnType<typeof createBrowserP2B1FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P2B1 node ${nodeId}`);
    visited.push(nodeId);
  };
  const findButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === label);
  const button = (label: string) => {
    const found = findButton(label);
    if (found === undefined) throw new Error(`P2B1 button not found: ${label} at ${currentNode()}.`);
    return found;
  };
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = button(label);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') {
      throw new Error(`P2B1 button disabled: ${label} at ${currentNode()}.`);
    }
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const textAtNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const assertText = (value: string) => {
    if (!textAtNode().includes(value)) throw new Error(`P2B1 visible text missing at ${currentNode()}: ${value}.`);
  };
  const assertButton = (label: string, expected: boolean) => {
    if ((findButton(label) !== undefined) !== expected) {
      throw new Error(`P2B1 button ${label} visibility mismatch at ${currentNode()}.`);
    }
  };
  const requestCount = (path: string) => fixture.requests.filter(
    (request) => request.method === 'GET' && request.path === path,
  ).length;

  await waitNode('S03-N01');
  await clickTo('Открыть раздел Сотрудники', 'S03-E01');
  await clickTo('Открыть карточку сотрудника Анна Слесарева', 'S03-E02');
  await clickTo('Выполненные работы', 'S03-E20');

  if (scenarioId === 'completed-works-production-flow') {
    await clickTo('За сегодня', 'S03-E21');
    const listPath = '/manager/employees/EMP-1/completed-works?period=today&type=all';
    if (requestCount(listPath) !== 1) throw new Error(`P2B1 exact list GET mismatch: ${JSON.stringify(fixture.requests)}.`);
    assertText('Дата 02.08.2026');
    assertText('SKU: Корпус редуктора');
    assertText('Количество: 13');
    if (textAtNode().includes('14:30') || textAtNode().includes('12.5')) throw new Error('P2B1 list exposes a date time or fractional quantity.');
    assertText('Инвентаризация оснастки');
    await clickTo('Открыть выполненную работу WI-PROD', 'S03-E22');
    const cardPath = '/manager/employees/EMP-1/completed-works/production/OP-PROD';
    if (requestCount(cardPath) !== 1) throw new Error(`P2B1 exact card GET mismatch: ${JSON.stringify(fixture.requests)}.`);
    assertText('Корпус редуктора');
    assertText('Количество13');
    assertButton('Корректировка', true);
    assertButton('Сторно', true);
    await backTo('S03-E21');
    await backTo('S03-E20');
    await backTo('S03-E02');
  } else if (scenarioId === 'completed-works-empty-and-additional') {
    fixture.setListFixture('S03-E21:empty');
    await clickTo('За месяц', 'S03-E21');
    assertText('Нет выполненных работ за выбранный период.');
    await backTo('S03-E20');
    fixture.setListFixture('S03-E21:mixed-production-additional');
    fixture.setCardFixture('S03-E22:additional-storno');
    await clickTo('За месяц', 'S03-E21');
    await clickTo('Открыть выполненную работу WI-AW', 'S03-E22');
    assertText('Инвентаризация оснастки');
    assertButton('Корректировка', true);
    if (!button('Корректировка').disabled) throw new Error('P2B1 additional-work correction must remain visible and disabled.');
    assertButton('Сторно', true);
    const contentLine = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card__line--content')]
      .find((line) => line.textContent?.includes('Инвентаризация оснастки'));
    if (contentLine === undefined || contentLine.querySelector('.peaks-presentation-card__label') !== null) {
      throw new Error('P2B1 additional-work detail is not a content-only line.');
    }
  } else {
    await clickTo('За сегодня', 'S03-E21');
    await clickTo('Открыть выполненную работу WI-PROD', 'S03-E22');
    const beforeCorrectionMutations = fixture.requests.filter((request) => request.method !== 'GET').length;
    await clickTo('Корректировка', 'S03-CP13');
    if (fixture.requests.filter((request) => request.method !== 'GET').length !== beforeCorrectionMutations) {
      throw new Error('P2B1 Correction issued a mutation request.');
    }
    await backTo('S03-E22');
    await clickTo('Сторно', 'S03-CF24');
    if (fixture.requests.some((request) => request.method !== 'GET')) {
      throw new Error('P2B1 Storno issued a mutation request.');
    }
    fixture.setCardFixture('S03-E22:production-reversed');
    await backTo('S03-E22');
    assertButton('Корректировка', true);
    assertButton('Сторнировано', true);
    if (!button('Сторнировано').disabled) throw new Error('P2B1 reversed Storno must remain visible and disabled.');
    await backTo('S03-E21');
    fixture.setCardFixture('S03-E22:production-missing-salary-entry');
    await clickTo('Открыть выполненную работу WI-PROD', 'S03-E22');
    assertButton('Сторно', true);
    if (!button('Сторно').disabled) throw new Error('P2B1 unavailable Storno must remain visible and disabled.');
    await backTo('S03-E21');
    fixture.setCardFixture('S03-E22:additional-storno');
    await clickTo('Открыть выполненную работу WI-AW', 'S03-E22');
    assertButton('Корректировка', true);
    if (!button('Корректировка').disabled) throw new Error('P2B1 additional-work correction must remain visible and disabled.');
    assertButton('Сторно', true);
  }

  const mutations = fixture.requests.filter((request) => request.method !== 'GET');
  if (mutations.length !== 0) throw new Error(`P2B1 mutation count is ${mutations.length}.`);
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    mutation_requests: Object.freeze(mutations),
    external_requests: 0,
  });
}

function publishP2B1DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p2b1-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP2B2DomScenarioId(value: string | null): value is Section03P2B2DomScenarioId {
  return value !== null && (SECTION03_P2B2_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP2B2DomScenario(
  scenarioId: Section03P2B2DomScenarioId,
  fixture: ReturnType<typeof createBrowserP2B2FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P2B2 node ${nodeId}`);
    visited.push(nodeId);
  };
  const findButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === label);
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = findButton(label);
    if (control === undefined) throw new Error(`P2B2 button not found: ${label} at ${currentNode()}.`);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') {
      throw new Error(`P2B2 button disabled: ${label} at ${currentNode()}.`);
    }
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const textAtNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const assertText = (value: string, expected = true) => {
    if (textAtNode().includes(value) !== expected) {
      throw new Error(`P2B2 text ${JSON.stringify(value)} visibility mismatch at ${currentNode()}.`);
    }
  };
  const assertCardLines = (expected: readonly string[]) => {
    const actual = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card__line')]
      .map((line) => line.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`P2B2 card lines mismatch: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}.`);
    }
  };
  const requestCount = (path: string) => fixture.requests.filter(
    (request) => request.method === 'GET' && request.path === path,
  ).length;

  await waitNode('S03-N01');
  await clickTo('Открыть раздел Сотрудники', 'S03-E01');
  await clickTo('Открыть карточку сотрудника Мария Орлова', 'S03-E02');

  if (scenarioId === 'employee-salary-summary-history') {
    await clickTo('Зарплата', 'S03-SAL01');
    if (requestCount('/manager/employees/EMP-SALARY/salary') !== 1) {
      throw new Error(`P2B2 exact salary GET mismatch: ${JSON.stringify(fixture.requests)}.`);
    }
    assertCardLines(['СотрудникМария Орлова', 'Сегодня10000 сум', 'Неделя70000 сум', 'Месяц300000 сум']);
    assertText('Производство', false);
    await clickTo('История зарплаты', 'S03-SAL02');
    if (requestCount('/manager/employees/EMP-SALARY/salary/history') !== 1) {
      throw new Error(`P2B2 exact history GET mismatch: ${JSON.stringify(fixture.requests)}.`);
    }
    assertCardLines([
      'Июль 2026', 'Производство250000 сум', 'Доп.Работы40000 сум', 'Корректировки30000 сум', 'Сторно-10000 сум', 'Всего310000 сум',
      'Июнь 2026', 'Производство160000 сум', 'Доп.Работы20000 сум', 'Всего180000 сум',
    ]);
    await backTo('S03-SAL01');
    await backTo('S03-E02');
  } else {
    fixture.setSummaryFixture('S03-SAL01:zero-values');
    fixture.setHistoryFixture('S03-SAL02:empty');
    await clickTo('Зарплата', 'S03-SAL01');
    assertCardLines(['СотрудникМария Орлова', 'Сегодня0 сум', 'Неделя0 сум', 'Месяц0 сум']);
    await clickTo('История зарплаты', 'S03-SAL02');
    assertText('История зарплаты отсутствует.');
    await backTo('S03-SAL01');
    await backTo('S03-E02');
    fixture.setSummaryFixture('S03-SAL01:negative-values');
    fixture.setHistoryFixture('S03-SAL02:null-optionals');
    await clickTo('Зарплата', 'S03-SAL01');
    assertCardLines(['СотрудникМария Орлова', 'Сегодня-500 сум', 'Неделя-1500 сум', 'Месяц-9000 сум']);
    await clickTo('История зарплаты', 'S03-SAL02');
    assertCardLines(['Июль 2026', 'Производство250000 сум', 'Доп.Работы40000 сум', 'Всего310000 сум']);
    assertText('Корректировки', false);
    assertText('Сторно', false);
  }

  const mutations = fixture.requests.filter((request) => request.method !== 'GET');
  if (mutations.length !== 0) throw new Error(`P2B2 mutation count is ${mutations.length}.`);
  return Object.freeze({
    scenario: scenarioId, status: 'PASS' as const,
    visited: Object.freeze(visited), back_checks: Object.freeze(backChecks), dom_clicks: domClicks,
    mutation_requests: Object.freeze(mutations), external_requests: 0,
  });
}

function publishP2B2DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p2b2-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP3A1DomScenarioId(value: string | null): value is Section03P3A1DomScenarioId {
  return value !== null && (SECTION03_P3A1_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP3A1DomScenario(
  scenarioId: Section03P3A1DomScenarioId,
  fixture: ReturnType<typeof createBrowserP3A1FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P3A1 node ${nodeId}`);
    visited.push(nodeId);
  };
  const findButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === label);
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = findButton(label);
    if (control === undefined) throw new Error(`P3A1 button not found: ${label} at ${currentNode()}.`);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error(`P3A1 button disabled: ${label}.`);
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const pageText = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const assertText = (value: string, expected = true) => {
    if (pageText().includes(value) !== expected) throw new Error(`P3A1 text ${JSON.stringify(value)} mismatch at ${currentNode()}.`);
  };
  const assertCardLines = (expected: readonly string[]) => {
    const actual = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card__line')]
      .map((line) => line.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`P3A1 card lines mismatch: ${JSON.stringify(actual)}.`);
    const contentLines = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card__line--content')];
    if (contentLines.some((line) => line.querySelector('.peaks-presentation-card__label') !== null)) {
      throw new Error('P3A1 content-only line contains a label element.');
    }
  };
  const count = (method: string, path: string) => fixture.requests.filter((request) => request.method === method && request.path === path).length;

  await waitNode('S03-N01');
  await clickTo('Открыть раздел Доп. работы', 'S03-AW01');
  if (count('GET', '/manager/additional-works') !== 1) throw new Error('P3A1 initial additional works GET mismatch.');
  assertText('Запрошено'); assertText('Согласовано'); assertText('В работе'); assertText('Требуют начисления');
  await clickTo('Открыть доп. работу Пересчитать оснастку', 'S03-AW10');
  assertCardLines(['СотрудникБорис Ли', 'Вид работыПересчитать оснастку']);

  if (scenarioId === 'additional-work-request-overview-card') {
    await backTo('S03-AW01');
    await backTo('S03-N01');
  } else if (scenarioId === 'additional-work-request-approve') {
    await clickTo('Согласовать', 'S03-AW11');
    assertCardLines(['Подтвердите действие: Согласовать', 'СотрудникБорис Ли', 'Вид работыПересчитать оснастку']);
    await backTo('S03-AW10');
    await clickTo('Согласовать', 'S03-AW11');
    const control = findButton('Согласовать');
    if (control === undefined) throw new Error('P3A1 approve control missing.');
    domClicks += 1; control.click();
    await waitForDom(() => control.disabled && control.getAttribute('aria-busy') === 'true' ? true : null, 'P3A1 approve pending');
    domClicks += 1; control.click();
    await waitNode('S03-AW01');
    if (count('POST', '/additional-works/REQ-2/approve-request') !== 1) throw new Error('P3A1 approve duplicate POST.');
    if (count('GET', '/manager/additional-works') < 5) throw new Error('P3A1 approve fresh GET missing.');
    assertText('Нет доп. работ для отображения.');
  } else {
    await clickTo('Отклонить', 'S03-AW12');
    assertCardLines(['Подтвердите действие: Отклонить', 'СотрудникБорис Ли', 'Вид работыПересчитать оснастку']);
    fixture.setFailure(true);
    const failed = findButton('Отклонить');
    if (failed === undefined) throw new Error('P3A1 reject control missing.');
    domClicks += 1; failed.click();
    await waitForDom(() => document.querySelector('.peaks-presentation-feedback-block') !== null ? true : null, 'P3A1 reject feedback');
    if (currentNode() !== 'S03-AW12') throw new Error('P3A1 reject failure left AW12.');
    fixture.setFailure(false); fixture.resetList();
    const retry = findButton('Отклонить');
    if (retry === undefined) throw new Error('P3A1 reject retry missing.');
    domClicks += 1; retry.click();
    await waitForDom(() => retry.disabled && retry.getAttribute('aria-busy') === 'true' ? true : null, 'P3A1 reject pending');
    domClicks += 1; retry.click();
    await waitNode('S03-AW01');
    if (count('POST', '/additional-works/REQ-2/reject-request') !== 2) throw new Error('P3A1 reject POST count mismatch.');
    if (count('GET', '/manager/additional-works') < 4) throw new Error('P3A1 reject fresh GET missing.');
  }
  const mutations = fixture.requests.filter((request) => request.method === 'POST');
  if (scenarioId === 'additional-work-request-overview-card' && mutations.length !== 0) throw new Error('P3A1 overview mutated.');
  return Object.freeze({
    scenario: scenarioId, status: 'PASS' as const, visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks), dom_clicks: domClicks,
    mutation_requests: Object.freeze(mutations), external_requests: 0,
  });
}

function publishP3A1DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p3a1-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP3A2DomScenarioId(value: string | null): value is Section03P3A2DomScenarioId {
  return value !== null && (SECTION03_P3A2_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP3A2DomScenario(
  scenarioId: Section03P3A2DomScenarioId,
  fixture: ReturnType<typeof createBrowserP3A2FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P3A2 node ${nodeId}`);
    visited.push(nodeId);
  };
  const findButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === label);
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = findButton(label);
    if (control === undefined) throw new Error(`P3A2 button not found: ${label} at ${currentNode()}.`);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error(`P3A2 button disabled: ${label}.`);
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const count = (method: string, path: string) => fixture.requests.filter(
    (request) => request.method === method && request.path === path,
  ).length;
  const assertCardLines = (expected: readonly string[]) => {
    const actual = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card__line')]
      .map((line) => line.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`P3A2 card lines mismatch: ${JSON.stringify(actual)}.`);
    const contentLines = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card__line--content')];
    if (contentLines.some((line) => line.querySelector('.peaks-presentation-card__label') !== null)) {
      throw new Error('P3A2 content-only line contains a label element.');
    }
  };
  const assertPost = (path: string, body: Readonly<Record<string, string>>, expectedCount: number) => {
    const matching = fixture.requests.filter((request) => request.method === 'POST' && request.path === path);
    if (matching.length !== expectedCount) throw new Error(`P3A2 POST count mismatch for ${path}: ${matching.length}.`);
    if (JSON.stringify(matching.at(-1)?.body) !== JSON.stringify(body)) {
      throw new Error(`P3A2 POST body mismatch for ${path}: ${JSON.stringify(matching.at(-1)?.body)}.`);
    }
  };

  await waitNode('S03-N01');
  await clickTo('Открыть раздел Доп. работы', 'S03-AW01');
  if (count('GET', '/manager/additional-works') !== 1) throw new Error('P3A2 initial additional works GET mismatch.');

  if (scenarioId === 'additional-work-cancel-flow') {
    await clickTo('Открыть доп. работу Подготовить упаковку', 'S03-AW20');
    assertCardLines(['СотрудникВера Юн', 'Вид работыПодготовить упаковку']);
    await clickTo('Отменить', 'S03-AW21');
    assertCardLines(['Подтвердите действие: Отменить', 'СотрудникВера Юн', 'Вид работыПодготовить упаковку']);
    const control = findButton('Отменить');
    if (control === undefined) throw new Error('P3A2 cancel control missing.');
    domClicks += 1; control.click();
    await waitForDom(() => control.disabled && control.getAttribute('aria-busy') === 'true' ? true : null, 'P3A2 cancel pending');
    domClicks += 1; control.click();
    await waitNode('S03-AW01');
    assertPost('/additional-works/APP-1/cancel', { reason: 'Отменено начальником производства' }, 1);
    if (count('GET', '/manager/additional-works') < 4) throw new Error('P3A2 cancel fresh GET missing.');
  } else if (scenarioId === 'additional-work-finish-flow') {
    await clickTo('Открыть доп. работу Инвентаризация участка', 'S03-AW30');
    assertCardLines(['СотрудникГлеб Орлов', 'Вид работыИнвентаризация участка']);
    await clickTo('Завершить доп. работу', 'S03-AW31');
    assertCardLines(['Подтвердите действие: Завершить доп. работу', 'СотрудникГлеб Орлов', 'Вид работыИнвентаризация участка']);
    const control = findButton('Завершить доп. работу');
    if (control === undefined) throw new Error('P3A2 finish control missing.');
    domClicks += 1; control.click();
    await waitForDom(() => control.disabled && control.getAttribute('aria-busy') === 'true' ? true : null, 'P3A2 finish pending');
    domClicks += 1; control.click();
    await waitNode('S03-AW01');
    assertPost('/additional-works/ACT-1/finish', { comment: 'Завершено начальником производства' }, 1);
    if (count('GET', '/manager/additional-works') < 4) throw new Error('P3A2 finish fresh GET missing.');
  } else {
    await clickTo('Открыть доп. работу Проверить маркировку', 'S03-AW20');
    assertCardLines(['СотрудникИлья Серов', 'Вид работыПроверить маркировку']);
    await clickTo('Отменить', 'S03-AW21');
    fixture.setFailure(true);
    const cancel = findButton('Отменить');
    if (cancel === undefined) throw new Error('P3A2 failing cancel control missing.');
    domClicks += 1; cancel.click();
    await waitForDom(() => document.querySelector('.peaks-presentation-feedback-block') !== null ? true : null, 'P3A2 cancel feedback');
    if (currentNode() !== 'S03-AW21') throw new Error('P3A2 cancel failure left AW21.');
    assertPost('/additional-works/APP-2/cancel', { reason: 'Отменено начальником производства' }, 1);
    await backTo('S03-AW20');
    await backTo('S03-AW01');

    await clickTo('Открыть доп. работу Переместить оснастку', 'S03-AW30');
    assertCardLines(['СотрудникКира Левина', 'Вид работыПереместить оснастку']);
    await clickTo('Завершить доп. работу', 'S03-AW31');
    const finish = findButton('Завершить доп. работу');
    if (finish === undefined) throw new Error('P3A2 failing finish control missing.');
    domClicks += 1; finish.click();
    await waitForDom(() => document.querySelector('.peaks-presentation-feedback-block') !== null ? true : null, 'P3A2 finish feedback');
    if (currentNode() !== 'S03-AW31') throw new Error('P3A2 finish failure left AW31.');
    assertPost('/additional-works/ACT-2/finish', { comment: 'Завершено начальником производства' }, 1);
    await backTo('S03-AW30');
  }

  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    mutation_requests: Object.freeze(fixture.requests.filter((request) => request.method === 'POST')),
    contract_fail_closed: Object.freeze([
      'S03-AW20:missing-selected-id', 'S03-AW20:wrong-status',
      'S03-AW30:missing-selected-id', 'S03-AW30:wrong-status',
    ]),
    external_requests: 0,
  });
}

function publishP3A2DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p3a2-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP3A3DomScenarioId(value: string | null): value is Section03P3A3DomScenarioId {
  return value !== null && (SECTION03_P3A3_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP3A3DomScenario(
  scenarioId: Section03P3A3DomScenarioId,
  fixture: ReturnType<typeof createBrowserP3A3FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P3A3 node ${nodeId}`);
    visited.push(nodeId);
  };
  const findButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === label);
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = findButton(label);
    if (control === undefined) throw new Error(`P3A3 button not found: ${label} at ${currentNode()}.`);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error(`P3A3 button disabled: ${label}.`);
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const pageText = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const assertText = (value: string, expected = true) => {
    if (pageText().includes(value) !== expected) throw new Error(`P3A3 text ${JSON.stringify(value)} mismatch at ${currentNode()}.`);
  };
  const assertCardLines = (expected: readonly string[]) => {
    const actual = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card__line')]
      .map((line) => line.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`P3A3 card lines mismatch: ${JSON.stringify(actual)}.`);
    const contentLines = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card__line--content')];
    if (contentLines.some((line) => line.querySelector('.peaks-presentation-card__label') !== null)) {
      throw new Error('P3A3 content-only line contains a label element.');
    }
  };
  const count = (method: string, path: string) => fixture.requests.filter(
    (request) => request.method === method && request.path === path,
  ).length;
  const assertAssignPosts = (expectedCount: number) => {
    const matching = fixture.requests.filter((request) => request.method === 'POST' && request.path === '/additional-works/assign');
    if (matching.length !== expectedCount) throw new Error(`P3A3 assignment POST count mismatch: ${matching.length}.`);
    if (matching.some((request) => JSON.stringify(request.body) !== JSON.stringify({ employee_id: 'EMP-2', additional_work_type_id: 'TYPE-2' }))) {
      throw new Error(`P3A3 assignment body mismatch: ${JSON.stringify(matching)}.`);
    }
  };
  const navigateToConfirmation = async () => {
    await clickTo('Назначить доп. работу', 'S03-AW40');
    await clickTo('Борис Ли', 'S03-AW41');
    await clickTo('Инвентаризация участка', 'S03-AW42');
    assertCardLines(['Подтвердите назначение доп. работы:', 'СотрудникБорис Ли', 'Вид работыИнвентаризация участка']);
    assertText('[object Object]', false);
  };

  await waitNode('S03-N01');
  await clickTo('Открыть раздел Доп. работы', 'S03-AW01');
  if (count('GET', '/manager/additional-works') !== 1) throw new Error('P3A3 initial Additional Works GET mismatch.');

  if (scenarioId === 'assign-additional-work-empty-and-back') {
    await clickTo('Назначить доп. работу', 'S03-AW40');
    assertText('Нет сотрудников.');
    if (count('GET', '/manager/employees') !== 1) throw new Error('P3A3 empty employee GET mismatch.');
    await backTo('S03-AW01');
    fixture.setEmployeesEmpty(false);
    await clickTo('Назначить доп. работу', 'S03-AW40');
    fixture.setWorkTypesEmpty(true);
    await clickTo('Борис Ли', 'S03-AW41');
    assertText('Нет доступных типов доп. работ.');
    if (count('GET', '/manager/additional-work-types/available?employee_id=EMP-2') !== 1) throw new Error('P3A3 empty work-type GET mismatch.');
    await backTo('S03-AW40');
    fixture.setWorkTypesEmpty(false);
    await clickTo('Борис Ли', 'S03-AW41');
    await clickTo('Инвентаризация участка', 'S03-AW42');
    assertCardLines(['Подтвердите назначение доп. работы:', 'СотрудникБорис Ли', 'Вид работыИнвентаризация участка']);
    await backTo('S03-AW41');
    assertText('Инвентаризация участка');
    await backTo('S03-AW40');
    assertText('Борис Ли');
    assertAssignPosts(0);
  } else if (scenarioId === 'assign-additional-work-happy-path') {
    await navigateToConfirmation();
    if (
      count('GET', '/manager/employees') !== 1
      || count('GET', '/manager/additional-work-types/available?employee_id=EMP-2') !== 1
      || count('GET', '/manager/additional-work-types/available?employee_id=EMP-2&additional_work_type_id=TYPE-2') !== 1
      || count('GET', '/manager/additional-works') !== 1
    ) {
      throw new Error(`P3A3 exact pre-assignment GET mismatch: ${JSON.stringify(fixture.requests)}.`);
    }
    const assign = findButton('Назначить доп. работу');
    if (assign === undefined) throw new Error('P3A3 Assign control missing.');
    domClicks += 1; assign.click();
    await waitForDom(() => assign.disabled && assign.getAttribute('aria-busy') === 'true' ? true : null, 'P3A3 assign pending');
    domClicks += 1; assign.click();
    await waitNode('S03-AW01');
    assertAssignPosts(1);
    if (count('GET', '/manager/additional-works') !== 2) throw new Error('P3A3 fresh AW01 GET missing.');
    assertText('Нет доп. работ для отображения.');
  } else {
    await navigateToConfirmation();
    fixture.setFailure(true);
    const assign = findButton('Назначить доп. работу');
    if (assign === undefined) throw new Error('P3A3 failing Assign control missing.');
    domClicks += 1; assign.click();
    await waitForDom(() => document.querySelector('.peaks-presentation-feedback-block') !== null ? true : null, 'P3A3 assignment feedback');
    if (currentNode() !== 'S03-AW42') throw new Error('P3A3 assignment failure left AW42.');
    const feedback = document.querySelector<HTMLElement>('.peaks-presentation-feedback-block')?.textContent ?? '';
    if (!feedback.includes('Такая доп. работа уже назначена этому сотруднику и ещё не завершена.')) {
      throw new Error(`P3A3 exact assignment feedback missing: ${JSON.stringify(feedback)}.`);
    }
    assertCardLines(['Подтвердите назначение доп. работы:', 'СотрудникБорис Ли', 'Вид работыИнвентаризация участка']);
    assertAssignPosts(1);
    if (
      count('GET', '/manager/additional-works') !== 2 ||
      count('GET', '/manager/employees') !== 2 ||
      count('GET', '/manager/additional-work-types/available?employee_id=EMP-2') !== 1 ||
      count('GET', '/manager/additional-work-types/available?employee_id=EMP-2&additional_work_type_id=TYPE-2') !== 2
    ) throw new Error(`P3A3 authoritative conflict refresh mismatch: ${JSON.stringify(fixture.requests)}.`);
    fixture.setFailure(false);
    const retry = findButton('Назначить доп. работу');
    if (retry === undefined) throw new Error('P3A3 assignment retry missing.');
    domClicks += 1; retry.click();
    await waitNode('S03-AW01');
    assertAssignPosts(2);
    const invalidContexts = [
      { employee_id: 'EMP-2', additional_work_type_id: 'TYPE-2', additional_work_type_name: 'Инвентаризация участка' },
      { employee_id: 'EMP-2', employee_full_name: 'Борис Ли', additional_work_type_id: 'TYPE-2' },
    ];
    for (const context of invalidContexts) {
      const invalidRuntime = createGraphActivationRuntime(createSection03Program(fixture.apiClient));
      const state = await invalidRuntime.activate({ nodeId: 'S03-AW42', context });
      if (state.status !== 'error') throw new Error(`P3A3 missing display context did not fail: ${JSON.stringify(context)}.`);
    }
  }

  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    mutation_requests: Object.freeze(fixture.requests.filter((request) => request.method === 'POST')),
    contract_fail_closed: Object.freeze(['S03-AW42:missing-employee-name', 'S03-AW42:missing-type-name']),
    external_requests: 0,
  });
}

function publishP3A3DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p3a3-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP3A4DomScenarioId(value: string | null): value is Section03P3A4DomScenarioId {
  return value !== null && (SECTION03_P3A4_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP3A4DomScenario(
  scenarioId: Section03P3A4DomScenarioId,
  fixture: ReturnType<typeof createBrowserP3A4FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P3A4 node ${nodeId}`);
    visited.push(nodeId);
  };
  const findButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === label);
  const button = (label: string) => {
    const found = findButton(label);
    if (found === undefined) throw new Error(`P3A4 button not found: ${label} at ${currentNode()}.`);
    return found;
  };
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = button(label);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error(`P3A4 button disabled: ${label}.`);
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const setField = async (value: string) => {
    const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea');
    if (field === null) throw new Error(`P3A4 field missing at ${currentNode()}.`);
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter === undefined) throw new Error('P3A4 native field setter unavailable.');
    setter.call(field, value);
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 25));
    if (field.value !== value) throw new Error(`P3A4 field rejected ${JSON.stringify(value)}.`);
  };
  const pageText = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const assertText = (value: string) => {
    if (!pageText().includes(value)) throw new Error(`P3A4 text missing: ${JSON.stringify(value)} at ${currentNode()}.`);
  };
  const assertCardLines = (expected: readonly string[]) => {
    const actual = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card__line')]
      .map((line) => line.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`P3A4 card lines mismatch: ${JSON.stringify(actual)}.`);
    const contentLines = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-card__line--content')];
    if (contentLines.some((line) => line.querySelector('.peaks-presentation-card__label') !== null)) {
      throw new Error('P3A4 content-only line contains a label element.');
    }
  };
  const count = (method: string, path: string) => fixture.requests.filter(
    (request) => request.method === method && request.path === path,
  ).length;
  const assertPost = (path: string, body: unknown, expectedCount: number) => {
    const matching = fixture.requests.filter((request) => request.method === 'POST' && request.path === path);
    if (matching.length !== expectedCount || matching.some((request) => JSON.stringify(request.body) !== JSON.stringify(body))) {
      throw new Error(`P3A4 POST mismatch: ${JSON.stringify(matching)}.`);
    }
  };
  const openWaitingCard = async () => {
    await clickTo('Открыть доп. работу Подготовить упаковку', 'S03-AW50');
    assertCardLines(['СотрудникВера Юн', 'Вид работыПодготовить упаковку']);
  };
  const openAccrualConfirmation = async () => {
    await clickTo('Начислить зарплату', 'S03-AW51');
    for (const invalid of ['', '12..5', '0', '-5']) {
      await setField(invalid);
      if (!button('Далее').disabled) throw new Error(`P3A4 invalid amount enabled Next: ${JSON.stringify(invalid)}.`);
    }
    await setField('12500,50');
    if (button('Далее').disabled) throw new Error('P3A4 comma decimal did not enable Next.');
    await clickTo('Далее', 'S03-AW52');
    assertCardLines(['Подтвердите начисление зарплаты:', 'СотрудникВера Юн', 'Вид работыПодготовить упаковку', 'Начисленная зарплата12501 сум']);
  };
  const openWithoutAccrualConfirmation = async () => {
    await clickTo('Без начисления', 'S03-AW53');
    await setField('   ');
    if (!button('Далее').disabled) throw new Error('P3A4 whitespace reason enabled Next.');
    await setField('  Работа учтена без начисления  ');
    await clickTo('Далее', 'S03-AW54');
    assertCardLines(['Подтвердите закрытие без начисления:', 'СотрудникВера Юн', 'Вид работыПодготовить упаковку', 'КомментарийРабота учтена без начисления']);
  };

  await waitNode('S03-N01');
  await clickTo('Открыть раздел Доп. работы', 'S03-AW01');
  if (count('GET', '/manager/additional-works') !== 1) throw new Error('P3A4 initial Additional Works GET mismatch.');
  await openWaitingCard();

  if (scenarioId === 'additional-work-accrual-happy-path') {
    await openAccrualConfirmation();
    const confirm = button('Начислить зарплату');
    domClicks += 1; confirm.click();
    await waitForDom(() => confirm.disabled && confirm.getAttribute('aria-busy') === 'true' ? true : null, 'P3A4 accrual pending');
    domClicks += 1; confirm.click();
    await waitNode('S03-AW01');
    assertPost('/additional-works/WAIT-1/accrue-salary', { amount_uzs: '12500.5', quantity: null }, 1);
    if (count('GET', '/manager/additional-works') !== 4) throw new Error('P3A4 fresh AW01 GET missing after accrual.');
    assertText('Требуют начисленияНет работ');
  } else if (scenarioId === 'additional-work-no-accrual-happy-path') {
    await openWithoutAccrualConfirmation();
    const confirm = button('Закрыть без начисления');
    domClicks += 1; confirm.click();
    await waitForDom(() => confirm.disabled && confirm.getAttribute('aria-busy') === 'true' ? true : null, 'P3A4 no-accrual pending');
    domClicks += 1; confirm.click();
    await waitNode('S03-AW01');
    assertPost('/additional-works/WAIT-1/mark-without-accrual', { reason: 'Работа учтена без начисления' }, 1);
    if (count('GET', '/manager/additional-works') !== 4) throw new Error('P3A4 fresh AW01 GET missing after no-accrual close.');
  } else {
    await openAccrualConfirmation();
    fixture.setFailure(true);
    domClicks += 1; button('Начислить зарплату').click();
    await waitForDom(() => document.querySelector('.peaks-presentation-feedback-block') !== null ? true : null, 'P3A4 accrual failure');
    if (currentNode() !== 'S03-AW52') throw new Error('P3A4 accrual failure left AW52.');
    await backTo('S03-AW51');
    const restoredAmount = document.querySelector<HTMLInputElement>('input')?.value;
    if (restoredAmount !== '12500.5') throw new Error(`P3A4 amount restore mismatch: ${restoredAmount}.`);
    await backTo('S03-AW50');
    await openWithoutAccrualConfirmation();
    domClicks += 1; button('Закрыть без начисления').click();
    await waitForDom(() =>
      count('POST', '/additional-works/WAIT-1/mark-without-accrual') === 1 && !button('Закрыть без начисления').disabled
        ? true
        : null,
    'P3A4 no-accrual failure');
    if (currentNode() !== 'S03-AW54') throw new Error('P3A4 no-accrual failure left AW54.');
    await backTo('S03-AW53');
    const restoredReason = document.querySelector<HTMLTextAreaElement>('textarea')?.value;
    if (restoredReason !== 'Работа учтена без начисления') throw new Error(`P3A4 reason restore mismatch: ${restoredReason}.`);
    await backTo('S03-AW50');
    await backTo('S03-AW01');
    for (const fixtureId of ['S03-AW50:missing-selected-id', 'S03-AW50:wrong-status']) {
      const invalidFixture = SECTION03_P3A4_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId)!;
      const runtime = createGraphActivationRuntime(createSection03Program(createBrowserP3A4VariantApiClient(fixtureId)));
      const ready = await runtime.activate({ nodeId: invalidFixture.nodeId, context: invalidFixture.context });
      if (ready.status !== 'ready') throw new Error(`P3A4 fail-closed setup failed: ${fixtureId}.`);
      const binding = createSection03RuntimeBinding({
        runtime, presentationExecution: createGraphPresentationExecutionRuntime(runtime), nodeId: invalidFixture.nodeId,
        onInteractionStateChange: () => undefined,
      });
      let failedClosed = false;
      try {
        createSection03ScreenProjection({ nodeId: invalidFixture.nodeId, ready, actionFactory: binding.actionFactory } as never);
      } catch {
        failedClosed = true;
      }
      if (!failedClosed) throw new Error(`P3A4 fixture did not fail closed: ${fixtureId}.`);
    }
  }

  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    mutation_requests: Object.freeze(fixture.requests.filter((request) => request.method === 'POST')),
    contract_fail_closed: Object.freeze(['S03-AW50:missing-selected-id', 'S03-AW50:wrong-status']),
    external_requests: 0,
  });
}

function publishP3A4DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p3a4-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP4A1DomScenarioId(value: string | null): value is Section03P4A1DomScenarioId {
  return value !== null && (SECTION03_P4A1_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP4A1DomScenario(
  scenarioId: Section03P4A1DomScenarioId,
  fixture: ReturnType<typeof createBrowserP4A1FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P4A1 node ${nodeId}`);
    visited.push(nodeId);
  };
  const findButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === label);
  const button = (label: string) => {
    const found = findButton(label);
    if (found === undefined) throw new Error(`P4A1 button not found: ${label} at ${currentNode()}.`);
    return found;
  };
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = button(label);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error(`P4A1 button disabled: ${label}.`);
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const pageText = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const assertText = (value: string, expected = true) => {
    if (pageText().includes(value) !== expected) throw new Error(`P4A1 text ${JSON.stringify(value)} mismatch at ${currentNode()}.`);
  };
  const assertScrollButtonOrder = (expected: readonly string[]) => {
    const actual = [...document.querySelectorAll<HTMLButtonElement>('.peaks-presentation-screen-template__scroll button')]
      .map((control) => control.getAttribute('aria-label'));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`P4A1 scroll order mismatch: ${JSON.stringify(actual)}.`);
    }
  };
  const count = (method: string, path: string) => fixture.requests.filter(
    (request) => request.method === method && request.path === path,
  ).length;
  const openEmployeeSelection = async () => {
    await clickTo('Открыть раздел Корректировки', 'S03-C00');
    assertScrollButtonOrder(['Финансы', 'Производство']);
    await clickTo('Финансы', 'S03-CF01');
    assertScrollButtonOrder(['Корректировка по сотруднику', 'Сторно по операции']);
    await clickTo('Корректировка по сотруднику', 'S03-CF10');
  };

  await waitNode('S03-N01');
  await openEmployeeSelection();

  const failClosed = async (fixtureId: 'S03-CF11:missing-employee' | 'S03-CF11:shift-id-mismatch') => {
    const invalidFixture = SECTION03_P4A1_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId)!;
    const runtime = createGraphActivationRuntime(createSection03Program(createBrowserP4A1VariantApiClient(fixtureId)));
    const ready = await runtime.activate({ nodeId: invalidFixture.nodeId, context: invalidFixture.context });
    if (ready.status !== 'ready') throw new Error(`P4A1 fail-closed setup failed: ${fixtureId}.`);
    const binding = createSection03RuntimeBinding({
      runtime,
      presentationExecution: createGraphPresentationExecutionRuntime(runtime),
      nodeId: invalidFixture.nodeId,
      onInteractionStateChange: () => undefined,
    });
    try {
      createSection03ScreenProjection({
        nodeId: invalidFixture.nodeId,
        ready,
        actionFactory: binding.actionFactory,
      } as never);
    } catch {
      return;
    }
    throw new Error(`P4A1 fixture did not fail closed: ${fixtureId}.`);
  };

  if (scenarioId === 'corrections-entry-financial-menu') {
    assertScrollButtonOrder(['Анна Ким', 'Борис Ли']);
    if (count('GET', '/manager/salary-correction-context') !== 1) throw new Error('P4A1 CF10 GET count mismatch.');
    await backTo('S03-CF01');
    await backTo('S03-C00');
    await backTo('S03-N01');
  } else if (scenarioId === 'financial-correction-employee-modes') {
    assertScrollButtonOrder(['Анна Ким', 'Борис Ли']);
    await clickTo('Борис Ли', 'S03-CF11');
    if (count('GET', '/manager/salary-correction-context') !== 2) throw new Error('P4A1 CF11 fresh GET count mismatch.');
    assertText('Борис Ли');
    assertText('Анна Ким', false);
    await clickTo('Начислить', 'S03-CF12');
    await backTo('S03-CF11');
    assertText('Борис Ли');
    await clickTo('Удержать', 'S03-CF12');
  } else {
    assertText('Нет сотрудников со сменой за текущий день.');
    assertScrollButtonOrder([]);
    await failClosed('S03-CF11:missing-employee');
    await failClosed('S03-CF11:shift-id-mismatch');
    await backTo('S03-CF01');
    fixture.setCorrectionContext(P4A1_FINISHED_RESPONSE);
    await clickTo('Корректировка по сотруднику', 'S03-CF10');
    assertScrollButtonOrder(['Вера Юн']);
    await clickTo('Вера Юн', 'S03-CF11');
    assertText('Вера Юн');
    await backTo('S03-CF10');
    assertScrollButtonOrder(['Вера Юн']);
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    if (currentNode() !== 'S03-CF10') throw new Error('P4A1 CF10 auto-selected after Back.');
  }

  const mutationRequests = fixture.requests.filter((request) => request.method === 'POST');
  if (mutationRequests.length !== 0) throw new Error(`P4A1 unexpected POST: ${JSON.stringify(mutationRequests)}.`);
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    correction_context_gets: count('GET', '/manager/salary-correction-context'),
    mutation_requests: Object.freeze(mutationRequests),
    settled_scalar_context: scenarioId === 'financial-correction-employee-modes'
      ? Object.freeze({
          employee_id: 'EMP-2',
          employee_shift_id: 'SHIFT-2',
          accrual: Object.freeze({ correction_mode: 'accrual', salary_correction_type_id: 'TYPE-ACCRUAL' }),
          withholding: Object.freeze({ correction_mode: 'withholding', salary_correction_type_id: 'TYPE-WITHHOLDING' }),
        })
      : null,
    contract_fail_closed: scenarioId === 'financial-correction-empty-identity-back'
      ? Object.freeze(['S03-CF11:missing-employee', 'S03-CF11:shift-id-mismatch'])
      : Object.freeze([]),
    external_requests: 0,
  });
}

function publishP4A1DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p4a1-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP4A2DomScenarioId(value: string | null): value is Section03P4A2DomScenarioId {
  return value !== null && (SECTION03_P4A2_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP4A2DomScenario(
  scenarioId: Section03P4A2DomScenarioId,
  fixture: ReturnType<typeof createBrowserP4A2FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P4A2 node ${nodeId}`);
    visited.push(nodeId);
  };
  const button = (label: string) => {
    const found = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.getAttribute('aria-label') === label);
    if (found === undefined) throw new Error(`P4A2 button not found: ${label} at ${currentNode()}.`);
    return found;
  };
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = button(label);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error(`P4A2 button disabled: ${label}.`);
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const setField = async (value: string) => {
    const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea');
    if (field === null) throw new Error(`P4A2 field missing at ${currentNode()}.`);
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter === undefined) throw new Error('P4A2 native field setter unavailable.');
    setter.call(field, value);
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 25));
  };
  const pageText = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const assertText = (value: string) => {
    if (!pageText().includes(value)) throw new Error(`P4A2 text missing: ${JSON.stringify(value)} at ${currentNode()}.`);
  };
  const openCorrection = async (mode: 'Начислить' | 'Удержать') => {
    await clickTo('Открыть раздел Корректировки', 'S03-C00');
    await clickTo('Финансы', 'S03-CF01');
    await clickTo('Корректировка по сотруднику', 'S03-CF10');
    await clickTo('Анна Ким', 'S03-CF11');
    await clickTo(mode, 'S03-CF12');
  };
  const fillAndConfirm = async () => {
    for (const invalid of ['', '12..5', '0', '-5']) {
      await setField(invalid);
      if (!button('Далее').disabled) throw new Error(`P4A2 invalid amount enabled Next: ${JSON.stringify(invalid)}.`);
    }
    await setField('12500,50');
    await clickTo('Далее', 'S03-CF13');
    await setField('  Подтверждённая корректировка  ');
    await clickTo('Далее', 'S03-CF14');
    assertText('Анна Ким');
    assertText('12501');
    assertText('Подтверждённая корректировка');
  };
  const assertPosts = (amount: string, expectedApplies: number) => {
    const applies = fixture.requests.filter((request) => request.method === 'POST' && request.path === '/salary-corrections/apply');
    if (applies.length !== expectedApplies) {
      throw new Error(`P4A2 POST counts mismatch: ${JSON.stringify({ applies })}.`);
    }
    const expectedBody = {
      employee_id: 'EMP-1', employee_shift_id: 'SHIFT-1',
      salary_correction_type_id: amount.startsWith('-') ? 'TYPE-WITHHOLDING' : 'TYPE-ACCRUAL',
      amount, reason: 'Подтверждённая корректировка',
    };
    if (applies.some((request) => JSON.stringify(request.body) !== JSON.stringify(expectedBody))) {
      throw new Error(`P4A2 apply body mismatch: ${JSON.stringify(applies)}.`);
    }
  };
  const failClosed = async (fixtureId: 'S03-CF14:missing-open-corrections' | 'S03-CF14:stale-accrual-type') => {
    const invalid = SECTION03_P4A2_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId)!;
    const runtime = createGraphActivationRuntime(createSection03Program(createBrowserP4A2VariantApiClient(fixtureId)));
    const ready = await runtime.activate({ nodeId: invalid.nodeId, context: invalid.context });
    if (ready.status !== 'ready') return;
    const binding = createSection03RuntimeBinding({
      runtime, presentationExecution: createGraphPresentationExecutionRuntime(runtime), nodeId: invalid.nodeId,
      onInteractionStateChange: () => undefined,
    });
    try {
      createSection03ScreenProjection({ nodeId: invalid.nodeId, ready, actionFactory: binding.actionFactory } as never);
    } catch {
      return;
    }
    throw new Error(`P4A2 fixture did not fail closed: ${fixtureId}.`);
  };

  await waitNode('S03-N01');
  if (scenarioId === 'financial-correction-accrual-success') {
    await openCorrection('Начислить');
    await fillAndConfirm();
    assertText('Начисление');
    const confirm = button('Начислить');
    domClicks += 1; confirm.click();
    await waitNode('S03-C00');
    assertPosts('12500.5', 1);
  } else if (scenarioId === 'financial-correction-withholding-back-pending') {
    await openCorrection('Удержать');
    await fillAndConfirm();
    assertText('Удержание');
    assertText('-12501');
    await backTo('S03-CF13');
    if (document.querySelector<HTMLTextAreaElement>('textarea')?.value !== 'Подтверждённая корректировка') throw new Error('P4A2 comment Back restore mismatch.');
    await backTo('S03-CF12');
    if (document.querySelector<HTMLInputElement>('input')?.value !== '12500.5') throw new Error('P4A2 amount Back restore mismatch.');
    await waitForDom(() => !button('Далее').disabled ? true : null, 'P4A2 restored amount validation');
    await clickTo('Далее', 'S03-CF13');
    await setField('Подтверждённая корректировка');
    await waitForDom(() => !button('Далее').disabled ? true : null, 'P4A2 re-entered comment validation');
    await clickTo('Далее', 'S03-CF14');
    const confirm = button('Удержать');
    domClicks += 1; confirm.click();
    await waitForDom(() => confirm.disabled && confirm.getAttribute('aria-busy') === 'true' ? true : null, 'P4A2 pending confirmation');
    domClicks += 1; confirm.click();
    await waitNode('S03-C00');
    assertPosts('-12500.5', 1);
  } else {
    await failClosed('S03-CF14:missing-open-corrections');
    await failClosed('S03-CF14:stale-accrual-type');
    await openCorrection('Начислить');
    await fillAndConfirm();
    fixture.setFailure('apply');
    domClicks += 1; button('Начислить').click();
    await waitForDom(() => document.querySelector('.peaks-presentation-feedback-block') !== null ? true : null, 'P4A2 create failure feedback');
    if (currentNode() !== 'S03-CF14') throw new Error('P4A2 create failure left CF14.');
    assertText('Подтвердите корректировку:');
    assertPosts('12500.5', 1);
    fixture.setFailure('none');
    domClicks += 1; button('Начислить').click();
    await waitNode('S03-C00');
    assertPosts('12500.5', 2);
  }
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    mutation_requests: Object.freeze(fixture.requests.filter((request) => request.method === 'POST')),
    contract_fail_closed: Object.freeze(['S03-CF14:missing-open-corrections', 'S03-CF14:stale-accrual-type']),
    external_requests: 0,
  });
}

function publishP4A2DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p4a2-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP4A3DomScenarioId(value: string | null): value is Section03P4A3DomScenarioId {
  return value !== null && (SECTION03_P4A3_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP4A3DomScenario(
  scenarioId: Section03P4A3DomScenarioId,
  fixture: ReturnType<typeof createBrowserP4A3FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const contractFailClosed: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P4A3 node ${nodeId}`);
    visited.push(nodeId);
  };
  const findButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === label);
  const button = (label: string) => {
    const found = findButton(label);
    if (found === undefined) throw new Error(`P4A3 button not found: ${label} at ${currentNode()}.`);
    return found;
  };
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = button(label);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error(`P4A3 button disabled: ${label}.`);
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const setReason = async (value: string) => {
    const field = document.querySelector<HTMLTextAreaElement>('textarea');
    if (field === null) throw new Error(`P4A3 textarea missing at ${currentNode()}.`);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter === undefined) throw new Error('P4A3 native textarea setter unavailable.');
    setter.call(field, value);
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForDom(() => !button('Далее').disabled ? true : null, 'P4A3 valid reason');
  };
  const pageText = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const assertText = (value: string, expected = true) => {
    if (pageText().includes(value) !== expected) throw new Error(`P4A3 text ${JSON.stringify(value)} mismatch at ${currentNode()}.`);
  };
  const reversePosts = () => fixture.requests.filter(
    (request) => request.method === 'POST' && request.path.startsWith('/salary-entries/'),
  );
  const openReversal = async (work: 'production' | 'additional') => {
    await clickTo('Открыть раздел Корректировки', 'S03-C00');
    await clickTo('Финансы', 'S03-CF01');
    await clickTo('Сторно по операции', 'S03-CF20');
    await clickTo('Выбрать сотрудника Мария Орлова', 'S03-CF21');
    await clickTo('За сегодня', 'S03-CF22');
    await clickTo(
      work === 'production' ? 'Открыть выполненную работу WI-REV-PROD' : 'Открыть выполненную работу WI-REV-AW',
      'S03-CF23',
    );
  };
  const enterConfirmation = async (reason = '  Подтверждённая причина сторно  ') => {
    await clickTo('Сторно', 'S03-CF24');
    await setReason(reason);
    await clickTo('Далее', 'S03-CF25');
    assertText('Подтвердите сторно:');
    assertText('Мария Орлова');
    assertText('Комментарий');
  };
  const failClosed = async (fixtureId: 'S03-CF25:missing-authority' | 'S03-CF25:salary-entry-mismatch') => {
    const invalid = SECTION03_P4A3_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId)!;
    const runtime = createGraphActivationRuntime(createSection03Program(createBrowserP4A3VariantApiClient(fixtureId)));
    const ready = await runtime.activate({ nodeId: invalid.nodeId, context: invalid.context });
    if (ready.status === 'ready') {
      const binding = createSection03RuntimeBinding({
        runtime,
        presentationExecution: createGraphPresentationExecutionRuntime(runtime),
        nodeId: invalid.nodeId,
        onInteractionStateChange: () => undefined,
      });
      try {
        createSection03ScreenProjection({ nodeId: invalid.nodeId, ready, actionFactory: binding.actionFactory } as never);
      } catch {
        contractFailClosed.push(fixtureId);
        return;
      }
    }
    if (ready.status !== 'ready') {
      contractFailClosed.push(fixtureId);
      return;
    }
    throw new Error(`P4A3 fixture did not fail closed: ${fixtureId}.`);
  };

  await waitNode('S03-N01');
  if (scenarioId === 'financial-reversal-production-success') {
    await openReversal('production');
    await enterConfirmation();
    assertText('Вал приводной');
    assertText('90000 сум');
    const confirm = button('Сторно');
    domClicks += 1;
    confirm.click();
    await waitNode('S03-C00');
    const posts = reversePosts();
    if (posts.length !== 1 || posts[0]?.path !== '/salary-entries/SAL-REV-1/reverse' ||
      JSON.stringify(posts[0]?.body) !== JSON.stringify({ reason: 'Подтверждённая причина сторно' })) {
      throw new Error(`P4A3 production POST mismatch: ${JSON.stringify(posts)}.`);
    }
  } else if (scenarioId === 'financial-reversal-additional-back-pending') {
    await openReversal('additional');
    await enterConfirmation();
    await backTo('S03-CF24');
    if (document.querySelector<HTMLTextAreaElement>('textarea')?.value !== 'Подтверждённая причина сторно') {
      throw new Error('P4A3 reversal reason was not restored after confirmation Back.');
    }
    await backTo('S03-CF23');
    await enterConfirmation('Подтверждённая причина сторно');
    const confirm = button('Сторно');
    domClicks += 1;
    confirm.click();
    await waitForDom(() => confirm.disabled && confirm.getAttribute('aria-busy') === 'true' ? true : null, 'P4A3 pending confirmation');
    domClicks += 1;
    confirm.click();
    await waitNode('S03-C00');
    if (reversePosts().length !== 1) throw new Error(`P4A3 pending duplicate POST mismatch: ${JSON.stringify(reversePosts())}.`);
  } else {
    const alreadyReversed = SECTION03_P4A3_FIXTURES.find((candidate) => candidate.fixtureId === 'S03-CF23:already-reversed')!;
    fixture.setCardResponse(alreadyReversed.primaryResponse as Parameters<typeof fixture.setCardResponse>[0]);
    await openReversal('production');
    assertText('Сторно', false);
    if (findButton('Сторно') !== undefined) throw new Error('P4A3 reversed work exposed reversal entry.');
    await failClosed('S03-CF25:missing-authority');
    await failClosed('S03-CF25:salary-entry-mismatch');
    fixture.setCardResponse(null);
    await backTo('S03-CF22');
    await clickTo('Открыть выполненную работу WI-REV-PROD', 'S03-CF23');
    await enterConfirmation();
    fixture.setFailure(true);
    domClicks += 1;
    button('Сторно').click();
    await waitForDom(() => document.querySelector('.peaks-presentation-feedback-block') !== null ? true : null, 'P4A3 reversal failure feedback');
    if (currentNode() !== 'S03-CF25') throw new Error('P4A3 POST failure left CF25.');
    assertText('Подтвердите сторно:');
    if (reversePosts().length !== 1) throw new Error(`P4A3 failure POST mismatch: ${JSON.stringify(reversePosts())}.`);
  }
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    mutation_requests: Object.freeze(reversePosts()),
    contract_fail_closed: Object.freeze(contractFailClosed),
    external_requests: 0,
  });
}

function publishP4A3DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p4a3-dom-scenario-result';
  output.hidden = true;
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP4A4DomScenarioId(value: string | null): value is Section03P4A4DomScenarioId {
  return value !== null && (SECTION03_P4A4_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP4A4DomScenario(
  scenarioId: Section03P4A4DomScenarioId,
  fixture: ReturnType<typeof createBrowserP4A4FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const contractFailClosed: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P4A4 node ${nodeId}`);
    visited.push(nodeId);
  };
  const findButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === label);
  const button = (label: string) => {
    const found = findButton(label);
    if (found === undefined) throw new Error(`P4A4 button not found: ${label} at ${currentNode()}.`);
    return found;
  };
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = button(label);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error(`P4A4 button disabled: ${label}.`);
    domClicks += 1;
    control.click();
    await waitNode(target);
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const setField = async (value: string) => {
    const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea');
    if (field === null) throw new Error(`P4A4 form field missing at ${currentNode()}.`);
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter === undefined) throw new Error('P4A4 native field setter unavailable.');
    setter.call(field, value);
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForDom(() => !button('Далее').disabled ? true : null, 'P4A4 valid form field');
  };
  const pageText = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const assertText = (value: string, expected = true) => {
    if (pageText().includes(value) !== expected) throw new Error(`P4A4 text ${JSON.stringify(value)} mismatch at ${currentNode()}.`);
  };
  const correctionPosts = () => fixture.requests.filter(
    (request) => request.method === 'POST' && request.path === '/production-operation-corrections/apply',
  );
  const openCorrection = async (scope: 'employee' | 'machine') => {
    await clickTo('Открыть раздел Корректировки', 'S03-C00');
    await clickTo('Производство', 'S03-CP00');
    await clickTo(scope === 'employee' ? 'По сотруднику' : 'По станку', scope === 'employee' ? 'S03-CP10' : 'S03-CP20');
    await clickTo(
      scope === 'employee'
        ? 'Выбрать сотрудника Анна Производственная'
        : 'Выбрать станок Станок производственной корректировки',
      'S03-CP11',
    );
    await clickTo('За сегодня', 'S03-CP12');
    await clickTo(
      'Выбрать производственную операцию: дата 03.08.2026, SKU Корпус редуктора, станок Станок производственной корректировки',
      'S03-CP13',
    );
  };
  const enterConfirmation = async (mode: 'Увеличить' | 'Уменьшить' | 'Указать итоговое количество', quantity: string, reason: string) => {
    await clickTo(mode, 'S03-CP14');
    await setField(quantity);
    await clickTo('Далее', 'S03-CP15');
    await setField(reason);
    await clickTo('Далее', 'S03-CP16');
  };
  const assertPost = (newQuantity: string) => {
    const posts = correctionPosts();
    const expected = {
      production_operation_id: 'PROD-1', old_quantity: '10', new_quantity: newQuantity,
      reason: 'Подтверждённая производственная корректировка',
    };
    if (posts.length !== 1 || JSON.stringify(posts[0]?.body) !== JSON.stringify(expected)) {
      throw new Error(`P4A4 POST mismatch: ${JSON.stringify(posts)}.`);
    }
  };
  const failClosed = async (fixtureId: 'S03-CP16:source-scope-mismatch' | 'S03-CP16:missing-authority' | 'S03-CP16:negative-result') => {
    const invalid = SECTION03_P4A4_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId)!;
    const runtime = createGraphActivationRuntime(createSection03Program(createBrowserP4A4VariantApiClient(fixtureId)));
    const ready = await runtime.activate({ nodeId: invalid.nodeId, context: invalid.context });
    if (ready.status === 'ready') {
      const binding = createSection03RuntimeBinding({
        runtime,
        presentationExecution: createGraphPresentationExecutionRuntime(runtime),
        nodeId: invalid.nodeId,
        onInteractionStateChange: () => undefined,
      });
      try {
        createSection03ScreenProjection({ nodeId: invalid.nodeId, ready, actionFactory: binding.actionFactory } as never);
      } catch {
        contractFailClosed.push(fixtureId);
        return;
      }
    }
    if (ready.status !== 'ready') {
      contractFailClosed.push(fixtureId);
      return;
    }
    throw new Error(`P4A4 fixture did not fail closed: ${fixtureId}.`);
  };

  await waitNode('S03-N01');
  if (scenarioId === 'production-correction-employee-increase-success') {
    await openCorrection('employee');
    await enterConfirmation('Увеличить', '2,5', '  Подтверждённая производственная корректировка  ');
    ['Старое количество10', 'Корректировка+3', 'Новое количество13'].forEach((value) => assertText(value));
    assertText('Подтверждённая производственная корректировка', false);
    await clickTo('Корректировать', 'S03-C00');
    assertPost('12.5');
  } else if (scenarioId === 'production-correction-machine-decrease-pre-mutation') {
    await openCorrection('machine');
    await enterConfirmation('Уменьшить', '2,5', '  Подтверждённая производственная корректировка  ');
    await backTo('S03-CP15');
    if (document.querySelector<HTMLTextAreaElement>('textarea')?.value !== 'Подтверждённая производственная корректировка') {
      throw new Error('P4A4 reason was not restored after confirmation Back.');
    }
    await backTo('S03-CP14');
    if (document.querySelector<HTMLInputElement>('input')?.value !== '2.5') {
      throw new Error('P4A4 quantity was not restored after comment Back.');
    }
    await clickTo('Далее', 'S03-CP15');
    await setField('Подтверждённая производственная корректировка');
    await clickTo('Далее', 'S03-CP16');
    ['Старое количество10', 'Корректировка-2', 'Новое количество8'].forEach((value) => assertText(value));
    if (button('Корректировать').disabled) throw new Error('P4A4 valid machine confirmation action is disabled.');
    if (correctionPosts().length !== 0) throw new Error('P4A4 machine path mutated before explicit confirmation.');
  } else if (scenarioId === 'production-correction-scope-back-roundtrip') {
    await clickTo('Открыть раздел Корректировки', 'S03-C00');
    await clickTo('Производство', 'S03-CP00');
    await clickTo('По сотруднику', 'S03-CP10');
    await clickTo('Выбрать сотрудника Анна Производственная', 'S03-CP11');
    await backTo('S03-CP10');
    await backTo('S03-CP00');
    await clickTo('По станку', 'S03-CP20');
    await clickTo('Выбрать станок Станок производственной корректировки', 'S03-CP11');
    await backTo('S03-CP20');
    await backTo('S03-CP00');
    await clickTo('По сотруднику', 'S03-CP10');
    await clickTo('Выбрать сотрудника Анна Производственная', 'S03-CP11');
    await clickTo('За сегодня', 'S03-CP12');
    await backTo('S03-CP11');
    await backTo('S03-CP10');
    await backTo('S03-CP00');
    await clickTo('По станку', 'S03-CP20');
    await clickTo('Выбрать станок Станок производственной корректировки', 'S03-CP11');
    await backTo('S03-CP20');
    if (JSON.stringify(backChecks) !== JSON.stringify([
      'S03-CP11->S03-CP10', 'S03-CP10->S03-CP00',
      'S03-CP11->S03-CP20', 'S03-CP20->S03-CP00',
      'S03-CP12->S03-CP11', 'S03-CP11->S03-CP10', 'S03-CP10->S03-CP00',
      'S03-CP11->S03-CP20',
    ])) throw new Error(`P4A4 Back trace mismatch: ${JSON.stringify(backChecks)}.`);
    if (correctionPosts().length !== 0) throw new Error('P4A4 Back roundtrip performed a mutation.');
  } else {
    await failClosed('S03-CP16:source-scope-mismatch');
    await failClosed('S03-CP16:missing-authority');
    await failClosed('S03-CP16:negative-result');
    await openCorrection('employee');
    await enterConfirmation('Указать итоговое количество', '0', 'Подтверждённая производственная корректировка');
    ['Старое количество10', 'Корректировка-10', 'Новое количество0'].forEach((value) => assertText(value));
    fixture.setFailure(true);
    domClicks += 1;
    button('Корректировать').click();
    await waitForDom(() => document.querySelector('.peaks-presentation-feedback-block') !== null ? true : null, 'P4A4 correction failure feedback');
    if (currentNode() !== 'S03-CP16') throw new Error('P4A4 POST failure left CP16.');
    assertText('Подтвердите корректировку производства:');
    assertPost('0');
  }
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    dom_clicks: domClicks,
    mutation_requests: Object.freeze(correctionPosts()),
    contract_fail_closed: Object.freeze(contractFailClosed),
    external_requests: 0,
  });
}

function publishP4A4DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p4a4-dom-scenario-result';
  output.hidden = true;
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP4A5DomScenarioId(value: string | null): value is Section03P4A5DomScenarioId {
  return value !== null && (SECTION03_P4A5_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP4A5DomScenario(
  scenarioId: Section03P4A5DomScenarioId,
  fixture: ReturnType<typeof createBrowserP4A5FixtureApiHarness>,
) {
  let domClicks = 0;
  const visited: string[] = [];
  const backChecks: string[] = [];
  const contractFailClosed: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P4A5 node ${nodeId}`);
    visited.push(nodeId);
  };
  const button = (label: string) => {
    const found = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.getAttribute('aria-label') === label);
    if (found === undefined) throw new Error(`P4A5 button not found: ${label} at ${currentNode()}.`);
    return found;
  };
  const clickTo = async (label: string, target: Section03NodeId) => {
    const control = button(label);
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error(`P4A5 button disabled: ${label}.`);
    domClicks += 1;
    control.click();
    try {
      await waitNode(target);
    } catch (error) {
      const feedback = [...document.querySelectorAll<HTMLElement>('.peaks-presentation-feedback-block')]
        .map((element) => element.textContent ?? '').join(' | ');
      throw new Error(`${error instanceof Error ? error.message : String(error)}; current=${currentNode()}; feedback=${feedback}; requests=${JSON.stringify(fixture.requests.slice(-4))}`);
    }
  };
  const backTo = async (target: Section03NodeId) => {
    const source = currentNode();
    await clickTo('Назад', target);
    backChecks.push(`${source}->${target}`);
  };
  const notificationGets = () => fixture.requests.filter(
    (request) => request.method === 'GET' && request.path === '/manager/notifications/open-tasks',
  );
  const workplaceGets = () => fixture.requests.filter(
    (request) => request.method === 'GET' && request.path === '/manager/workplace-state',
  );
  const assertNotificationRows = () => {
    const rows = [...document.querySelectorAll<HTMLButtonElement>('.peaks-presentation-state-list-button')]
      .filter((element) => element.getAttribute('aria-label')?.startsWith('Открыть задачу '));
    const labels = rows.map((element) => element.getAttribute('aria-label'));
    const states = rows.map((element) => element.dataset.stateKey);
    const expectedLabels = [
      'Открыть задачу Доп. работа требует начисления',
      'Открыть задачу Запрошена доп. работа',
      'Открыть задачу Операционный простой больше 15 минут',
      'Открыть задачу Критический простой',
    ];
    const expectedStates = ['state-positive', 'state-neutral', 'state-warning', 'state-danger'];
    if (JSON.stringify(labels) !== JSON.stringify(expectedLabels) || JSON.stringify(states) !== JSON.stringify(expectedStates)) {
      throw new Error(`P4A5 ordered task DOM mismatch: ${JSON.stringify({ labels, states })}.`);
    }
  };
  const assertFreshNotificationReturn = async (expectedCount: number) => {
    await waitNode('S03-NOT01');
    await waitForDom(() => notificationGets().length === expectedCount ? expectedCount : null, `P4A5 fresh notification GET ${expectedCount}`);
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    assertNotificationRows();
  };
  const pageText = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';

  await waitNode('S03-N01');
  if (scenarioId === 'notifications-all-target-roundtrip') {
    await clickTo('Открыть раздел Уведомления', 'S03-NOT01');
    if (notificationGets().length !== 1) throw new Error('P4A5 initial notification GET mismatch.');
    assertNotificationRows();

    const roundTrips: readonly (readonly [string, Section03NodeId, string])[] = [
      ['Открыть задачу Запрошена доп. работа', 'S03-AW10', 'REQ-1'],
      ['Открыть задачу Доп. работа требует начисления', 'S03-AW50', 'WAIT-1'],
      ['Открыть задачу Критический простой', 'S03-M02', 'M-CRIT'],
      ['Открыть задачу Операционный простой больше 15 минут', 'S03-M02', 'M-OP'],
    ];
    for (const [label, target, identity] of roundTrips) {
      await clickTo(label, target);
      if (!pageText().includes(identity === 'REQ-1' ? 'Проверить комплектность'
        : identity === 'WAIT-1' ? 'Подготовить упаковку'
          : identity === 'M-CRIT' ? 'Станок критического простоя' : 'Станок операционного простоя')) {
        throw new Error(`P4A5 target identity mismatch for ${identity}.`);
      }
      const count = notificationGets().length;
      await backTo('S03-NOT01');
      await assertFreshNotificationReturn(count + 1);
    }
    if (notificationGets().length !== 5) throw new Error(`P4A5 fresh GET total mismatch: ${notificationGets().length}.`);
    await backTo('S03-N01');

    await clickTo('Открыть раздел Доп. работы', 'S03-AW01');
    await clickTo('Открыть доп. работу Проверить комплектность', 'S03-AW10');
    await backTo('S03-AW01');
    const waitingControl = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .filter((candidate) => candidate.getAttribute('aria-label') === 'Открыть доп. работу Подготовить упаковку')
      .at(-1);
    if (waitingControl === undefined) throw new Error('P4A5 ordinary AW50 control missing.');
    domClicks += 1;
    waitingControl.click();
    await waitNode('S03-AW50');
    await backTo('S03-AW01');
    await backTo('S03-N01');
    await clickTo('Открыть раздел Станки', 'S03-M01');
    await clickTo('Открыть карточку станка Станок критического простоя', 'S03-M02');
    await backTo('S03-M01');
    await backTo('S03-N01');
    await clickTo('Открыть раздел Простои', 'S03-D01');
    await clickTo('Открыть Станок операционного простоя', 'S03-M02');
    await backTo('S03-D01');
    await backTo('S03-N01');
  } else if (scenarioId === 'notifications-empty-and-error') {
    fixture.setNotificationsResponse(P4A5_NOTIFICATIONS_EMPTY_RESPONSE);
    await clickTo('Открыть раздел Уведомления', 'S03-NOT01');
    if (!pageText().includes('Открытых задач нет.')) throw new Error('P4A5 empty text missing.');
    await backTo('S03-N01');
    fixture.setNotificationsFailure(true);
    domClicks += 1;
    button('Открыть раздел Уведомления').click();
    await waitForDom(() => document.querySelector('.peaks-presentation-feedback-block') !== null ? true : null, 'P4A5 endpoint error feedback');
    if (currentNode() !== 'S03-N01') throw new Error('P4A5 endpoint failure navigated away from N01.');
    if ([...document.querySelectorAll<HTMLButtonElement>('.peaks-presentation-feedback-block button')].length !== 0) {
      throw new Error('P4A5 endpoint failure invented a retry control.');
    }
  } else {
    const invalidIds = [
      'S03-NOT01:count-mismatch',
      'S03-NOT01:open-tasks-reordered',
      'S03-NOT01:extra-target-context-field',
      'S03-NOT01:kind-target-mismatch',
      'S03-NOT01:kind-color-mismatch',
    ] as const;
    for (const fixtureId of invalidIds) {
      const invalid = SECTION03_P4A5_FIXTURES.find((candidate) => candidate.fixtureId === fixtureId)!;
      fixture.setNotificationsResponse(invalid.apiResponse);
      const workplaceCount = workplaceGets().length;
      root.render(<></>);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      root.render(<Section03Host apiClient={fixture.apiClient} key={fixtureId} />);
      await waitForDom(
        () => workplaceGets().length === workplaceCount + 1 && currentNode() === 'S03-N01' ? true : null,
        `P4A5 fresh rendered host ${fixtureId}`,
      );
      const requestCount = notificationGets().length;
      domClicks += 1;
      button('Открыть раздел Уведомления').click();
      await waitForDom(() => notificationGets().length === requestCount + 1 && document.querySelector('.peaks-presentation-feedback-block') !== null ? true : null, `P4A5 fail closed ${fixtureId}`);
      if (currentNode() !== 'S03-N01') throw new Error(`P4A5 invalid response navigated for ${fixtureId}.`);
      contractFailClosed.push(fixtureId);
    }
    const targetRequests = fixture.requests.filter((request) =>
      request.path === '/manager/additional-works' || /^\/manager\/machines\//.test(request.path));
    if (targetRequests.length !== 0) throw new Error(`P4A5 invalid responses reached target: ${JSON.stringify(targetRequests)}.`);
  }
  const mutationRequests = fixture.requests.filter((request) => request.method !== 'GET');
  if (mutationRequests.length !== 0) throw new Error(`P4A5 mutation request detected: ${JSON.stringify(mutationRequests)}.`);
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    back_checks: Object.freeze(backChecks),
    notifications_gets: notificationGets().length,
    dom_clicks: domClicks,
    mutation_requests: Object.freeze(mutationRequests),
    contract_fail_closed: Object.freeze(contractFailClosed),
    external_requests: 0,
  });
}

function publishP4A5DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p4a5-dom-scenario-result';
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

function isP5DomScenarioId(value: string | null): value is Section03P5DomScenarioId {
  return value !== null && (SECTION03_P5_DOM_SCENARIOS as readonly string[]).includes(value);
}

async function runP5DomScenario(
  scenarioId: Section03P5DomScenarioId,
  fixture: ReturnType<typeof createBrowserP5FixtureApiHarness>,
) {
  const visited: string[] = [];
  const currentNode = () => document.querySelector<HTMLElement>('main[data-node-id]')?.dataset.nodeId ?? null;
  const pageText = () => document.querySelector<HTMLElement>('main[data-node-id]')?.textContent ?? '';
  const waitNode = async (nodeId: Section03NodeId) => {
    await waitForDom(() => currentNode() === nodeId ? nodeId : null, `P5 node ${nodeId}`);
    visited.push(nodeId);
  };
  const exportPosts = () => fixture.requests.filter((request) => request.method === 'POST' && request.path === '/exports/google-sheets');

  await waitNode('S03-N01');
  const actionLabels = [...document.querySelectorAll<HTMLButtonElement>('button')]
    .map((button) => button.getAttribute('aria-label'));
  if (actionLabels.includes('Открыть раздел Отчёты')) {
    throw new Error('P5 Reports entry is exposed from the production main screen.');
  }
  const reportsButton = [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.textContent === 'Отчёты');
  if (reportsButton === undefined || !reportsButton.disabled) {
    throw new Error('P5 permanent Reports position is missing or enabled.');
  }
  if (pageText().includes('Выгрузка в Google Таблицы')) {
    throw new Error('P5 deferred export copy is exposed from the production main screen.');
  }
  if (!P5_REPORTS_AUTHORIZED_RESPONSE.sections.reports.is_placeholder
    || P5_REPORTS_AUTHORIZED_RESPONSE.sections.reports.available_actions.length !== 0) {
    throw new Error('P5 backend Reports placeholder contract was unexpectedly changed.');
  }
  if (exportPosts().length !== 0) throw new Error('P5 production main screen issued an export POST.');
  const nonFixtureRequests = fixture.requests.filter((request) =>
    !['/manager/workplace-state', '/manager/notifications/open-tasks'].includes(request.path));
  if (nonFixtureRequests.length !== 0) throw new Error(`P5 external request detected: ${JSON.stringify(nonFixtureRequests)}.`);
  return Object.freeze({
    scenario: scenarioId,
    status: 'PASS' as const,
    visited: Object.freeze(visited),
    reports_authority_disabled: true,
    reports_entry_visible: true,
    reports_entry_disabled: true,
    google_sheets_copy_visible: false,
    dom_clicks: 0,
    export_posts: exportPosts().length,
    external_requests: 0,
  });
}

function publishP5DomScenarioResult(result: unknown): void {
  const output = document.createElement('pre');
  output.id = 'p5-dom-scenario-result';
  output.hidden = true;
  output.textContent = JSON.stringify(result);
  document.body.append(output);
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
const search = new URLSearchParams(location.search);
const scenarioCandidate = search.get('scenario');
const p1DomScenarioCandidate = search.get('p1-dom-scenario');
const p2a1DomScenarioCandidate = search.get('p2a1-dom-scenario');
const p2a2aDomScenarioCandidate = search.get('p2a2a-dom-scenario');
const p2a2bDomScenarioCandidate = search.get('p2a2b-dom-scenario');
const p2b1DomScenarioCandidate = search.get('p2b1-dom-scenario');
const p2b2DomScenarioCandidate = search.get('p2b2-dom-scenario');
const p3a1DomScenarioCandidate = search.get('p3a1-dom-scenario');
const p3a2DomScenarioCandidate = search.get('p3a2-dom-scenario');
const p3a3DomScenarioCandidate = search.get('p3a3-dom-scenario');
const p3a4DomScenarioCandidate = search.get('p3a4-dom-scenario');
const p4a1DomScenarioCandidate = search.get('p4a1-dom-scenario');
const p4a2DomScenarioCandidate = search.get('p4a2-dom-scenario');
const p4a3DomScenarioCandidate = search.get('p4a3-dom-scenario');
const p4a4DomScenarioCandidate = search.get('p4a4-dom-scenario');
const p4a5DomScenarioCandidate = search.get('p4a5-dom-scenario');
const p5DomScenarioCandidate = search.get('p5-dom-scenario');
if (search.has('card-content-lines')) {
  root.render(<CardContentLinesFixture />);
} else if (isP1DomScenarioId(p1DomScenarioCandidate)) {
  const fixture = createBrowserP1FixtureApiHarness();
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP1DomScenario(p1DomScenarioCandidate, fixture.requests)
    .then(publishP1DomScenarioResult)
    .catch((error) => publishP1DomScenarioResult({
      scenario: p1DomScenarioCandidate,
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
      external_requests: 0,
    }));
} else if (isP2A1DomScenarioId(p2a1DomScenarioCandidate)) {
  const initialFixture = p2a1DomScenarioCandidate === 'employee-list-card-back'
    ? 'S03-E02:all-activity-fields'
    : 'S03-E02:all-blockers-finish-authorized';
  const fixture = createBrowserP2A1FixtureApiHarness(initialFixture);
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP2A1DomScenario(p2a1DomScenarioCandidate, fixture)
    .then(publishP2A1DomScenarioResult)
    .catch((error) => publishP2A1DomScenarioResult({
      scenario: p2a1DomScenarioCandidate,
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
      external_requests: 0,
    }));
} else if (isP2A2aDomScenarioId(p2a2aDomScenarioCandidate)) {
  const fixture = createBrowserP2A2aFixtureApiHarness(
    p2a2aDomScenarioCandidate === 'shift-close-authority-and-error',
  );
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP2A2aDomScenario(p2a2aDomScenarioCandidate, fixture)
    .then(publishP2A2aDomScenarioResult)
    .catch((error) => publishP2A2aDomScenarioResult({
      scenario: p2a2aDomScenarioCandidate,
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
      external_requests: 0,
    }));
} else if (isP2A2bDomScenarioId(p2a2bDomScenarioCandidate)) {
  const fixture = createBrowserP2A2bFixtureApiHarness(p2a2bDomScenarioCandidate);
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP2A2bDomScenario(p2a2bDomScenarioCandidate, fixture)
    .then(publishP2A2bDomScenarioResult)
    .catch((error) => publishP2A2bDomScenarioResult({
      scenario: p2a2bDomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP2B1DomScenarioId(p2b1DomScenarioCandidate)) {
  const fixture = createBrowserP2B1FixtureApiHarness();
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP2B1DomScenario(p2b1DomScenarioCandidate, fixture)
    .then(publishP2B1DomScenarioResult)
    .catch((error) => publishP2B1DomScenarioResult({
      scenario: p2b1DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP2B2DomScenarioId(p2b2DomScenarioCandidate)) {
  const fixture = createBrowserP2B2FixtureApiHarness();
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP2B2DomScenario(p2b2DomScenarioCandidate, fixture)
    .then(publishP2B2DomScenarioResult)
    .catch((error) => publishP2B2DomScenarioResult({
      scenario: p2b2DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP3A1DomScenarioId(p3a1DomScenarioCandidate)) {
  const fixture = createBrowserP3A1FixtureApiHarness();
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP3A1DomScenario(p3a1DomScenarioCandidate, fixture)
    .then(publishP3A1DomScenarioResult)
    .catch((error) => publishP3A1DomScenarioResult({
      scenario: p3a1DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP3A2DomScenarioId(p3a2DomScenarioCandidate)) {
  const fixture = createBrowserP3A2FixtureApiHarness();
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP3A2DomScenario(p3a2DomScenarioCandidate, fixture)
    .then(publishP3A2DomScenarioResult)
    .catch((error) => publishP3A2DomScenarioResult({
      scenario: p3a2DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP3A3DomScenarioId(p3a3DomScenarioCandidate)) {
  const fixture = createBrowserP3A3FixtureApiHarness();
  if (p3a3DomScenarioCandidate === 'assign-additional-work-empty-and-back') {
    fixture.setEmployeesEmpty(true);
  }
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP3A3DomScenario(p3a3DomScenarioCandidate, fixture)
    .then(publishP3A3DomScenarioResult)
    .catch((error) => publishP3A3DomScenarioResult({
      scenario: p3a3DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP3A4DomScenarioId(p3a4DomScenarioCandidate)) {
  const fixture = createBrowserP3A4FixtureApiHarness();
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP3A4DomScenario(p3a4DomScenarioCandidate, fixture)
    .then(publishP3A4DomScenarioResult)
    .catch((error) => publishP3A4DomScenarioResult({
      scenario: p3a4DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP4A1DomScenarioId(p4a1DomScenarioCandidate)) {
  const fixture = createBrowserP4A1FixtureApiHarness();
  if (p4a1DomScenarioCandidate === 'financial-correction-empty-identity-back') {
    fixture.setCorrectionContext(P4A1_EMPTY_RESPONSE);
  }
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP4A1DomScenario(p4a1DomScenarioCandidate, fixture)
    .then(publishP4A1DomScenarioResult)
    .catch((error) => publishP4A1DomScenarioResult({
      scenario: p4a1DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP4A2DomScenarioId(p4a2DomScenarioCandidate)) {
  const fixture = createBrowserP4A2FixtureApiHarness();
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP4A2DomScenario(p4a2DomScenarioCandidate, fixture)
    .then(publishP4A2DomScenarioResult)
    .catch((error) => publishP4A2DomScenarioResult({
      scenario: p4a2DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP4A3DomScenarioId(p4a3DomScenarioCandidate)) {
  const fixture = createBrowserP4A3FixtureApiHarness();
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP4A3DomScenario(p4a3DomScenarioCandidate, fixture)
    .then(publishP4A3DomScenarioResult)
    .catch((error) => publishP4A3DomScenarioResult({
      scenario: p4a3DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP4A4DomScenarioId(p4a4DomScenarioCandidate)) {
  const fixture = createBrowserP4A4FixtureApiHarness();
  if (p4a4DomScenarioCandidate === 'production-correction-machine-decrease-pre-mutation') {
    fixture.setOperationResponse(P4A4_MACHINE_OPERATIONS_RESPONSE);
  }
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP4A4DomScenario(p4a4DomScenarioCandidate, fixture)
    .then(publishP4A4DomScenarioResult)
    .catch((error) => publishP4A4DomScenarioResult({
      scenario: p4a4DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP4A5DomScenarioId(p4a5DomScenarioCandidate)) {
  const fixture = createBrowserP4A5FixtureApiHarness();
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP4A5DomScenario(p4a5DomScenarioCandidate, fixture)
    .then(publishP4A5DomScenarioResult)
    .catch((error) => publishP4A5DomScenarioResult({
      scenario: p4a5DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isP5DomScenarioId(p5DomScenarioCandidate)) {
  const fixture = createBrowserP5FixtureApiHarness();
  Date.now = () => Date.parse('2026-08-03T20:30:00Z');
  root.render(<Section03Host apiClient={fixture.apiClient} />);
  void runP5DomScenario(p5DomScenarioCandidate, fixture)
    .then(publishP5DomScenarioResult)
    .catch((error) => publishP5DomScenarioResult({
      scenario: p5DomScenarioCandidate, status: 'FAIL',
      error: error instanceof Error ? error.message : String(error), external_requests: 0,
    }));
} else if (isScenarioId(scenarioCandidate)) {
  const result = await runScenario(scenarioCandidate);
  root.render(<pre id="scenario-result">{JSON.stringify(result)}</pre>);
} else {
  const fixtureCandidate = search.get('p1-fixture');
  const p1Fixture = fixtureCandidate === null
    ? undefined
    : SECTION03_P1_FIXTURES.find((candidate) => candidate.fixtureId === fixtureCandidate);
  const p2a1FixtureCandidate = search.get('p2a1-fixture');
  const p2a1Fixture = p2a1FixtureCandidate === null
    ? undefined
    : SECTION03_P2A1_FIXTURES.find(
        (candidate) => candidate.fixtureId === p2a1FixtureCandidate,
      );
  const p2a2aFixtureCandidate = search.get('p2a2a-fixture');
  const p2a2aFixture = p2a2aFixtureCandidate === null
    ? undefined
    : SECTION03_P2A2A_FIXTURES.find(
        (candidate) => candidate.fixtureId === p2a2aFixtureCandidate,
      );
  const p2a2bFixtureCandidate = search.get('p2a2b-fixture');
  const p2a2bFixture = p2a2bFixtureCandidate === null
    ? undefined
    : SECTION03_P2A2B_FIXTURES.find((candidate) => candidate.fixtureId === p2a2bFixtureCandidate);
  const p2b1FixtureCandidate = search.get('p2b1-fixture');
  const p2b1Fixture = p2b1FixtureCandidate === null
    ? undefined
    : SECTION03_P2B1_FIXTURES.find((candidate) => candidate.fixtureId === p2b1FixtureCandidate);
  const p2b2FixtureCandidate = search.get('p2b2-fixture');
  const p2b2Fixture = p2b2FixtureCandidate === null
    ? undefined
    : SECTION03_P2B2_FIXTURES.find((candidate) => candidate.fixtureId === p2b2FixtureCandidate);
  const p3a1FixtureCandidate = search.get('p3a1-fixture');
  const p3a1Fixture = p3a1FixtureCandidate === null
    ? undefined
    : SECTION03_P3A1_FIXTURES.find((candidate) => candidate.fixtureId === p3a1FixtureCandidate);
  const p3a2FixtureCandidate = search.get('p3a2-fixture');
  const p3a2Fixture = p3a2FixtureCandidate === null
    ? undefined
    : SECTION03_P3A2_FIXTURES.find((candidate) => candidate.fixtureId === p3a2FixtureCandidate);
  const p3a3FixtureCandidate = search.get('p3a3-fixture');
  const p3a3Fixture = p3a3FixtureCandidate === null
    ? undefined
    : SECTION03_P3A3_FIXTURES.find((candidate) => candidate.fixtureId === p3a3FixtureCandidate);
  const p3a4FixtureCandidate = search.get('p3a4-fixture');
  const p3a4Fixture = p3a4FixtureCandidate === null
    ? undefined
    : SECTION03_P3A4_FIXTURES.find((candidate) => candidate.fixtureId === p3a4FixtureCandidate);
  const p4a1FixtureCandidate = search.get('p4a1-fixture');
  const p4a1Fixture = p4a1FixtureCandidate === null
    ? undefined
    : SECTION03_P4A1_FIXTURES.find((candidate) => candidate.fixtureId === p4a1FixtureCandidate);
  const p4a2FixtureCandidate = search.get('p4a2-fixture');
  const p4a2Fixture = p4a2FixtureCandidate === null
    ? undefined
    : SECTION03_P4A2_FIXTURES.find((candidate) => candidate.fixtureId === p4a2FixtureCandidate);
  const p4a3FixtureCandidate = search.get('p4a3-fixture');
  const p4a3Fixture = p4a3FixtureCandidate === null
    ? undefined
    : SECTION03_P4A3_FIXTURES.find((candidate) => candidate.fixtureId === p4a3FixtureCandidate);
  const p4a4FixtureCandidate = search.get('p4a4-fixture');
  const p4a4Fixture = p4a4FixtureCandidate === null
    ? undefined
    : SECTION03_P4A4_FIXTURES.find((candidate) => candidate.fixtureId === p4a4FixtureCandidate);
  const p4a5FixtureCandidate = search.get('p4a5-fixture');
  const p4a5Fixture = p4a5FixtureCandidate === null
    ? undefined
    : SECTION03_P4A5_FIXTURES.find((candidate) => candidate.fixtureId === p4a5FixtureCandidate);
  const p5FixtureCandidate = search.get('p5-fixture');
  const p5Fixture = p5FixtureCandidate === null
    ? undefined
    : SECTION03_P5_FIXTURES.find((candidate) => candidate.fixtureId === p5FixtureCandidate);
  const browserCandidate = p1Fixture?.nodeId ?? p2a1Fixture?.nodeId ??
    p2a2aFixture?.nodeId ?? p2a2bFixture?.nodeId ?? p2b1Fixture?.nodeId ?? p2b2Fixture?.nodeId ?? p3a1Fixture?.nodeId ?? p3a2Fixture?.nodeId ?? p3a3Fixture?.nodeId ?? p3a4Fixture?.nodeId ?? p4a1Fixture?.nodeId ?? p4a2Fixture?.nodeId ?? p4a3Fixture?.nodeId ?? p4a4Fixture?.nodeId ?? p4a5Fixture?.nodeId ?? p5Fixture?.nodeId ?? search.get('node') ?? 'S03-N01';
  const browserNodeId = isSection03NodeId(browserCandidate) ? browserCandidate : 'S03-N01';
  const browserProgram = createSection03Program(
    p1Fixture !== undefined
      ? createBrowserP1VariantApiClient(p1Fixture.fixtureId)
      : p2a1Fixture !== undefined
        ? createBrowserP2A1VariantApiClient(p2a1Fixture.fixtureId)
        : p2a2aFixture !== undefined
          ? createBrowserP2A2aVariantApiClient(p2a2aFixture.fixtureId)
          : p2a2bFixture !== undefined
            ? createBrowserP2A2bVariantApiClient(p2a2bFixture.fixtureId)
            : p2b1Fixture !== undefined
              ? createBrowserP2B1VariantApiClient(p2b1Fixture.fixtureId)
              : p2b2Fixture !== undefined
                ? createBrowserP2B2VariantApiClient(p2b2Fixture.fixtureId)
                : p3a1Fixture !== undefined
                  ? createBrowserP3A1VariantApiClient(p3a1Fixture.fixtureId)
                  : p3a2Fixture !== undefined
                    ? createBrowserP3A2VariantApiClient(p3a2Fixture.fixtureId)
                  : p3a3Fixture !== undefined
                    ? createBrowserP3A3VariantApiClient(p3a3Fixture.fixtureId)
                  : p3a4Fixture !== undefined
                    ? createBrowserP3A4VariantApiClient(p3a4Fixture.fixtureId)
                  : p4a1Fixture !== undefined
                    ? createBrowserP4A1VariantApiClient(p4a1Fixture.fixtureId)
                  : p4a2Fixture !== undefined
                    ? createBrowserP4A2VariantApiClient(p4a2Fixture.fixtureId)
                  : p4a3Fixture !== undefined
                    ? createBrowserP4A3VariantApiClient(p4a3Fixture.fixtureId)
                  : p4a4Fixture !== undefined
                    ? createBrowserP4A4VariantApiClient(p4a4Fixture.fixtureId)
                  : p4a5Fixture !== undefined
                    ? createBrowserP4A5VariantApiClient(p4a5Fixture.fixtureId)
                  : p5Fixture !== undefined
                    ? createBrowserP5VariantApiClient(p5Fixture.fixtureId)
                : createBrowserFixtureApiClient(),
  );
  const browserRuntime = createGraphActivationRuntime(browserProgram);
  await browserRuntime.activate({
    nodeId: browserNodeId,
    context: p1Fixture?.context ?? p2a1Fixture?.context ??
      p2a2aFixture?.context ?? p2a2bFixture?.context ??
      p2b1Fixture?.context ??
      p2b2Fixture?.context ??
      p3a1Fixture?.context ??
      p3a2Fixture?.context ??
      p3a3Fixture?.context ??
      p3a4Fixture?.context ??
      p4a1Fixture?.context ??
      p4a2Fixture?.context ??
      p4a3Fixture?.context ??
      p4a4Fixture?.context ??
      p4a5Fixture?.context ??
      p5Fixture?.context ??
      representativeBrowserContext(browserNodeId),
  });
  const browserSession = Object.freeze({ runtime: browserRuntime, presentationExecution: createGraphPresentationExecutionRuntime(browserRuntime) });
  root.render(<BrowserHarness nodeId={browserNodeId} runtime={browserSession.runtime} presentationExecution={browserSession.presentationExecution} />);
}

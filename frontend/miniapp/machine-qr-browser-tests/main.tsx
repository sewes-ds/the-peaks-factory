import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import '../src/foundation/platformRoot.css';
import '../src/foundation/peaksTheme.css';
import '../src/foundation/layoutPrimitives.css';
import '../src/foundation/graphRenderer/graphRenderer.css';
import '../src/foundation/graphObjects/graphObjects.css';
import { createPlatformFontReadinessController } from '../src/foundation/fontReadiness';
import type { TelegramQrScanner } from '../src/foundation/telegramQr';
import { SECTION02_FIXTURE_CONTEXTS, createSection02FixtureApiClient, type Section02FixtureRequest } from '../src/section02/__fixtures__/section02Fixtures';
import { Section02Host } from '../src/section02/Section02Host';

type Scenario = 'available' | 'occupied' | 'broken' | 'unknown' | 'cancelled' | 'unavailable';

const requestedScenario = new URLSearchParams(location.search).get('state');
const scenarios: readonly Scenario[] = ['available', 'occupied', 'broken', 'unknown', 'cancelled', 'unavailable'];
if (!scenarios.includes(requestedScenario as Scenario)) throw new Error(`Invalid QR scenario: ${requestedScenario}`);
const scenario = requestedScenario as Scenario;
const requests: Section02FixtureRequest[] = [];

declare global {
  interface Window {
    getMachineQrBrowserEvidence: () => Readonly<{
      fixed_post_count: number;
      path_disclosure_count: number;
      request_methods: readonly string[];
    }>;
  }
}

window.getMachineQrBrowserEvidence = () => Object.freeze({
  fixed_post_count: requests.filter((request) => request.method === 'POST' && request.path === '/operator/machines/resolve-qr').length,
  path_disclosure_count: requests.filter((request) => request.path.includes('peaks-machine') || request.path.includes('by-qr')).length,
  request_methods: Object.freeze(requests.map((request) => `${request.method} ${request.path}`)),
});

function machineQrResponse(): unknown {
  if (scenario === 'unknown') return { found: false, error_code: 'MACHINE_QR_NOT_FOUND' };
  if (scenario === 'occupied') {
    return {
      found: true,
      machine: {
        machine_id: '12', machine_name: '180 автомат', workshop_name: null,
        machine_status: 'Работает', machine_use_status: 'Используется',
        is_selectable_for_production: false, is_selectable_for_critical_downtime: false,
        ui_status_token: 'busy',
        production_unavailability: { code: 'OCCUPIED_BY_OPERATOR', operator_full_name: 'Петров Пётр Сергеевич' },
      },
    };
  }
  if (scenario === 'broken') {
    return {
      found: true,
      machine: {
        machine_id: '12', machine_name: '180 автомат', workshop_name: null,
        machine_status: 'Неисправен', machine_use_status: 'Используется',
        is_selectable_for_production: false, is_selectable_for_critical_downtime: false,
        ui_status_token: 'critical', production_unavailability: { code: 'MACHINE_BROKEN' },
      },
    };
  }
  return {
    found: true,
    machine: {
      machine_id: '11', machine_name: 'Станок продольной резки', workshop_name: null,
      machine_status: 'Свободен', machine_use_status: 'Используется',
      is_selectable_for_production: true, is_selectable_for_critical_downtime: true,
      ui_status_token: 'normal', production_unavailability: null,
    },
  };
}

function scanner(): TelegramQrScanner {
  if (scenario === 'cancelled') return Object.freeze({ scan: async () => ({ status: 'cancelled' as const }) });
  if (scenario === 'unavailable') return Object.freeze({ scan: async () => ({ status: 'unavailable' as const }) });
  return Object.freeze({
    scan: async () => ({ status: 'scanned' as const, text: `peaks-machine:v1:${'Q'.repeat(32)}` }),
  });
}

function App() {
  const resources = useMemo(() => {
    const fontReadinessController = createPlatformFontReadinessController({
      environment: Object.freeze({
        clearTimer: (handle) => globalThis.clearTimeout(handle),
        isVisible: () => true,
        loadAttempt: async () => undefined,
        now: () => Date.now(),
        preloadSource: () => undefined,
        setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
        subscribeVisibility: () => () => undefined,
      }),
      resource: Object.freeze({
        family: 'Browser Test',
        requiredFaces: Object.freeze([Object.freeze({ style: 'normal' as const, weight: 400 })]),
        resourceId: 'MACHINE_QR_BROWSER_FONT',
        sources: Object.freeze([Object.freeze({
          style: 'normal' as const, unicodeRange: 'U+0000-00FF', url: '/test.woff2', weightRange: '400',
        })]),
        specimen: 'Test',
      }),
    });
    return Object.freeze({
      apiClient: createSection02FixtureApiClient('S02-N03', requests, { machineQrResponse: machineQrResponse() }),
      fontReadinessController,
      qrScanner: scanner(),
    });
  }, []);
  useEffect(() => () => resources.fontReadinessController.dispose(), [resources]);
  return <Section02Host
    apiClient={resources.apiClient}
    initialNodeId="S02-N03"
    initialContext={SECTION02_FIXTURE_CONTEXTS['S02-N03']}
    fontReadinessController={resources.fontReadinessController}
    qrScanner={resources.qrScanner}
  />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

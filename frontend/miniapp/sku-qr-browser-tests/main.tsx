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

type Scenario = 'available' | 'inactive' | 'unknown' | 'cancelled' | 'unavailable';
const requestedScenario = new URLSearchParams(location.search).get('state');
const scenarios: readonly Scenario[] = ['available', 'inactive', 'unknown', 'cancelled', 'unavailable'];
if (!scenarios.includes(requestedScenario as Scenario)) throw new Error(`Invalid SKU QR scenario: ${requestedScenario}`);
const scenario = requestedScenario as Scenario;
const requests: Section02FixtureRequest[] = [];

declare global {
  interface Window {
    getSkuQrBrowserEvidence: () => Readonly<{
      fixed_post_count: number;
      production_post_count: number;
      path_disclosure_count: number;
      production_body: unknown;
    }>;
  }
}

window.getSkuQrBrowserEvidence = () => Object.freeze({
  fixed_post_count: requests.filter((request) => request.method === 'POST' && request.path === '/operator/skus/resolve-qr').length,
  production_post_count: requests.filter((request) => request.method === 'POST' && request.path === '/production-operations/start').length,
  path_disclosure_count: requests.filter((request) => request.path.includes('peaks-sku') || request.path.includes('by-qr')).length,
  production_body: requests.find((request) => request.path === '/production-operations/start')?.body ?? null,
});

function skuQrResponse(): unknown {
  if (scenario === 'unknown') return { found: false, error_code: 'SKU_QR_NOT_FOUND' };
  if (scenario === 'inactive') return {
    found: true,
    sku: {
      sku_id: '22', sku_code: 'SKU-022', sku_name: 'Неактивный SKU', sku_unit_name: 'шт.',
      current_sku_tariff_uzs: 0, is_active: false, is_selectable_for_production: false,
      production_unavailability: { code: 'SKU_INACTIVE' },
    },
  };
  return {
    found: true,
    sku: {
      sku_id: '21', sku_code: 'SKU-021', sku_name: 'Деталь производственная контрольная', sku_unit_name: 'шт.',
      current_sku_tariff_uzs: 1250, is_active: true, is_selectable_for_production: true,
      production_unavailability: null,
    },
  };
}

function scanner(): TelegramQrScanner {
  if (scenario === 'cancelled') return Object.freeze({ scan: async () => ({ status: 'cancelled' as const }) });
  if (scenario === 'unavailable') return Object.freeze({ scan: async () => ({ status: 'unavailable' as const }) });
  return Object.freeze({ scan: async () => ({ status: 'scanned' as const, text: `peaks-sku:v1:${'Q'.repeat(32)}` }) });
}

function App() {
  const resources = useMemo(() => {
    const fontReadinessController = createPlatformFontReadinessController({
      environment: Object.freeze({
        clearTimer: (handle) => globalThis.clearTimeout(handle), isVisible: () => true, loadAttempt: async () => undefined,
        now: () => Date.now(), preloadSource: () => undefined, setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
        subscribeVisibility: () => () => undefined,
      }),
      resource: Object.freeze({
        family: 'Browser Test', requiredFaces: Object.freeze([Object.freeze({ style: 'normal' as const, weight: 400 })]),
        resourceId: 'SKU_QR_BROWSER_FONT', sources: Object.freeze([Object.freeze({
          style: 'normal' as const, unicodeRange: 'U+0000-00FF', url: '/test.woff2', weightRange: '400',
        })]), specimen: 'Test',
      }),
    });
    return Object.freeze({
      apiClient: createSection02FixtureApiClient('S02-SKU01', requests, { skuQrResponse: skuQrResponse() }),
      fontReadinessController,
      qrScanner: scanner(),
    });
  }, []);
  useEffect(() => () => resources.fontReadinessController.dispose(), [resources]);
  return <Section02Host
    apiClient={resources.apiClient}
    initialNodeId="S02-SKU01"
    initialContext={SECTION02_FIXTURE_CONTEXTS['S02-SKU01']}
    fontReadinessController={resources.fontReadinessController}
    qrScanner={resources.qrScanner}
  />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

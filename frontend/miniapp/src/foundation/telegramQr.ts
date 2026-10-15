import type { MachineQrFlowResponse, MachineQrLookupResponse, SkuQrFlowResponse, SkuQrLookupResponse } from './contracts';

export type TelegramQrScanResult =
  | { status: 'scanned'; text: string }
  | { status: 'cancelled' }
  | { status: 'unavailable' };

export type TelegramQrScanner = {
  scan(prompt?: string): Promise<TelegramQrScanResult>;
};

export type MachineQrResolver = (qrPayload: string) => Promise<MachineQrLookupResponse>;
export type SkuQrResolver = (qrPayload: string) => Promise<SkuQrLookupResponse>;

type TelegramQrWebApp = Readonly<{
  showScanQrPopup?: (
    params: Readonly<{ text?: string }>,
    callback?: (text: string) => boolean | void,
  ) => void;
  closeScanQrPopup?: () => void;
  onEvent?: (eventType: 'scanQrPopupClosed', handler: () => void) => void;
  offEvent?: (eventType: 'scanQrPopupClosed', handler: () => void) => void;
  isVersionAtLeast?: (version: string) => boolean;
}>;

type TelegramQrEnvironment = Readonly<{
  getWebApp: () => TelegramQrWebApp | undefined;
}>;

function browserTelegramWebApp(): TelegramQrWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { Telegram?: { WebApp?: TelegramQrWebApp } }).Telegram?.WebApp;
}

export function createTelegramQrScanner(
  environment: TelegramQrEnvironment = Object.freeze({ getWebApp: browserTelegramWebApp }),
): TelegramQrScanner {
  let activeScan: Promise<TelegramQrScanResult> | null = null;

  const scan = (prompt = 'Наведите камеру на QR-код'): Promise<TelegramQrScanResult> => {
    if (activeScan !== null) return activeScan;
    const webApp = environment.getWebApp();
    if (
      webApp?.showScanQrPopup === undefined
      || webApp.onEvent === undefined
      || webApp.offEvent === undefined
      || webApp.isVersionAtLeast?.('6.4') === false
    ) {
      return Promise.resolve({ status: 'unavailable' });
    }

    const pending = new Promise<TelegramQrScanResult>((resolve) => {
      let settled = false;
      const finish = (result: TelegramQrScanResult) => {
        if (settled) return;
        settled = true;
        webApp.offEvent?.('scanQrPopupClosed', onClosed);
        resolve(result);
      };
      const onClosed = () => finish({ status: 'cancelled' });

      try {
        webApp.onEvent?.('scanQrPopupClosed', onClosed);
        webApp.showScanQrPopup?.(
          { text: prompt },
          (text) => {
            const normalized = text.trim();
            if (normalized.length === 0) return false;
            finish({ status: 'scanned', text: normalized });
            return true;
          },
        );
      } catch {
        finish({ status: 'unavailable' });
      }
    }).finally(() => {
      activeScan = null;
    });
    activeScan = pending;
    return pending;
  };

  return Object.freeze({ scan });
}

export const telegramQrScanner = createTelegramQrScanner();

export async function scanAndResolveMachineQr(
  scanner: TelegramQrScanner,
  resolveMachineQr: MachineQrResolver
): Promise<MachineQrFlowResponse> {
  const scan = await scanner.scan('Наведите камеру на QR-код станка');
  if (scan.status === 'unavailable') return { found: false, error_code: 'SCANNER_UNAVAILABLE' };
  if (scan.status === 'cancelled') return { found: false, error_code: 'SCANNER_CANCELLED' };

  try {
    return await resolveMachineQr(scan.text);
  } catch {
    return { found: false, error_code: 'MACHINE_QR_LOOKUP_FAILED' };
  }
}

export async function scanAndResolveSkuQr(
  scanner: TelegramQrScanner,
  resolveSkuQr: SkuQrResolver
): Promise<SkuQrFlowResponse> {
  const scan = await scanner.scan('Наведите камеру на QR-код SKU');
  if (scan.status === 'unavailable') return { found: false, error_code: 'SCANNER_UNAVAILABLE' };
  if (scan.status === 'cancelled') return { found: false, error_code: 'SCANNER_CANCELLED' };

  try {
    return await resolveSkuQr(scan.text);
  } catch {
    return { found: false, error_code: 'SKU_QR_LOOKUP_FAILED' };
  }
}

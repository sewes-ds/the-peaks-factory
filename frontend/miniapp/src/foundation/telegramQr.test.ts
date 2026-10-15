import { describe, expect, it, vi } from 'vitest';
import { createTelegramQrScanner, scanAndResolveMachineQr, scanAndResolveSkuQr } from './telegramQr';

describe('Telegram machine QR scanner', () => {
  it('resolves one scanned value and removes the close listener', async () => {
    let scanCallback: ((text: string) => boolean | void) | undefined;
    let closedHandler: (() => void) | undefined;
    const offEvent = vi.fn();
    const scanner = createTelegramQrScanner({
      getWebApp: () => ({
        isVersionAtLeast: () => true,
        onEvent: (_event, handler) => { closedHandler = handler; },
        offEvent,
        showScanQrPopup: (_params, callback) => { scanCallback = callback; },
      }),
    });
    const pending = scanner.scan();

    expect(scanCallback?.('  peaks-machine:v1:example  ')).toBe(true);
    await expect(pending).resolves.toEqual({ status: 'scanned', text: 'peaks-machine:v1:example' });
    expect(offEvent).toHaveBeenCalledWith('scanQrPopupClosed', closedHandler);
  });

  it('uses the Telegram 6.4 QR capability boundary and shares an active scan', async () => {
    let scanCallback: ((text: string) => boolean | void) | undefined;
    const isVersionAtLeast = vi.fn(() => true);
    const showScanQrPopup = vi.fn((_params, callback) => { scanCallback = callback; });
    const scanner = createTelegramQrScanner({
      getWebApp: () => ({
        isVersionAtLeast,
        onEvent: () => undefined,
        offEvent: () => undefined,
        showScanQrPopup,
      }),
    });

    const first = scanner.scan();
    const second = scanner.scan();
    expect(first).toBe(second);
    expect(isVersionAtLeast).toHaveBeenCalledWith('6.4');
    expect(showScanQrPopup).toHaveBeenCalledTimes(1);
    scanCallback?.('peaks-machine:v1:shared');
    await expect(first).resolves.toEqual({ status: 'scanned', text: 'peaks-machine:v1:shared' });
  });

  it('settles cancellation once and ignores a later scan callback', async () => {
    let scanCallback: ((text: string) => boolean | void) | undefined;
    let closedHandler: (() => void) | undefined;
    const scanner = createTelegramQrScanner({
      getWebApp: () => ({
        isVersionAtLeast: () => true,
        onEvent: (_event, handler) => { closedHandler = handler; },
        offEvent: () => undefined,
        showScanQrPopup: (_params, callback) => { scanCallback = callback; },
      }),
    });
    const pending = scanner.scan();

    closedHandler?.();
    scanCallback?.('peaks-machine:v1:late');
    await expect(pending).resolves.toEqual({ status: 'cancelled' });
  });

  it('fails closed when the Telegram close lifecycle is unavailable', async () => {
    const showScanQrPopup = vi.fn();
    const scanner = createTelegramQrScanner({ getWebApp: () => ({ showScanQrPopup }) });

    await expect(scanner.scan()).resolves.toEqual({ status: 'unavailable' });
    expect(showScanQrPopup).not.toHaveBeenCalled();
  });

  it('maps scanner and lookup failures to recoverable flow results', async () => {
    await expect(scanAndResolveMachineQr(
      { scan: async () => ({ status: 'cancelled' }) },
      vi.fn(),
    )).resolves.toEqual({ found: false, error_code: 'SCANNER_CANCELLED' });

    await expect(scanAndResolveMachineQr(
      { scan: async () => ({ status: 'scanned', text: 'payload' }) },
      async () => { throw new Error('network detail'); },
    )).resolves.toEqual({ found: false, error_code: 'MACHINE_QR_LOOKUP_FAILED' });

    await expect(scanAndResolveSkuQr(
      { scan: async () => ({ status: 'scanned', text: 'payload' }) },
      async () => { throw new Error('network detail'); },
    )).resolves.toEqual({ found: false, error_code: 'SKU_QR_LOOKUP_FAILED' });
  });

  it('uses the SKU-specific scanner prompt', async () => {
    let scanCallback: ((text: string) => boolean | void) | undefined;
    const showScanQrPopup = vi.fn((_params, callback) => { scanCallback = callback; });
    const scanner = createTelegramQrScanner({
      getWebApp: () => ({
        isVersionAtLeast: () => true,
        onEvent: () => undefined,
        offEvent: () => undefined,
        showScanQrPopup,
      }),
    });
    const pending = scanAndResolveSkuQr(scanner, async () => ({ found: false, error_code: 'SKU_QR_NOT_FOUND' }));
    expect(showScanQrPopup).toHaveBeenCalledWith(
      { text: 'Наведите камеру на QR-код SKU' },
      expect.any(Function),
    );
    scanCallback?.(`peaks-sku:v1:${'A'.repeat(32)}`);
    await expect(pending).resolves.toEqual({ found: false, error_code: 'SKU_QR_NOT_FOUND' });
  });
});

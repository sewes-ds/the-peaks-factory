import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyTelegramWebAppReady } from './telegramContact';

const initialTelegram = window.Telegram;

afterEach(() => {
  window.Telegram = initialTelegram;
});

describe('Telegram Mini App lifecycle', () => {
  it('signals readiness to the Telegram WebView', () => {
    const ready = vi.fn();
    window.Telegram = { WebApp: { ready } };

    expect(notifyTelegramWebAppReady()).toBe(true);
    expect(ready).toHaveBeenCalledOnce();
  });

  it('remains safe when opened outside Telegram', () => {
    window.Telegram = undefined;

    expect(notifyTelegramWebAppReady()).toBe(false);
  });
});

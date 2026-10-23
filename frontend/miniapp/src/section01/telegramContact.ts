export type TelegramContactShare = {
  phone_number?: string;
};

type TelegramContactCallback = (shared: boolean, event?: TelegramContactShare) => void;

type TelegramWebAppContactApi = {
  initData?: string;
  requestContact?: (callback: TelegramContactCallback) => void;
  ready?: () => void;
  expand?: () => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebAppContactApi;
    };
  }
}

export function getTelegramInitDataFromWebApp(): string | undefined {
  const webAppInitData = window.Telegram?.WebApp?.initData;
  if (webAppInitData && webAppInitData.length > 0) {
    return webAppInitData;
  }

  return getTelegramInitDataFromLocationHash();
}

export function notifyTelegramWebAppReady(): boolean {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.ready) {
    return false;
  }

  webApp.ready();
  return true;
}

export function getTelegramInitDataFromLocationHash(): string | undefined {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) {
    return undefined;
  }

  const params = new URLSearchParams(hash);
  const initData = params.get('tgWebAppData');

  return initData && initData.length > 0 ? initData : undefined;
}

export function requestVerifiedTelegramContact(): Promise<TelegramContactShare> {
  const requestContact = window.Telegram?.WebApp?.requestContact;

  if (!requestContact) {
    return Promise.reject(new Error('Telegram contact share is unavailable'));
  }

  return new Promise((resolve, reject) => {
    requestContact((shared, event) => {
      if (!shared) {
        reject(new Error('Telegram contact was not shared'));
        return;
      }

      resolve(event ?? {});
    });
  });
}

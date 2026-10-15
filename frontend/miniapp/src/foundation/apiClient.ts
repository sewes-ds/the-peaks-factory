import { getDefaultApiBaseUrl } from './runtimePaths';

export type ApiClientOptions = {
  baseUrl?: string;
  getTelegramInitData?: () => string | undefined;
  fetchImpl?: typeof fetch;
};

export type ApiRequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};


function getBoundDefaultFetch(): typeof fetch {
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    return window.fetch.bind(window) as typeof fetch;
  }

  return globalThis.fetch.bind(globalThis) as typeof fetch;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown
  ) {
    super(message);
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getTelegramInitData?: () => string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? getDefaultApiBaseUrl();
    this.getTelegramInitData = options.getTelegramInitData;
    this.fetchImpl = options.fetchImpl ?? getBoundDefaultFetch();
  }

  async request<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
    const headers: Record<string, string> = {
      accept: 'application/json'
    };

    const initData = this.getTelegramInitData?.();
    if (initData) {
      headers['x-telegram-init-data'] = initData;
    }

    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers
    };

    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, init);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new ApiClientError('Backend request failed', response.status, payload);
    }

    return payload as TResponse;
  }
}

export const operatorReadModelPaths = {
  workplaceState: '/operator/workplace-state',
  additionalWorkState: '/operator/additional-work-state',
  additionalWorkTypesAvailable: '/operator/additional-work-types/available',
  downtimeTypesAvailable: '/operator/downtime-types/available',
  machines: '/operator/machines',
  machineQr: '/operator/machines/resolve-qr',
  skus: '/operator/skus',
  skuQr: '/operator/skus/resolve-qr',
  breakTypes: '/operator/break-types',
  salary: '/operator/salary',
  salaryHistory: '/operator/salary/history'
} as const;

export const mutationPaths = {
  startShift: '/shifts/start',
  finishShift: '/shifts/finish',
  startProduction: '/production-operations/start',
  finishProduction: (productionOperationId: string) =>
    `/production-operations/${encodeURIComponent(productionOperationId)}/finish`,
  startDowntime: '/machine-downtimes/start',
  finishDowntime: (downtimeId: string) => `/machine-downtimes/${encodeURIComponent(downtimeId)}/finish`,
  startBreak: '/operator-breaks/start',
  finishBreak: '/operator-breaks/finish',
  requestAdditionalWork: '/additional-works/request',
  startAdditionalWork: (additionalWorkId: string) =>
    `/additional-works/${encodeURIComponent(additionalWorkId)}/start`,
  finishAdditionalWork: (additionalWorkId: string) =>
    `/additional-works/${encodeURIComponent(additionalWorkId)}/finish`
} as const;

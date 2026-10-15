import { describe, expect, it } from 'vitest';
import { ApiClient } from '../foundation/apiClient';
import { confirmSelfBinding, getAuthMe, identifyByVerifiedPhone, section01AuthPaths } from './authApi';

describe('Section 01 auth API bindings', () => {
  it('uses exact backend auth endpoints', () => {
    expect(section01AuthPaths).toEqual({
      me: '/auth/me',
      identifyByPhone: '/auth/telegram/self-binding/identify-by-phone',
      confirm: '/auth/telegram/self-binding/confirm'
    });
  });

  it('sends Telegram init data header through the shared API client', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const apiClient = new ApiClient({
      getTelegramInitData: () => 'init-data',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ status: 'PHONE_BINDING_REQUIRED' }), { status: 200 });
      }
    });

    await getAuthMe(apiClient);

    expect(calls[0]?.url).toBe('/api/auth/me');
    expect(calls[0]?.init.headers).toMatchObject({ 'x-telegram-init-data': 'init-data' });
  });

  it('does not send raw phone/contact body to identify-by-phone', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const apiClient = new ApiClient({
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ status: 'PHONE_NOT_FOUND' }), { status: 200 });
      }
    });

    await identifyByVerifiedPhone(apiClient);

    expect(calls[0]?.url).toBe('/api/auth/telegram/self-binding/identify-by-phone');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe('{}');
  });

  it('posts only confirmation_token to confirm endpoint', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const apiClient = new ApiClient({
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ status: 'TOKEN_INVALID' }), { status: 200 });
      }
    });

    await confirmSelfBinding(apiClient, 'token-1');

    expect(calls[0]?.url).toBe('/api/auth/telegram/self-binding/confirm');
    expect(calls[0]?.init.body).toBe(JSON.stringify({ confirmation_token: 'token-1' }));
  });
});

import type { ApiClient } from '../foundation/apiClient';
import type { AuthMeResponse, ConfirmSelfBindingResponse, IdentifyByPhoneResponse } from './authTypes';

export const section01AuthPaths = {
  me: '/auth/me',
  identifyByPhone: '/auth/telegram/self-binding/identify-by-phone',
  confirm: '/auth/telegram/self-binding/confirm'
} as const;

export function getAuthMe(apiClient: ApiClient): Promise<AuthMeResponse> {
  return apiClient.request<AuthMeResponse>(section01AuthPaths.me);
}

export function identifyByVerifiedPhone(apiClient: ApiClient): Promise<IdentifyByPhoneResponse> {
  return apiClient.request<IdentifyByPhoneResponse>(section01AuthPaths.identifyByPhone, {
    method: 'POST',
    body: {}
  });
}

export function confirmSelfBinding(apiClient: ApiClient, confirmationToken: string): Promise<ConfirmSelfBindingResponse> {
  return apiClient.request<ConfirmSelfBindingResponse>(section01AuthPaths.confirm, {
    method: 'POST',
    body: {
      confirmation_token: confirmationToken
    }
  });
}

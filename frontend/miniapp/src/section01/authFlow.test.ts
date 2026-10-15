import { describe, expect, it } from 'vitest';
import {
  contactUnavailableRoute,
  resolveAuthMeResponse,
  resolveConfirmSelfBindingResponse,
  resolveIdentifyByPhoneResponse,
  technicalFailureRoute
} from './authFlow';

describe('Section 01 auth flow', () => {
  it('routes auth check by backend status only', () => {
    expect(resolveAuthMeResponse({ status: 'PHONE_BINDING_REQUIRED' })).toEqual({
      kind: 'route',
      route: { screenId: 'S01-N02', loading: false }
    });

    expect(
      resolveAuthMeResponse({
        status: 'AUTHENTICATED',
        actor_employee_id: '42',
        telegram_user_id: '777',
        telegram_username: 'operator'
      })
    ).toMatchObject({
      kind: 'authenticated',
      entrypoint: { target: 'SECTION02_OPERATOR_RESOLVER' }
    });
  });

  it('routes identify response to confirm or denied screens', () => {
    expect(
      resolveIdentifyByPhoneResponse({
        status: 'CONFIRM_EMPLOYEE',
        full_name: 'Worker One',
        confirmation_token: 'token'
      })
    ).toEqual({
      screenId: 'S01-N03',
      loading: false,
      fullName: 'Worker One',
      confirmationToken: 'token'
    });

    expect(resolveIdentifyByPhoneResponse({ status: 'PHONE_NOT_FOUND' })).toEqual({
      screenId: 'S01-N05',
      loading: false,
      reason: 'PHONE_NOT_FOUND'
    });
  });

  it('fails closed for backend statuses outside the accepted frontend transition table', () => {
    expect(resolveIdentifyByPhoneResponse({ status: 'CONTACT_PROOF_REQUIRED' })).toEqual({
      screenId: 'S01-N04',
      loading: false,
      reason: 'UNSUPPORTED_STATUS'
    });

    expect(resolveConfirmSelfBindingResponse({ status: 'TOKEN_INVALID' })).toEqual({
      kind: 'route',
      route: { screenId: 'S01-N04', loading: false, reason: 'UNSUPPORTED_STATUS' }
    });
  });

  it('routes runtime failures to the service unavailable screen', () => {
    expect(technicalFailureRoute()).toEqual({
      screenId: 'S01-N04',
      loading: false,
      reason: 'TECHNICAL_FAILURE'
    });

    expect(contactUnavailableRoute()).toEqual({
      screenId: 'S01-N04',
      loading: false,
      reason: 'TELEGRAM_CONTACT_UNAVAILABLE'
    });
  });

  it('routes business/access denial to the access denied screen', () => {
    expect(resolveConfirmSelfBindingResponse({ status: 'EMPLOYEE_INACTIVE' })).toEqual({
      kind: 'route',
      route: { screenId: 'S01-N05', loading: false, reason: 'EMPLOYEE_INACTIVE' }
    });
  });
});

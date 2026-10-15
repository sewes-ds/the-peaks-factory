import type {
  AuthenticatedEntrypoint,
  AuthMeResponse,
  ConfirmSelfBindingResponse,
  IdentifyByPhoneResponse,
  Section01RouteState
} from './authTypes';

export type AuthFlowDecision =
  | { kind: 'route'; route: Section01RouteState }
  | { kind: 'authenticated'; entrypoint: AuthenticatedEntrypoint };

export function resolveAuthMeResponse(response: AuthMeResponse): AuthFlowDecision {
  if (response.status === 'AUTHENTICATED') {
    return {
      kind: 'authenticated',
      entrypoint: {
        target: 'SECTION02_OPERATOR_RESOLVER',
        actor: response
      }
    };
  }

  if (response.status === 'PHONE_BINDING_REQUIRED') {
    return { kind: 'route', route: { screenId: 'S01-N02', loading: false } };
  }

  return unsupportedStatusRoute();
}

export function resolveIdentifyByPhoneResponse(response: IdentifyByPhoneResponse): Section01RouteState {
  if (response.status === 'CONFIRM_EMPLOYEE') {
    return {
      screenId: 'S01-N03',
      loading: false,
      fullName: response.full_name,
      confirmationToken: response.confirmation_token
    };
  }

  if (response.status === 'PHONE_NOT_FOUND' || response.status === 'EMPLOYEE_INACTIVE') {
    return { screenId: 'S01-N05', loading: false, reason: response.status };
  }

  return unsupportedStatusRoute().route;
}


export function resolveIdentifyByPhoneError(error: unknown): Section01RouteState {
  const status = extractBackendStatus(error);

  if (status === 'PHONE_NOT_FOUND' || status === 'EMPLOYEE_INACTIVE') {
    return { screenId: 'S01-N05', loading: false, reason: status };
  }

  if (status === 'PHONE_ALREADY_BOUND_TO_ANOTHER_EMPLOYEE') {
    return { screenId: 'S01-N05', loading: false, reason: 'PHONE_ALREADY_BOUND_TO_ANOTHER_EMPLOYEE' };
  }

  if (status === 'CONTACT_PROOF_REQUIRED') {
    return { screenId: 'S01-N04', loading: false, reason: 'TECHNICAL_FAILURE' };
  }

  return technicalFailureRoute();
}

function extractBackendStatus(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const payload = (error as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const direct = record.status ?? record.code ?? record.error_code;
  if (typeof direct === 'string') {
    return direct;
  }

  const nested = record.error;
  if (nested && typeof nested === 'object') {
    const nestedRecord = nested as Record<string, unknown>;
    const nestedValue = nestedRecord.status ?? nestedRecord.code ?? nestedRecord.error_code;
    if (typeof nestedValue === 'string') {
      return nestedValue;
    }
  }

  return undefined;
}

export function resolveConfirmSelfBindingResponse(response: ConfirmSelfBindingResponse): AuthFlowDecision {
  if (response.status === 'AUTHENTICATED') {
    return {
      kind: 'authenticated',
      entrypoint: {
        target: 'SECTION02_OPERATOR_RESOLVER',
        actor: response
      }
    };
  }

  if (response.status === 'EMPLOYEE_INACTIVE') {
    return { kind: 'route', route: { screenId: 'S01-N05', loading: false, reason: 'EMPLOYEE_INACTIVE' } };
  }

  return unsupportedStatusRoute();
}

export function technicalFailureRoute(): Section01RouteState {
  return { screenId: 'S01-N04', loading: false, reason: 'TECHNICAL_FAILURE' };
}

export function contactUnavailableRoute(): Section01RouteState {
  return { screenId: 'S01-N04', loading: false, reason: 'TELEGRAM_CONTACT_UNAVAILABLE' };
}

function unsupportedStatusRoute(): AuthFlowDecision & { kind: 'route' } {
  return { kind: 'route', route: { screenId: 'S01-N04', loading: false, reason: 'UNSUPPORTED_STATUS' } };
}

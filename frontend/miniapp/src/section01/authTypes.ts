export type Section01ScreenId = 'S01-N01' | 'S01-N02' | 'S01-N03' | 'S01-N04' | 'S01-N05';

export type AuthenticatedUserContext = {
  status: 'AUTHENTICATED';
  actor_employee_id: string;
  telegram_user_id: string;
  telegram_username: string | null;
};

export type AuthMeResponse = AuthenticatedUserContext | { status: 'PHONE_BINDING_REQUIRED' };

export type IdentifyByPhoneResponse =
  | {
      status: 'CONFIRM_EMPLOYEE';
      full_name: string;
      confirmation_token: string;
    }
  | { status: 'PHONE_NOT_FOUND' }
  | { status: 'EMPLOYEE_INACTIVE' }
  | { status: 'CONTACT_PROOF_REQUIRED' };

export type ConfirmSelfBindingResponse =
  | AuthenticatedUserContext
  | { status: 'TOKEN_INVALID' }
  | { status: 'TOKEN_EXPIRED' }
  | { status: 'BINDING_STATE_CHANGED' }
  | { status: 'EMPLOYEE_INACTIVE' }
  | { status: 'PHONE_ALREADY_BOUND_TO_ANOTHER_EMPLOYEE' };

export type Section01LiveDiagnostic = {
  buildMarker: string;
  stage: string;
  locationPath: string;
  telegramObject: boolean;
  telegramWebApp: boolean;
  initDataExists: boolean;
  initDataLength: number;
  initDataKeys: string[];
  authRequestUrl: string;
  authRequestSent: boolean;
  authResponseStatus?: number;
  authResponseState?: string;
  authResponseKeys?: string[];
  errorName?: string;
  errorMessage?: string;
};

export type Section01RouteState =
  | { screenId: 'S01-N01'; loading: boolean }
  | { screenId: 'S01-N02'; loading: boolean }
  | { screenId: 'S01-N03'; loading: boolean; fullName: string; confirmationToken: string }
  | {
      screenId: 'S01-N04';
      loading: boolean;
      reason: 'TECHNICAL_FAILURE' | 'UNSUPPORTED_STATUS' | 'TELEGRAM_CONTACT_UNAVAILABLE';
      diagnostic?: Section01LiveDiagnostic;
    }
  | { screenId: 'S01-N05'; loading: boolean; reason: 'PHONE_NOT_FOUND' | 'EMPLOYEE_INACTIVE' | 'USER_SELECTED_NOT_ME' | 'PHONE_ALREADY_BOUND_TO_ANOTHER_EMPLOYEE' };

export type AuthenticatedEntrypoint = {
  target: 'SECTION02_OPERATOR_RESOLVER';
  actor: AuthenticatedUserContext;
};

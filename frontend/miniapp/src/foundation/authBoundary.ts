export type AuthRouteDecision =
  | { screenId: 'S01-N01'; reason: 'checking' }
  | { screenId: 'S01-N02'; reason: 'phone_share_required' }
  | { screenId: 'S01-N03'; reason: 'employee_confirmation_required'; confirmationToken: string; fullName: string }
  | { screenId: 'S01-N04'; reason: 'service_unavailable' }
  | { screenId: 'S01-N05'; reason: 'access_denied' }
  | { screenId: 'S02-N02'; reason: 'authenticated_operator' };

export type TelegramAuthSource = {
  getInitData(): string | undefined;
  requestVerifiedPhone(): Promise<{ phone_number: string }>;
};

export function requireTelegramInitData(source: TelegramAuthSource): string {
  const initData = source.getInitData();
  if (!initData) {
    throw new Error('Telegram init data is required');
  }
  return initData;
}

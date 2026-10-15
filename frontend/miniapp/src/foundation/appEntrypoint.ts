import type { ApiClient } from './apiClient';

export const appEntrypointPath = '/auth/app-entrypoint';

export type AppEntrypointSection = 'section02' | 'section03' | 'section04';

export type AppEntrypointResponse = {
  section: AppEntrypointSection;
  screen: 'S02-N01' | 'S03-N01' | 'S04-N01';
  contour: 'operator' | 'production_manager' | 'director';
  actor: {
    employee_id: string;
  };
  role_hints: string[];
  resolution_source:
    | 'director_role'
    | 'production_manager_capability'
    | 'production_manager_role'
    | 'operator_default';
};

export function getAppEntrypoint(apiClient: ApiClient): Promise<AppEntrypointResponse> {
  return apiClient.request<AppEntrypointResponse>(appEntrypointPath);
}

import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../foundation/apiClient';
import { SECTION03_AUDIT_REASON } from './program';
import {
  managerSection03Paths,
  requestFinishOperationalDowntime,
  requestManagerMachineCard,
  requestManagerMachines,
  requestManagerWorkplaceState,
} from './api';

function client() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  return { apiClient: new ApiClient({ baseUrl: 'https://api.test', fetchImpl }), calls, fetchImpl };
}

describe('Section03 API boundary', () => {
  it('uses exact GET paths', async () => {
    const target = client();
    await requestManagerWorkplaceState(target.apiClient, 101);
    await requestManagerMachines(target.apiClient, 102);
    expect(target.calls.map((call) => call.url)).toEqual(['https://api.test/manager/workplace-state?_=101', 'https://api.test/manager/machines?_=102']);
    expect(target.calls.map((call) => call.init.method)).toEqual(['GET', 'GET']);
  });

  it('encodes path IDs for card and finish endpoints', async () => {
    const target = client();
    await requestManagerMachineCard(target.apiClient, 'M 1/2', 103);
    await requestFinishOperationalDowntime(target.apiClient, { downtime_id: 'D 1/2', reason: SECTION03_AUDIT_REASON });
    expect(target.calls[0].url).toBe('https://api.test/manager/machines/M%201%2F2?_=103');
    expect(target.calls[1].url).toBe('https://api.test/machine-downtimes/D%201%2F2/finish');
  });

  it('posts the exact legacy finish comment and reason', async () => {
    const target = client();
    await requestFinishOperationalDowntime(target.apiClient, { downtime_id: 'D-1', reason: SECTION03_AUDIT_REASON });
    expect(target.calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(target.calls[0].init.body))).toEqual({ comment: SECTION03_AUDIT_REASON, reason: SECTION03_AUDIT_REASON });
  });

  it('propagates transport errors without alternate reads', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'down' }), { status: 503 }));
    const apiClient = new ApiClient({ baseUrl: 'https://api.test', fetchImpl });
    await expect(requestManagerWorkplaceState(apiClient)).rejects.toThrow('Backend request failed');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('keeps endpoint path helpers exact', () => {
    expect(managerSection03Paths.workplaceState).toBe('/manager/workplace-state');
    expect(managerSection03Paths.machines).toBe('/manager/machines');
    expect(managerSection03Paths.machineCard('M-1')).toBe('/manager/machines/M-1');
    expect(managerSection03Paths.finishDowntime('D-1')).toBe('/machine-downtimes/D-1/finish');
  });
});

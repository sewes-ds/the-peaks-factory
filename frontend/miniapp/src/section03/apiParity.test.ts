import { describe, expect, it, vi } from 'vitest';

import { ApiClient } from '../foundation/apiClient';
import {
  SECTION03_TECHNICAL_TEXT,
  requestAccrueAdditionalWork,
  requestApproveAdditionalWork,
  requestAssignAdditionalWork,
  requestCancelAdditionalWork,
  requestCloseShift,
  requestCreateAndApproveSalaryCorrection,
  requestCreateGoogleSheetsExport,
  requestCreateProductionCorrection,
  requestFinishAdditionalWork,
  requestFinishBreak,
  requestFinishOperationalDowntime,
  requestFinishProduction,
  requestMarkAdditionalWorkWithoutAccrual,
  requestRejectAdditionalWork,
  requestReverseSalaryEntry,
  requestStartDowntime,
} from './api';

function harness() {
  const calls: Array<{ path: string; method: string; body: unknown }> = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    calls.push({
      path,
      method: init?.method ?? 'GET',
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    const response = { id: 'OK-1' };
    return new Response(JSON.stringify(response), { status: 200 });
  });
  return { calls, apiClient: new ApiClient({ baseUrl: 'https://api.test', fetchImpl }) };
}

describe('Section 03 mutation parity boundary', () => {
  it('sends every legacy method, path and body exactly', async () => {
    const target = harness();
    await requestFinishProduction(target.apiClient, 'P 1', '12.5');
    await requestFinishBreak(target.apiClient, 'E 1');
    await requestFinishAdditionalWork(target.apiClient, 'AW 1');
    await requestCloseShift(target.apiClient, 'E 1', 'reason');
    await requestFinishOperationalDowntime(target.apiClient, { downtime_id: 'D 1', reason: 'finish' });
    await requestStartDowntime(target.apiClient, { machine_id: 'M-1', downtime_type_id: 'DT-1', production_operation_id: null, comment: 'start' });
    await requestApproveAdditionalWork(target.apiClient, 'AW 1');
    await requestRejectAdditionalWork(target.apiClient, 'AW 1');
    await requestCancelAdditionalWork(target.apiClient, 'AW 1');
    await requestAccrueAdditionalWork(target.apiClient, 'AW 1', '9000');
    await requestMarkAdditionalWorkWithoutAccrual(target.apiClient, 'AW 1', 'without');
    await requestAssignAdditionalWork(target.apiClient, 'E-1', 'AWT-1');
    await requestCreateAndApproveSalaryCorrection(target.apiClient, {
      employee_id: 'E-1', employee_shift_id: 'ES-1', salary_correction_type_id: 'SCT-1', amount: '-500', reason: 'correction',
    });
    await requestReverseSalaryEntry(target.apiClient, 'SE 1', 'reverse');
    await requestCreateProductionCorrection(target.apiClient, { production_operation_id: 'P-1', old_quantity: '10', new_quantity: '12', reason: 'fix' });
    await requestCreateGoogleSheetsExport(target.apiClient, '2026-07-01', '2026-07-31');

    expect(target.calls).toEqual([
      { path: '/production-operations/P%201/finish', method: 'POST', body: { quantity_produced: '12.5', comment: SECTION03_TECHNICAL_TEXT.shiftClose } },
      { path: '/operator-breaks/E%201/emergency-finish', method: 'POST', body: { reason: SECTION03_TECHNICAL_TEXT.shiftClose } },
      { path: '/additional-works/AW%201/finish', method: 'POST', body: { comment: SECTION03_TECHNICAL_TEXT.shiftClose } },
      { path: '/shifts/E%201/emergency-close', method: 'POST', body: { reason: 'reason' } },
      { path: '/machine-downtimes/D%201/finish', method: 'POST', body: { comment: 'finish', reason: 'finish' } },
      { path: '/machine-downtimes/start', method: 'POST', body: { machine_id: 'M-1', downtime_type_id: 'DT-1', production_operation_id: null, comment: 'start' } },
      { path: '/additional-works/AW%201/approve-request', method: 'POST', body: { comment: SECTION03_TECHNICAL_TEXT.additionalWorkApprove } },
      { path: '/additional-works/AW%201/reject-request', method: 'POST', body: { reason: SECTION03_TECHNICAL_TEXT.additionalWorkReject } },
      { path: '/additional-works/AW%201/cancel', method: 'POST', body: { reason: SECTION03_TECHNICAL_TEXT.additionalWorkCancel } },
      { path: '/additional-works/AW%201/accrue-salary', method: 'POST', body: { amount_uzs: '9000', quantity: null } },
      { path: '/additional-works/AW%201/mark-without-accrual', method: 'POST', body: { reason: 'without' } },
      { path: '/additional-works/assign', method: 'POST', body: { employee_id: 'E-1', additional_work_type_id: 'AWT-1' } },
      { path: '/salary-corrections/apply', method: 'POST', body: { employee_id: 'E-1', employee_shift_id: 'ES-1', salary_correction_type_id: 'SCT-1', amount: '-500', reason: 'correction' } },
      { path: '/salary-entries/SE%201/reverse', method: 'POST', body: { reason: 'reverse' } },
      { path: '/production-operation-corrections/apply', method: 'POST', body: { production_operation_id: 'P-1', old_quantity: '10', new_quantity: '12', reason: 'fix' } },
      { path: '/exports/google-sheets', method: 'POST', body: { export_type: 'management_mvp_export', from_date: '2026-07-01', to_date: '2026-07-31' } },
    ]);
  });
});

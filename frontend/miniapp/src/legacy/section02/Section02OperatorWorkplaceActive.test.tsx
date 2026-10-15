import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Section02OperatorWorkplaceActive } from './Section02OperatorWorkplaceActive';
import type { OperatorWorkplaceStateResponse } from '../../section02/operatorWorkplace';

const containers: HTMLDivElement[] = [];

afterEach(() => {
  for (const container of containers) {
    container.remove();
  }
  containers.length = 0;
});

describe('Section02OperatorWorkplaceActive D1 downtime action boundary', () => {
  it('shows START_DOWNTIME only when both backend pipeline token and downtime projection allow it', async () => {
    const visible = await renderWorkplace({
      shift: { is_active: true },
      available_pipelines: ['START_DOWNTIME'],
      downtime: { can_start_downtime: true }
    });
    expect(visible.querySelector('[data-action-id="start_downtime"]')).not.toBeNull();

    const missingToken = await renderWorkplace({
      shift: { is_active: true },
      available_pipelines: [],
      downtime: { can_start_downtime: true }
    });
    expect(missingToken.querySelector('[data-action-id="start_downtime"]')).toBeNull();

    const projectionDenied = await renderWorkplace({
      shift: { is_active: true },
      available_pipelines: ['START_DOWNTIME'],
      downtime: { can_start_downtime: false }
    });
    expect(projectionDenied.querySelector('[data-action-id="start_downtime"]')).toBeNull();
  });

  it('keeps FINISH_DOWNTIME projection behavior independent from START_DOWNTIME gating', async () => {
    const container = await renderWorkplace({
      shift: { is_active: true },
      available_pipelines: [],
      downtime: {
        can_start_downtime: false,
        can_finish_downtime: true,
        downtime_class: 'CRITICAL',
        downtime_type_name: 'Поломка'
      }
    });

    expect(container.querySelector('[data-action-id="start_downtime"]')).toBeNull();
    expect(container.querySelector('[data-action-id="finish_downtime_critical"]')).not.toBeNull();
  });

  it('does not infer active downtime class from the backend color token', async () => {
    const container = await renderWorkplace({
      shift: { is_active: true },
      available_pipelines: ['START_DOWNTIME'],
      downtime: {
        can_start_downtime: true,
        can_finish_downtime: true,
        downtime_class: 'UNKNOWN',
        ui_color_token: 'scarlet',
        downtime_type_name: 'Неизвестный тип'
      }
    });

    expect(container.querySelector('[data-action-id="start_downtime"]')).toBeNull();
    expect(container.querySelector('[data-action-id="finish_downtime_critical"]')).toBeNull();
    expect(container.querySelector('[data-action-id="finish_downtime_operational"]')).toBeNull();
  });
});

describe('Section02OperatorWorkplaceActive D2 additional-work boundary', () => {
  it('shows the additional-work entry only when OPEN_ADDITIONAL_WORK is backend-available', async () => {
    const visible = await renderWorkplace({
      shift: { is_active: true },
      available_pipelines: ['OPEN_ADDITIONAL_WORK']
    });
    expect(visible.querySelector('[data-action-id="additional_work"]')).not.toBeNull();

    const hidden = await renderWorkplace({
      shift: { is_active: true },
      available_pipelines: ['REQUEST_ADDITIONAL_WORK']
    });
    expect(hidden.querySelector('[data-action-id="additional_work"]')).toBeNull();
  });
});

async function renderWorkplace(workplaceState: OperatorWorkplaceStateResponse): Promise<HTMLDivElement> {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<Section02OperatorWorkplaceActive workplaceState={workplaceState} />);
  });

  return container;
}

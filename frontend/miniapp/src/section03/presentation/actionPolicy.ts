import type { ControlSemanticKey } from '../../foundation/presentation';

type Section03ActionEvidence = Readonly<{
  kind: 'business-action' | 'presentation-action';
  actionId: string;
  input: Readonly<{ instanceId?: string }>;
  event: unknown;
}>;

export const SECTION03_EXACT_ACTION_ROLES = Object.freeze({
  'employee-salary': 'navigation-open',
  'employee-completed-works': 'navigation-open',
  'employee-finish-shift': 'action-danger',
  'additional-work-assign': 'navigation-open',
  'additional-work-request-open-approve': 'action-positive',
  'additional-work-request-open-reject': 'action-neutral',
  'additional-work-request-approve': 'action-positive',
  'additional-work-request-reject': 'action-neutral',
  'additional-work-open-finish': 'action-positive',
  'additional-work-open-cancel': 'action-warning',
  'additional-work-finish': 'action-positive',
  'additional-work-cancel': 'action-warning',
  'additional-work-open-accrual': 'action-positive',
  'additional-work-open-without-accrual': 'action-neutral',
  'additional-work-amount-next': 'navigation-next',
  'additional-work-reason-next': 'navigation-next',
  'additional-work-accrue': 'action-positive',
  'additional-work-mark-without-accrual': 'action-neutral',
  'assign-additional-work': 'action-neutral',
  'shift-close-next': 'navigation-next',
  'shift-close-confirm': 'action-danger',
  'production-quantity-next': 'navigation-next',
  'production-finish-confirm': 'action-positive',
  'break-finish-confirm': 'action-warning',
  'additional-work-finish-confirm': 'action-neutral',
  'critical-finish-next': 'navigation-next',
  'downtime-comment-next': 'navigation-next',
  'downtimes-start': 'action-danger',
  'downtime-start-confirm': 'action-danger',
  'completed-work-correction': 'navigation-open',
  'completed-work-storno': 'navigation-open',
  'salary-history': 'navigation-open',
  'corrections-finance': 'navigation-open',
  'corrections-production': 'navigation-open',
  'financial-correction-employee': 'navigation-open',
  'financial-correction-storno': 'navigation-open',
  'financial-correction-accrual': 'action-positive',
  'financial-correction-withholding': 'action-danger',
  'financial-correction-amount-next': 'navigation-next',
  'financial-correction-comment-next': 'navigation-next',
  'financial-correction-create-approve': 'action-positive',
  'reversal-open-confirmation': 'action-danger',
  'reversal-reason-next': 'navigation-next',
  'reversal-confirm': 'action-danger',
  'production-correction-by-employee': 'navigation-open',
  'production-correction-by-machine': 'navigation-open',
  'production-correction-mode-increase': 'selection-primary',
  'production-correction-mode-decrease': 'selection-primary',
  'production-correction-mode-final': 'selection-primary',
  'production-correction-quantity-next': 'navigation-next',
  'production-correction-comment-next': 'navigation-next',
  'production-correction-confirm': 'action-positive',
  'reports-google-sheets': 'navigation-open',
  'reports-period-custom': 'selection-secondary',
  'reports-start-date-next': 'navigation-next',
  'reports-end-date-next': 'navigation-next',
  'reports-export-create': 'action-positive-neutral-context',
  'reports-export-home': 'navigation-open',
} as const satisfies Readonly<Record<string, ControlSemanticKey>>);

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : null;
}

function dynamicRole(instanceId: string): ControlSemanticKey | null {
  if (instanceId.endsWith('-back')) return 'navigation-back';
  if (instanceId.startsWith('machine-finish-operational-') || instanceId.startsWith('finish-operational-')) {
    return 'action-warning';
  }
  if (
    instanceId.startsWith('machine-finish-critical-') ||
    instanceId.startsWith('finish-critical-') ||
    instanceId.startsWith('machine-start-downtime-')
  ) {
    return 'action-danger';
  }
  if (instanceId.startsWith('business-')) return 'action-warning';
  if (instanceId.startsWith('close-employee-shift-')) return 'action-danger';
  if (instanceId.startsWith('finish-production-')) return 'action-positive';
  if (instanceId.startsWith('finish-break-')) return 'action-warning';
  if (instanceId.startsWith('finish-additional-work-')) return 'action-neutral';
  if (instanceId.startsWith('navigate-')) return 'navigation-next';
  if (instanceId.startsWith('reports-period-')) return 'selection-primary';
  if (instanceId.startsWith('production-correction-period-')) return 'navigation-open';
  if (instanceId.startsWith('period-')) return 'navigation-open';
  return null;
}

export function resolveSection03ActionRole(action: object): ControlSemanticKey {
  const evidence = action as Partial<Section03ActionEvidence>;
  const instanceId = record(evidence.input)?.instanceId;
  if (
    (evidence.kind !== 'business-action' && evidence.kind !== 'presentation-action') ||
    typeof evidence.actionId !== 'string' ||
    typeof instanceId !== 'string' ||
    instanceId.length === 0
  ) {
    throw new Error('SECTION03_INVALID_GRAPH_ACTION_EVIDENCE');
  }

  if (instanceId === 'financial-correction-create-approve') {
    const correctionMode = record(evidence.event)?.correction_mode;
    if (correctionMode === 'withholding') return 'action-danger';
    if (correctionMode === 'accrual') return 'action-positive';
    throw new Error('SECTION03_INVALID_FINANCIAL_CORRECTION_ACTION_EVIDENCE');
  }

  const exact = SECTION03_EXACT_ACTION_ROLES[instanceId as keyof typeof SECTION03_EXACT_ACTION_ROLES];
  if (exact !== undefined) return exact;
  const dynamic = dynamicRole(instanceId);
  if (dynamic !== null) return dynamic;
  throw new Error(`SECTION03_UNKNOWN_GRAPH_ACTION_ROLE:${evidence.kind}:${evidence.actionId}:${instanceId}`);
}

export function section03ActionInstanceId(action: object): string {
  const instanceId = record((action as Partial<Section03ActionEvidence>).input)?.instanceId;
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    throw new Error('SECTION03_INVALID_GRAPH_ACTION_INSTANCE_ID');
  }
  return instanceId;
}

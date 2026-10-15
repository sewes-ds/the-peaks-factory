import type {
  ControlPresentation,
  ControlSemanticKey,
} from '../controls';
import type {
  ContentFeedbackKind,
  ContentFeedbackPresentation,
  ControlFeedbackPresentation,
} from '../feedback';
import type {
  PresentationFormDraftController,
  PresentationFormFieldPresentation,
} from '../forms';
import type {
  StatePresentation,
  StatePresentationKey,
} from '../states';
import type {
  PlatformAuthorityKind,
  PlatformPresentationPolicy,
} from '../authority';
import type {
  PresentationGraphContentInput,
  ResolvedPresentationGraphContent,
} from './content';
import type { PresentationGraphExecutionPort } from './port';

export const PRESENTATION_GRAPH_BRIDGE_ITEM_KINDS = Object.freeze([
  'control-action-button',
  'control-list-button',
  'state-list-button',
  'entity-row',
  'card',
  'summary-line',
  'message',
  'feedback-block',
  'form-field',
] as const);

export type PresentationGraphBridgeItemKind =
  typeof PRESENTATION_GRAPH_BRIDGE_ITEM_KINDS[number];

export type ActionInteractionBinding = Readonly<{
  kind: 'action';
  action: object;
  baseAvailability: 'enabled' | 'disabled';
}>;

export type InertInteractionBinding = Readonly<{
  kind: 'inert';
}>;

export type BridgeInteractionBinding =
  | ActionInteractionBinding
  | InertInteractionBinding;

type ItemBase<TKind extends PresentationGraphBridgeItemKind> = Readonly<{
  kind: TKind;
  id: string;
}>;

export type PresentationGraphAuthorityRequest = Readonly<{
  policy: PlatformPresentationPolicy;
  rootId: string;
  evidence: unknown;
}>;

export type PresentationGraphAuthorityDiagnostics = Readonly<{
  policyId: string;
  rootId: string;
  ownerRootId: string;
  role: string;
  authority: PlatformAuthorityKind;
}>;

type StateAppearanceInput =
  | Readonly<{
      stateKey: StatePresentationKey;
      presentationAuthority?: never;
    }>
  | Readonly<{
      stateKey?: never;
      presentationAuthority: PresentationGraphAuthorityRequest;
    }>;

type ControlAppearanceInput =
  | Readonly<{
      controlKey: ControlSemanticKey;
      presentationAuthority?: never;
    }>
  | Readonly<{
      controlKey?: never;
      presentationAuthority: PresentationGraphAuthorityRequest;
    }>;

export type PresentationGraphSecondaryLineInput = Readonly<{
  id: string;
  content: PresentationGraphContentInput;
}> & StateAppearanceInput;

export type PresentationGraphLabeledCardLineInput = Readonly<{
  id: string;
  label: PresentationGraphContentInput;
  value: PresentationGraphContentInput;
  content?: never;
}>;

export type PresentationGraphContentCardLineInput = Readonly<{
  id: string;
  content: PresentationGraphContentInput;
  label?: never;
  value?: never;
}>;

export type PresentationGraphCardLineInput =
  | PresentationGraphLabeledCardLineInput
  | PresentationGraphContentCardLineInput;

export type PresentationGraphRetryInput = Readonly<{
  interaction: ActionInteractionBinding;
  label: PresentationGraphContentInput;
}>;

export type ControlActionButtonBridgeItemInput =
  ItemBase<'control-action-button'> & Readonly<{
    interaction: BridgeInteractionBinding;
    label: PresentationGraphContentInput;
    ariaLabel?: string;
  }> & ControlAppearanceInput;

export type ControlListButtonBridgeItemInput =
  ItemBase<'control-list-button'> & Readonly<{
    interaction: ActionInteractionBinding;
    mainLine: PresentationGraphContentInput;
    secondaryLine?: PresentationGraphContentInput;
    secondaryLines?: readonly PresentationGraphSecondaryLineInput[];
    ariaLabel?: string;
  }> & ControlAppearanceInput;

export type StateListButtonBridgeItemInput =
  ItemBase<'state-list-button'> & Readonly<{
    interaction: BridgeInteractionBinding;
    mainLine: PresentationGraphContentInput;
    secondaryLine?: PresentationGraphContentInput;
    secondaryLines?: readonly PresentationGraphSecondaryLineInput[];
    ariaLabel?: string;
  }> & StateAppearanceInput;

export type EntityRowBridgeItemInput =
  ItemBase<'entity-row'> & Readonly<{
    interaction: BridgeInteractionBinding;
    primary: PresentationGraphContentInput;
    secondary?: PresentationGraphContentInput;
    ariaLabel?: string;
  }> & StateAppearanceInput;

export type CardBridgeItemInput = ItemBase<'card'> & Readonly<{
  title?: PresentationGraphContentInput;
  lines: readonly PresentationGraphCardLineInput[];
  ariaLabel?: string;
}> & StateAppearanceInput;

export type InteractiveCardBridgeItemInput = ItemBase<'card'> & Readonly<{
  interaction: ActionInteractionBinding;
  title?: PresentationGraphContentInput;
  lines: readonly PresentationGraphCardLineInput[];
  ariaLabel?: string;
}> & StateAppearanceInput;

export type SummaryLineBridgeItemInput =
  ItemBase<'summary-line'> & Readonly<{
    content: PresentationGraphContentInput;
    ariaLabel?: string;
  }> & StateAppearanceInput;

export type MessageBridgeItemInput = ItemBase<'message'> & Readonly<{
  content: PresentationGraphContentInput;
  ariaLabel?: string;
  role?: 'status' | 'alert';
  ariaLive?: 'polite' | 'assertive';
  ariaBusy?: boolean;
}> & StateAppearanceInput;

export type FeedbackBlockBridgeItemInput =
  ItemBase<'feedback-block'> & Readonly<{
    feedbackKind: ContentFeedbackKind;
    message: PresentationGraphContentInput;
    retry?: PresentationGraphRetryInput;
  }>;

export type FormFieldBridgeItemInput = ItemBase<'form-field'> & Readonly<{
  controller: PresentationFormDraftController;
  fieldId: string;
}>;

export type PresentationGraphBridgeItemInput =
  | ControlActionButtonBridgeItemInput
  | ControlListButtonBridgeItemInput
  | StateListButtonBridgeItemInput
  | EntityRowBridgeItemInput
  | CardBridgeItemInput
  | InteractiveCardBridgeItemInput
  | SummaryLineBridgeItemInput
  | MessageBridgeItemInput
  | FeedbackBlockBridgeItemInput
  | FormFieldBridgeItemInput;

export type PresentationGraphBridgeProjection = Readonly<{
  nodeId: string;
  items: readonly PresentationGraphBridgeItemInput[];
}>;

export type PresentationGraphBridgeResolveOptions = Readonly<{
  interactionPending: boolean;
}>;

type ActionDiagnostics = Readonly<{
  actionId: string;
  actionClass: 'business' | 'presentation';
  onPress: (() => void) | undefined;
}>;

type OptionalActionDiagnostics = Readonly<{
  actionId: string | null;
  actionClass: 'business' | 'presentation' | null;
  onPress: (() => void) | undefined;
}>;

type ResolvedItemBase<TKind extends PresentationGraphBridgeItemKind> =
  ItemBase<TKind> & Readonly<{
    presentationAuthority?: PresentationGraphAuthorityDiagnostics;
  }>;

export type ResolvedPresentationGraphSecondaryLine = Readonly<{
  id: string;
  presentationAuthority?: PresentationGraphAuthorityDiagnostics;
  presentation: StatePresentation & Readonly<{
    surface: 'summary-line';
  }>;
  content: ResolvedPresentationGraphContent;
}>;

export type ResolvedPresentationGraphLabeledCardLine = Readonly<{
  id: string;
  label: ResolvedPresentationGraphContent;
  value: ResolvedPresentationGraphContent;
}>;

export type ResolvedPresentationGraphContentCardLine = Readonly<{
  id: string;
  content: ResolvedPresentationGraphContent;
}>;

export type ResolvedPresentationGraphCardLine =
  | ResolvedPresentationGraphLabeledCardLine
  | ResolvedPresentationGraphContentCardLine;

export type ResolvedControlActionButtonBridgeItem =
  ResolvedItemBase<'control-action-button'> &
  OptionalActionDiagnostics & Readonly<{
    presentation: ControlPresentation & Readonly<{
      surface: 'action-button';
    }>;
    feedback: ControlFeedbackPresentation;
    label: ResolvedPresentationGraphContent;
    ariaLabel?: string;
  }>;

export type ResolvedControlListButtonBridgeItem =
  ResolvedItemBase<'control-list-button'> &
  ActionDiagnostics & Readonly<{
    presentation: ControlPresentation & Readonly<{
      surface: 'list-button';
    }>;
    feedback: ControlFeedbackPresentation;
    mainLine: ResolvedPresentationGraphContent;
    secondaryLine?: ResolvedPresentationGraphContent;
    secondaryLines?: readonly ResolvedPresentationGraphSecondaryLine[];
    ariaLabel?: string;
  }>;

type StateActionDiagnostics = Readonly<{
  actionId: string | null;
  actionClass: 'business' | 'presentation' | null;
  onPress: (() => void) | undefined;
}>;

export type ResolvedStateListButtonBridgeItem =
  ResolvedItemBase<'state-list-button'> &
  StateActionDiagnostics & Readonly<{
    presentation: StatePresentation & Readonly<{
      surface: 'list-button';
    }>;
    feedback: ControlFeedbackPresentation;
    mainLine: ResolvedPresentationGraphContent;
    secondaryLine?: ResolvedPresentationGraphContent;
    secondaryLines?: readonly ResolvedPresentationGraphSecondaryLine[];
    ariaLabel?: string;
  }>;

export type ResolvedEntityRowBridgeItem =
  ResolvedItemBase<'entity-row'> &
  StateActionDiagnostics & Readonly<{
    presentation: StatePresentation & Readonly<{
      surface: 'entity-row';
    }>;
    feedback: ControlFeedbackPresentation;
    primary: ResolvedPresentationGraphContent;
    secondary?: ResolvedPresentationGraphContent;
    ariaLabel?: string;
  }>;

export type ResolvedCardBridgeItem = ResolvedItemBase<'card'> & StateActionDiagnostics & Readonly<{
  presentation: StatePresentation & Readonly<{ surface: 'card' }>;
  feedback: ControlFeedbackPresentation;
  title?: ResolvedPresentationGraphContent;
  lines: readonly ResolvedPresentationGraphCardLine[];
  ariaLabel?: string;
}>;

export type ResolvedSummaryLineBridgeItem =
  ResolvedItemBase<'summary-line'> & Readonly<{
    presentation: StatePresentation & Readonly<{
      surface: 'summary-line';
    }>;
    content: ResolvedPresentationGraphContent;
    ariaLabel?: string;
  }>;

export type ResolvedMessageBridgeItem =
  ResolvedItemBase<'message'> & Readonly<{
    presentation: StatePresentation & Readonly<{ surface: 'message' }>;
    content: ResolvedPresentationGraphContent;
    ariaLabel?: string;
    role?: 'status' | 'alert';
    ariaLive?: 'polite' | 'assertive';
    ariaBusy?: boolean;
  }>;

export type ResolvedFeedbackBlockBridgeItem =
  ResolvedItemBase<'feedback-block'> & Readonly<{
    presentation: ContentFeedbackPresentation;
    message: ResolvedPresentationGraphContent;
    retryLabel: ResolvedPresentationGraphContent | null;
    retryFeedback: ControlFeedbackPresentation | null;
    actionId: string | null;
    actionClass: 'business' | 'presentation' | null;
    onRetry: (() => void) | null;
  }>;

export type ResolvedFormFieldBridgeItem =
  ResolvedItemBase<'form-field'> & Readonly<{
    field: PresentationFormFieldPresentation;
    onValueChange: (value: string) => void;
  }>;

export type ResolvedPresentationGraphBridgeItem =
  | ResolvedControlActionButtonBridgeItem
  | ResolvedControlListButtonBridgeItem
  | ResolvedStateListButtonBridgeItem
  | ResolvedEntityRowBridgeItem
  | ResolvedCardBridgeItem
  | ResolvedSummaryLineBridgeItem
  | ResolvedMessageBridgeItem
  | ResolvedFeedbackBlockBridgeItem
  | ResolvedFormFieldBridgeItem;

export type PresentationGraphBridgeView = Readonly<{
  nodeId: string;
  items: readonly ResolvedPresentationGraphBridgeItem[];
}>;

export type PresentationGraphBridge = Readonly<{
  port: PresentationGraphExecutionPort;
  resolve: (
    projection: unknown,
    options: unknown,
  ) => PresentationGraphBridgeView;
}>;

export const PRESENTATION_GRAPH_BRIDGE_ERROR_CODES = Object.freeze([
  'INVALID_GRAPH_BRIDGE_PORT',
  'INVALID_GRAPH_BRIDGE_PROJECTION',
  'UNKNOWN_GRAPH_BRIDGE_PROJECTION_FIELD',
  'GRAPH_BRIDGE_NODE_MISMATCH',
  'INVALID_GRAPH_BRIDGE_OPTIONS',
  'UNKNOWN_GRAPH_BRIDGE_OPTION_FIELD',
  'INVALID_INTERACTION_PENDING',
  'INVALID_GRAPH_BRIDGE_ITEM',
  'UNKNOWN_GRAPH_BRIDGE_ITEM_FIELD',
  'INVALID_GRAPH_BRIDGE_ITEM_KIND',
  'INVALID_RENDER_ID',
  'DUPLICATE_RENDER_ID',
  'INVALID_ARIA_LABEL',
  'INVALID_INTERACTION_BINDING',
  'UNKNOWN_INTERACTION_BINDING_FIELD',
  'INVALID_BASE_AVAILABILITY',
  'ACTION_REQUIRED',
  'ACTION_FORBIDDEN',
  'ACTION_NOT_OWNED',
  'INVALID_ACTION_DESCRIPTOR',
  'ACTION_DESCRIPTOR_MISMATCH',
  'INVALID_CONTROL_BINDING',
  'INVALID_STATE_BINDING',
  'INVALID_PRESENTATION_AUTHORITY',
  'PRESENTATION_AUTHORITY_EXTERNAL_ERROR',
  'INVALID_SECONDARY_CONTENT',
  'INVALID_SECONDARY_LINES',
  'DUPLICATE_SECONDARY_LINE_ID',
  'INVALID_CARD_LINES',
  'DUPLICATE_CARD_LINE_ID',
  'INVALID_MESSAGE_ARIA',
  'RETRY_BINDING_REQUIRED',
  'RETRY_BINDING_FORBIDDEN',
  'INVALID_FORM_BINDING',
  'BRIDGE_ITEM_NOT_OWNED',
] as const);

export type PresentationGraphBridgeErrorCode =
  typeof PRESENTATION_GRAPH_BRIDGE_ERROR_CODES[number];

export class PresentationGraphBridgeError extends Error {
  readonly code: PresentationGraphBridgeErrorCode;
  readonly renderId: string | null;
  readonly actionId: string | null;
  readonly originalError: unknown;

  constructor(
    code: PresentationGraphBridgeErrorCode,
    details: Readonly<{
      renderId?: string;
      actionId?: string;
      originalError?: unknown;
    }> = Object.freeze({}),
  ) {
    super(code);
    this.name = 'PresentationGraphBridgeError';
    this.code = code;
    this.renderId = details.renderId ?? null;
    this.actionId = details.actionId ?? null;
    this.originalError = details.originalError;
    Object.freeze(this);
  }
}

const ownedItems = new WeakSet<object>();

export function ownPresentationGraphBridgeItem<
  TItem extends ResolvedPresentationGraphBridgeItem,
>(item: TItem): TItem {
  ownedItems.add(item);
  return item;
}

export function isPresentationGraphBridgeItemOwned(
  value: unknown,
): value is ResolvedPresentationGraphBridgeItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    ownedItems.has(value)
  );
}

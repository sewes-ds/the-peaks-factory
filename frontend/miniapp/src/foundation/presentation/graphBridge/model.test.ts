import { describe, expect, it } from 'vitest';

import {
  PRESENTATION_GRAPH_BRIDGE_ERROR_CODES,
  PRESENTATION_GRAPH_BRIDGE_ITEM_KINDS,
  PresentationGraphBridgeError,
} from './model';

describe('presentation Graph Bridge model', () => {
  it('declares the exact nine item kinds in order', () => {
    expect(PRESENTATION_GRAPH_BRIDGE_ITEM_KINDS).toEqual([
      'control-action-button',
      'control-list-button',
      'state-list-button',
      'entity-row',
      'card',
      'summary-line',
      'message',
      'feedback-block',
      'form-field',
    ]);
    expect(Object.isFrozen(PRESENTATION_GRAPH_BRIDGE_ITEM_KINDS)).toBe(true);
  });

  it('declares the exact closed frozen bridge errors', () => {
    expect(PRESENTATION_GRAPH_BRIDGE_ERROR_CODES).toEqual([
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
    ]);
    const originalError = new Error('source');
    const error = new PresentationGraphBridgeError(
      'ACTION_NOT_OWNED',
      { renderId: 'item', actionId: 'action', originalError },
    );
    expect(error).toMatchObject({
      code: 'ACTION_NOT_OWNED',
      renderId: 'item',
      actionId: 'action',
      originalError,
    });
    expect(Object.isFrozen(error)).toBe(true);
  });
});

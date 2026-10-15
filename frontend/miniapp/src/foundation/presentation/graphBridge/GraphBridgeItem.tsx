import { Fragment } from 'react';

import {
  PresentationFormField,
} from '../forms';
import {
  PresentationActionButton,
  PresentationCard,
  PresentationControlListButton,
  PresentationEntityRow,
  PresentationFeedbackBlock,
  PresentationMessage,
  PresentationStateListButton,
  PresentationSummaryLine,
} from '../primitives';
import { PresentationGraphBridgeContent } from './GraphBridgeContent';
import {
  PresentationGraphBridgeError,
  isPresentationGraphBridgeItemOwned,
  type ResolvedPresentationGraphBridgeItem,
} from './model';

export type PresentationGraphBridgeItemProps = Readonly<{
  item: ResolvedPresentationGraphBridgeItem;
}>;

export function PresentationGraphBridgeItem({
  item,
}: PresentationGraphBridgeItemProps) {
  const candidate: unknown = item;
  if (!isPresentationGraphBridgeItemOwned(item)) {
    throw new PresentationGraphBridgeError('BRIDGE_ITEM_NOT_OWNED', {
      renderId:
        typeof candidate === 'object' &&
        candidate !== null &&
        'id' in candidate &&
        typeof candidate.id === 'string'
          ? candidate.id
          : undefined,
    });
  }

  if (item.kind === 'control-action-button') {
    return (
      <PresentationActionButton
        ariaLabel={item.ariaLabel}
        feedback={item.feedback}
        label={<PresentationGraphBridgeContent content={item.label} />}
        presentation={item.presentation}
        onPress={item.onPress}
      />
    );
  }

  if (item.kind === 'control-list-button') {
    const secondaryLine = item.secondaryLines === undefined
      ? item.secondaryLine === undefined
        ? undefined
        : <PresentationGraphBridgeContent content={item.secondaryLine} />
      : (
        <>
          {item.secondaryLines.map((line) => (
            <PresentationSummaryLine
              key={line.id}
              presentation={line.presentation}
            >
              <PresentationGraphBridgeContent content={line.content} />
            </PresentationSummaryLine>
          ))}
        </>
      );
    return (
      <PresentationControlListButton
        ariaLabel={item.ariaLabel}
        feedback={item.feedback}
        mainLine={
          <PresentationGraphBridgeContent content={item.mainLine} />
        }
        presentation={item.presentation}
        secondaryLine={secondaryLine}
        onPress={item.onPress}
      />
    );
  }

  if (item.kind === 'state-list-button') {
    const secondaryLine = item.secondaryLines === undefined
      ? item.secondaryLine === undefined
        ? undefined
        : <PresentationGraphBridgeContent content={item.secondaryLine} />
      : (
        <>
          {item.secondaryLines.map((line) => (
            <PresentationSummaryLine
              key={line.id}
              presentation={line.presentation}
            >
              <PresentationGraphBridgeContent content={line.content} />
            </PresentationSummaryLine>
          ))}
        </>
      );
    return (
      <PresentationStateListButton
        ariaLabel={item.ariaLabel}
        feedback={item.feedback}
        mainLine={
          <PresentationGraphBridgeContent content={item.mainLine} />
        }
        presentation={item.presentation}
        secondaryLine={secondaryLine}
        onPress={item.onPress}
      />
    );
  }

  if (item.kind === 'entity-row') {
    return (
      <PresentationEntityRow
        ariaLabel={item.ariaLabel}
        feedback={item.feedback}
        presentation={item.presentation}
        primary={<PresentationGraphBridgeContent content={item.primary} />}
        secondary={
          item.secondary === undefined
            ? undefined
            : (
              <PresentationGraphBridgeContent content={item.secondary} />
            )
        }
        onPress={item.onPress}
      />
    );
  }

  if (item.kind === 'card') {
    const lines = Object.freeze(item.lines.map((line) => Object.freeze(
      'content' in line
        ? { content: <PresentationGraphBridgeContent content={line.content} /> }
        : {
            label: <PresentationGraphBridgeContent content={line.label} />,
            value: <PresentationGraphBridgeContent content={line.value} />,
          },
    )));
    return (
      <PresentationCard
        ariaLabel={item.ariaLabel}
        feedback={item.feedback}
        lines={lines}
        presentation={item.presentation}
        title={
          item.title === undefined
            ? undefined
            : <PresentationGraphBridgeContent content={item.title} />
        }
        onPress={item.onPress}
      />
    );
  }

  if (item.kind === 'summary-line') {
    return (
      <PresentationSummaryLine
        ariaLabel={item.ariaLabel}
        presentation={item.presentation}
      >
        <PresentationGraphBridgeContent content={item.content} />
      </PresentationSummaryLine>
    );
  }

  if (item.kind === 'message') {
    return (
      <PresentationMessage
        ariaBusy={item.ariaBusy}
        ariaLabel={item.ariaLabel}
        ariaLive={item.ariaLive}
        presentation={item.presentation}
        role={item.role}
      >
        <PresentationGraphBridgeContent content={item.content} />
      </PresentationMessage>
    );
  }

  if (item.kind === 'form-field') {
    return (
      <PresentationFormField
        field={item.field}
        onValueChange={item.onValueChange}
      />
    );
  }

  return (
    <PresentationFeedbackBlock
      message={<PresentationGraphBridgeContent content={item.message} />}
      presentation={item.presentation}
      retryFeedback={item.retryFeedback ?? undefined}
      retryLabel={
        item.retryLabel === null
          ? undefined
          : <PresentationGraphBridgeContent content={item.retryLabel} />
      }
      onRetry={item.onRetry ?? undefined}
    />
  );
}

export function presentationGraphBridgeItemFragment(
  item: ResolvedPresentationGraphBridgeItem,
) {
  return (
    <Fragment key={item.id}>
      <PresentationGraphBridgeItem item={item} />
    </Fragment>
  );
}

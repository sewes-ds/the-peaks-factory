import { useEffect, useRef, type MouseEventHandler, type ReactNode } from 'react';
import { assetUrl } from '../runtimePaths';
import {
  PeaksActionButton,
  PeaksListButton,
  type PeaksActionButtonSize,
  type PeaksActionButtonVariant,
  type PeaksListButtonVariant
} from './PeaksActionButton';

export type PeaksGraphInfoTone = 'default' | 'blue';
export type PeaksGraphCardTone = 'green' | 'yellow' | 'red' | 'gray';
export type PeaksGraphListLineTone = 'blue' | 'green' | 'yellow' | 'red' | 'gray';
export type PeaksGraphListLine = Readonly<{
  text: string;
  tone: PeaksGraphListLineTone;
}>;

export type PeaksGraphObject =
  | {
      kind: 'infoText';
      id?: string;
      text: ReactNode;
      tone?: PeaksGraphInfoTone;
      ariaLabel?: string;
    }
  | {
      kind: 'productionOperationCard';
      id?: string;
      lines: Array<{ label: string; value: ReactNode }>;
      tone?: PeaksGraphCardTone;
      ariaLabel?: string;
    }
  | {
      kind: 'messageText';
      id?: string;
      text: ReactNode;
      ariaLabel?: string;
    }
  | {
      kind: 'actionButton';
      id?: string;
      actionId: string;
      variant: PeaksActionButtonVariant;
      icon: string;
      label: ReactNode;
      size?: PeaksActionButtonSize;
      disabled?: boolean;
      onClick?: MouseEventHandler<HTMLButtonElement>;
      ariaLabel?: string;
      className?: string;
      showIcon?: boolean;
    }
  | {
      kind: 'listButton';
      id?: string;
      actionId: string;
      variant?: PeaksListButtonVariant;
      mainLine: ReactNode;
      secondaryLine?: ReactNode;
      secondaryLines?: readonly PeaksGraphListLine[];
      disabled?: boolean;
      onClick?: MouseEventHandler<HTMLButtonElement>;
      ariaLabel?: string;
      className?: string;
    }
  | {
      kind: 'custom';
      id?: string;
      className?: string;
      node: ReactNode;
    };

export type PeaksGraphNodeView = {
  nodeId: string;
  fixedTopObjects?: PeaksGraphObject[];
  scrollObjects: PeaksGraphObject[];
  fixedBottomObjects?: PeaksGraphObject[];
  ariaLabel?: string;
  className?: string;
  focusOnEntry?: boolean;
  ariaBusy?: boolean;
  liveStatus?: ReactNode;
};

export type PeaksGraphNodeRendererProps = {
  view: PeaksGraphNodeView;
};

export function PeaksGraphNodeRenderer({ view }: PeaksGraphNodeRendererProps) {
  const hasFixedTop = Boolean(view.fixedTopObjects?.length);
  const hasFixedBottom = Boolean(view.fixedBottomObjects?.length);
  const viewportRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (view.focusOnEntry) {
      viewportRef.current?.focus();
    }
  }, [view.focusOnEntry, view.nodeId]);

  // S03_SCROLL_RESET_ON_NODE_ENTRY_V3
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    if (typeof scrollElement.scrollTo === 'function') {
      scrollElement.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return;
    }

    scrollElement.scrollTop = 0;
    scrollElement.scrollLeft = 0;
  }, [view.nodeId]);

  return (
    <main
      ref={viewportRef}
      className={[
        'peaks-graph-viewport',
        hasFixedTop ? 'peaks-graph-viewport--has-fixed-top' : '',
        hasFixedBottom ? 'peaks-graph-viewport--has-fixed-bottom' : '',
        view.className ?? ''
      ]
        .filter(Boolean)
        .join(' ')}
      data-node-id={view.nodeId}
      aria-label={view.ariaLabel ?? view.nodeId}
      aria-busy={view.ariaBusy}
      tabIndex={view.focusOnEntry ? -1 : undefined}
    >
      {view.liveStatus ? (
        <div className="peaks-graph-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {view.liveStatus}
        </div>
      ) : null}
      <header className="peaks-graph-logo-area">
        <img className="peaks-graph-logo" src={assetUrl('assets/brand/peaks_logo.png')} alt="PEAKS" />
      </header>

      <section className="peaks-graph-area" aria-label="Область графа">
        {hasFixedTop ? (
          <section className="peaks-graph-fixed-top" aria-label="Верхние объекты графа">
            {view.fixedTopObjects?.map((object, index) => renderGraphObject(object, `fixed-top-${index}`))}
          </section>
        ) : null}

        <section ref={scrollRef} className="peaks-graph-scroll" aria-label="Прокручиваемые объекты графа">
          {view.scrollObjects.map((object, index) => renderGraphObject(object, `scroll-${index}`))}
        </section>

        {hasFixedBottom ? (
          <section className="peaks-graph-fixed-bottom" aria-label="Нижние фиксированные объекты графа">
            {view.fixedBottomObjects?.map((object, index) => renderGraphObject(object, `fixed-bottom-${index}`))}
          </section>
        ) : null}
      </section>
    </main>
  );
}

function renderGraphObject(object: PeaksGraphObject, fallbackKey: string) {
  const key = object.id ?? fallbackKey;

  if (object.kind === 'infoText') {
    return (
      <section
        className={['peaks-graph-object', 'peaks-graph-info-text', `peaks-graph-info-text--${object.tone ?? 'default'}`].join(' ')}
        key={key}
        aria-label={object.ariaLabel ?? 'Информация'}
      >
        {object.text}
      </section>
    );
  }

  if (object.kind === 'productionOperationCard') {
    return (
      <section
        className={[
          'peaks-graph-object',
          'peaks-graph-production-card',
          `peaks-graph-production-card--${object.tone ?? 'green'}`
        ].join(' ')}
        key={key}
        aria-label={object.ariaLabel ?? 'Информация о производственной операции'}
      >
        {object.lines.map((line) => (
          <p className="peaks-graph-production-card__line" key={line.label}>
            <span className="peaks-graph-production-card__label">{line.label}: </span>
            <span className="peaks-graph-production-card__value">{line.value || '—'}</span>
          </p>
        ))}
      </section>
    );
  }

  if (object.kind === 'messageText') {
    return (
      <section className="peaks-graph-object peaks-graph-message-text" key={key} aria-label={object.ariaLabel ?? 'Сообщение'}>
        {object.text}
      </section>
    );
  }

  if (object.kind === 'actionButton') {
    return (
      <div
        className={['peaks-graph-object', 'peaks-graph-action-object', object.className ?? '']
          .filter(Boolean)
          .join(' ')}
        data-action-id={object.actionId}
        key={key}
      >
        <PeaksActionButton
          ariaLabel={object.ariaLabel}
          className={object.className}
          disabled={object.disabled}
          icon={object.icon}
          label={object.label}
          showIcon={object.showIcon}
          size={object.size}
          variant={object.variant}
          onClick={object.onClick}
        />
      </div>
    );
  }

  if (object.kind === 'listButton') {
    const secondaryLine = object.secondaryLines && object.secondaryLines.length > 0
      ? (
        <span className="peaks-graph-list-lines">
          {object.secondaryLines.map((line, index) => (
            <span className={`peaks-graph-list-line peaks-graph-list-line--${line.tone}`} key={`${line.text}-${index}`}>
              {line.text}
            </span>
          ))}
        </span>
      )
      : object.secondaryLine;
    return (
      <div
        className={['peaks-graph-object', 'peaks-graph-list-object', object.className ?? '']
          .filter(Boolean)
          .join(' ')}
        data-action-id={object.actionId}
        key={key}
      >
        <PeaksListButton
          ariaLabel={object.ariaLabel}
          className={object.className}
          disabled={object.disabled}
          mainLine={object.mainLine}
          secondaryLine={secondaryLine}
          variant={object.variant}
          onClick={object.onClick}
        />
      </div>
    );
  }

  return (
    <div className={['peaks-graph-object', object.className ?? ''].filter(Boolean).join(' ')} key={key}>
      {object.node}
    </div>
  );
}

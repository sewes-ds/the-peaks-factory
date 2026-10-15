import { useEffect, useRef, type ReactNode } from 'react';

export type PresentationScreenTemplateProps = Readonly<{
  activationKey: string;
  accessibilityLabel: string;
  busy: boolean;
  header?: ReactNode;
  title?: ReactNode;
  fixedTop?: readonly ReactNode[];
  feedback?: ReactNode;
  scroll: readonly ReactNode[];
  fixedBottom?: readonly ReactNode[];
}>;

function items(values: readonly ReactNode[] | undefined, prefix: string) {
  return values?.map((value, index) => (
    <div className="peaks-presentation-template-item" key={`${prefix}-${index}`}>
      {value}
    </div>
  ));
}

export function PresentationScreenTemplate({
  activationKey,
  accessibilityLabel,
  busy,
  header,
  title,
  fixedTop,
  feedback,
  scroll,
  fixedBottom,
}: PresentationScreenTemplateProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current !== null) {
      scrollRef.current.scrollLeft = 0;
      scrollRef.current.scrollTop = 0;
    }
  }, [activationKey]);

  return (
    <section
      aria-busy={busy}
      aria-label={accessibilityLabel}
      className="peaks-presentation-screen-template"
      data-activation-key={activationKey}
    >
      {header === undefined ? null : (
        <header className="peaks-presentation-screen-template__header">
          {header}
        </header>
      )}
      {title === undefined ? null : (
        <div className="peaks-presentation-screen-template__title">{title}</div>
      )}
      {fixedTop === undefined || fixedTop.length === 0 ? null : (
        <div className="peaks-presentation-screen-template__fixed-top">
          {items(fixedTop, 'fixed-top')}
        </div>
      )}
      {feedback === undefined ? null : (
        <div
          className="peaks-presentation-screen-template__feedback"
          data-presentation-feedback-slot="true"
        >
          {feedback}
        </div>
      )}
      <div
        className="peaks-presentation-screen-template__scroll"
        data-presentation-scroll-slot="true"
        ref={scrollRef}
      >
        {items(scroll, 'scroll')}
      </div>
      {fixedBottom === undefined || fixedBottom.length === 0 ? null : (
        <div className="peaks-presentation-screen-template__fixed-bottom">
          {items(fixedBottom, 'fixed-bottom')}
        </div>
      )}
    </section>
  );
}

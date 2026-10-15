// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PresentationScreenTemplate } from './PresentationScreenTemplate';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('PresentationScreenTemplate', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => container.remove());

  it('owns exact generic slots and resets only its scroll slot on activation', () => {
    const root = createRoot(container);
    act(() => root.render(
      <PresentationScreenTemplate
        accessibilityLabel="Example screen"
        activationKey="first"
        busy={false}
        fixedBottom={[<button key="bottom">Bottom</button>]}
        fixedTop={[<div key="top">Top</div>]}
        feedback={<div role="alert">Feedback</div>}
        header={<div>Header</div>}
        scroll={[<div key="body">Body</div>]}
        title="Title"
      />,
    ));
    const scroll = container.querySelector<HTMLElement>('[data-presentation-scroll-slot]');
    expect(scroll).not.toBeNull();
    (scroll as HTMLElement).scrollLeft = 12;
    (scroll as HTMLElement).scrollTop = 30;
    act(() => root.render(
      <PresentationScreenTemplate
        accessibilityLabel="Example screen"
        activationKey="second"
        busy
        scroll={[<div key="next">Next</div>]}
      />,
    ));
    expect((scroll as HTMLElement).scrollLeft).toBe(0);
    expect((scroll as HTMLElement).scrollTop).toBe(0);
    expect(container.querySelectorAll('.peaks-presentation-template-item')).toHaveLength(1);
    expect(container.querySelector('[data-presentation-feedback-slot]')).toBeNull();
    expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    act(() => root.unmount());
  });

  it('keeps feedback inside the bounded screen before the scroll and fixed-bottom slots', () => {
    const root = createRoot(container);
    act(() => root.render(
      <PresentationScreenTemplate
        accessibilityLabel="Feedback screen"
        activationKey="feedback"
        busy={false}
        feedback={<div role="alert">Safe visible reason</div>}
        fixedBottom={[<button key="back">Back</button>]}
        scroll={[<div key="content">Content</div>]}
      />,
    ));
    const screen = container.querySelector('.peaks-presentation-screen-template')!;
    const feedbackSlot = container.querySelector('[data-presentation-feedback-slot]')!;
    const scrollSlot = container.querySelector('[data-presentation-scroll-slot]')!;
    const bottomSlot = container.querySelector('.peaks-presentation-screen-template__fixed-bottom')!;
    expect(feedbackSlot.textContent).toContain('Safe visible reason');
    expect(Array.from(screen.children).indexOf(feedbackSlot)).toBeLessThan(Array.from(screen.children).indexOf(scrollSlot));
    expect(Array.from(screen.children).indexOf(scrollSlot)).toBeLessThan(Array.from(screen.children).indexOf(bottomSlot));
    act(() => root.unmount());
  });
});

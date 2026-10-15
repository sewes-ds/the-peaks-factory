import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import {
  createPresentationGraphBridge,
  definePresentationGraphExecutionPort,
} from '../foundation/presentation';
import {
  defineSection03ScreenProjection,
} from './presentation';
import {
  Section03ScreenError,
  Section03Screen,
} from './Section03Screen';

function screen(nodeId: 'S03-M01' | 'S03-M02' = 'S03-M01') {
  return defineSection03ScreenProjection({
    nodeId,
    ariaLabel: 'Станки',
    ...(nodeId === 'S03-M01' ? { fixedTopTitle: 'Станки' } : {}),
    bridgeProjection: {
      nodeId,
      items: [
        {
          kind: 'message',
          id: 'top',
          stateKey: 'state-info',
          content: { kind: 'text', text: 'Top' },
        },
        {
          kind: 'message',
          id: 'scroll-a',
          stateKey: 'state-neutral',
          content: { kind: 'text', text: 'Scroll A' },
        },
        {
          kind: 'message',
          id: 'scroll-b',
          stateKey: 'state-warning',
          content: { kind: 'text', text: 'Scroll B' },
        },
        {
          kind: 'message',
          id: 'bottom',
          stateKey: 'state-danger',
          content: { kind: 'text', text: 'Bottom' },
        },
      ],
    },
    slots: {
      fixedTop: ['top'],
      scroll: ['scroll-b', 'scroll-a'],
      fixedBottom: ['bottom'],
    },
  });
}

function view(value: ReturnType<typeof screen>) {
  return createPresentationGraphBridge(definePresentationGraphExecutionPort({
    activationId: 1,
    nodeId: value.nodeId,
    describe: () => {
      throw new Error('inert fixture');
    },
    execute: async () => undefined,
  })).resolve(value.bridgeProjection, { interactionPending: false });
}

describe('Section03Screen', () => {
  it('renders exact shell geometry and slot order through primitives', () => {
    const target = screen();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(
      <Section03Screen
        interactionPending
        screen={target}
        view={view(target)}
      />,
    ));
    const main = container.querySelector('main');
    expect(main?.className).toContain('peaks-section03-screen');
    expect(main?.getAttribute('data-node-id')).toBe('S03-M01');
    const template = container.querySelector('.peaks-presentation-screen-template');
    expect(template?.getAttribute('aria-label')).toBe('Станки');
    expect(template?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.peaks-section03-header img')
      ?.getAttribute('alt')).toBe('PEAKS');
    expect(container.querySelector('.peaks-presentation-screen-template__title')?.textContent)
      .toBe('Станки');
    expect(container.querySelector('.peaks-presentation-screen-template__scroll')?.textContent)
      .toBe('Scroll BScroll A');
    expect(container.querySelector('.peaks-presentation-screen-template__fixed-bottom')?.textContent)
      .toBe('Bottom');
    expect(container.querySelector('.peaks-presentation-template-item')).not.toBeNull();
    root.unmount();
  });

  it('resets scroll on node change and fails closed on mismatches', () => {
    const first = screen();
    const second = screen('S03-M02');
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(
      <Section03Screen
        interactionPending={false}
        screen={first}
        view={view(first)}
      />,
    ));
    const scroll = container.querySelector('.peaks-presentation-screen-template__scroll');
    if (!(scroll instanceof HTMLElement)) throw new Error('scroll missing');
    scroll.scrollTop = 42;
    scroll.scrollLeft = 9;
    act(() => root.render(
      <Section03Screen
        interactionPending={false}
        screen={second}
        view={view(second)}
      />,
    ));
    expect(scroll.scrollTop).toBe(0);
    expect(scroll.scrollLeft).toBe(0);
    expect(() => act(() => root.render(
      <Section03Screen
        interactionPending={false}
        screen={first}
        view={view(second)}
      />,
    ))).toThrow(Section03ScreenError);
    root.unmount();
  });
});

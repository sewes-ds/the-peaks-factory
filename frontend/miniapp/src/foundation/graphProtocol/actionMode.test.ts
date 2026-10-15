import { describe, expect, it } from 'vitest';
import {
  defineGraphActionEvent,
  defineGraphActions,
  definePlatformGraphActions,
  graphAction,
  platformGraphAction,
} from './action';

const event = defineGraphActionEvent({});

describe('Graph action presentation modes', () => {
  it('keeps legacy visual metadata inside the explicit legacy registry', () => {
    const registry = defineGraphActions({
      business: {},
      presentation: {
        back: graphAction.presentation(
          event,
          graphAction.actionButton({
            label: 'Back',
            icon: 'back.svg',
            variant: 'outlineBlue',
          }),
        ),
      },
    });

    expect(registry.presentationMode).toBe('legacy-visual');
    expect(registry.presentation.back.visual.kind).toBe('action-button');
  });

  it('creates behavior-only platform actions with no visual metadata', () => {
    const registry = definePlatformGraphActions({
      business: {
        finish: platformGraphAction.business('FINISH', event),
      },
      presentation: {
        back: platformGraphAction.presentation(event),
      },
    });

    expect(registry.presentationMode).toBe('platform-authority');
    expect(registry.business.finish).toEqual({
      class: 'business',
      availableAction: 'FINISH',
      eventSchema: event,
    });
    expect(registry.presentation.back).toEqual({
      class: 'presentation',
      eventSchema: event,
    });
    expect('visual' in registry.business.finish).toBe(false);
    expect('visual' in registry.presentation.back).toBe(false);
  });

  it('fails closed when a cast tries to mix legacy definitions into platform mode', () => {
    const legacy = graphAction.presentation(
      event,
      graphAction.actionButton({
        label: 'Back',
        icon: 'back.svg',
        variant: 'outlineBlue',
      }),
    );

    expect(() => definePlatformGraphActions({
      business: {},
      presentation: { back: legacy },
    } as never)).toThrow(
      'Platform Graph action definitions cannot declare visual metadata.',
    );
  });

  it('fails closed when a cast tries to mix platform definitions into legacy mode', () => {
    const platform = platformGraphAction.presentation(event);

    expect(() => defineGraphActions({
      business: {},
      presentation: { back: platform },
    } as never)).toThrow(
      'Legacy Graph action definitions must declare visual metadata.',
    );
  });
});

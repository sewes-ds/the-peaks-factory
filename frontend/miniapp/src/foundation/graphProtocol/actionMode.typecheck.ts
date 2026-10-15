import {
  defineGraphActionEvent,
  defineGraphActions,
  definePlatformGraphActions,
  graphAction,
  platformGraphAction,
} from './action';

const event = defineGraphActionEvent({});
const visual = graphAction.actionButton({
  label: 'Back',
  icon: 'back.svg',
  variant: 'outlineBlue',
});

const platform = definePlatformGraphActions({
  business: {
    finish: platformGraphAction.business('FINISH', event),
  },
  presentation: {
    back: platformGraphAction.presentation(event),
  },
});

// @ts-expect-error platform action constructors reject Graph visual metadata
platformGraphAction.presentation(event, visual);

// @ts-expect-error platform registries reject legacy visual definitions
definePlatformGraphActions({ business: {}, presentation: { back: graphAction.presentation(event, visual) } });

// @ts-expect-error legacy registries reject behavior-only platform definitions
defineGraphActions({ business: {}, presentation: { back: platformGraphAction.presentation(event) } });

void platform;

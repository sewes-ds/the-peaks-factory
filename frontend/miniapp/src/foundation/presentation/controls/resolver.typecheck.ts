import {
  resolveControlPresentation,
  type ControlPresentation,
  type ControlRecipeRequest,
} from './resolver';

const request: ControlRecipeRequest = { key: 'navigation-next', surface: 'action-button' };
const presentation: ControlPresentation = resolveControlPresentation(request);

// @ts-expect-error invalid generic control key is rejected
const invalidKey: ControlRecipeRequest = { key: 'finish-downtime', surface: 'action-button' };
// @ts-expect-error non-control presentation surface is rejected
const invalidSurface: ControlRecipeRequest = { key: 'navigation-next', surface: 'card' };
// @ts-expect-error output is readonly
presentation.key = 'action-neutral';
// @ts-expect-error recipe remains readonly
presentation.recipe.textTone = 'neutral';
// @ts-expect-error tokens remain readonly
presentation.tokens.background = 'transparent';

void invalidKey;
void invalidSurface;

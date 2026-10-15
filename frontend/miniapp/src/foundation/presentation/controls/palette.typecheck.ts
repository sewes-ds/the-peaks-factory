import { definePresentationRecipe } from '../model';
import {
  resolvePresentationRecipeTokens,
  type ControlBackgroundToken,
} from './palette';

const recipe = definePresentationRecipe({
  surface: 'action-button', intent: 'positive', emphasis: 'primary',
  fill: { mode: 'soft', tone: 'positive' }, borderTone: 'positive', textTone: 'positive',
  preserveStateToneWhenDisabled: false,
});
const tokens = resolvePresentationRecipeTokens(recipe);
const background: ControlBackgroundToken = tokens.background;

// @ts-expect-error physical color is not a token reference
const physical: ControlBackgroundToken = '#0861BB';
// @ts-expect-error resolved tokens are readonly
tokens.text = background;

void background;
void physical;

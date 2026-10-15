import {
  definePresentationRecipe,
  type PresentationRecipeInput,
} from './recipe';

const input: PresentationRecipeInput = {
  surface: 'action-button',
  intent: 'positive',
  emphasis: 'primary',
  fill: { mode: 'soft', tone: 'neutral' },
  borderTone: 'positive',
  textTone: 'positive',
  preserveStateToneWhenDisabled: true,
};

const recipe = definePresentationRecipe(input);

// @ts-expect-error renderer variants are not presentation intents
const invalidIntent: PresentationRecipeInput['intent'] = 'primaryBlue';
// @ts-expect-error renderer variants are not presentation tones
const invalidTone: PresentationRecipeInput['fill']['tone'] = 'lightBlue';
// @ts-expect-error invalid surface is rejected
const invalidSurface: PresentationRecipeInput['surface'] = 'button';
// @ts-expect-error invalid fill mode is rejected
const invalidFillMode: PresentationRecipeInput['fill']['mode'] = 'filled';
// @ts-expect-error invalid emphasis is rejected
const invalidEmphasis: PresentationRecipeInput['emphasis'] = 'main';
// @ts-expect-error invalid text tone is rejected
const invalidTextTone: PresentationRecipeInput['textTone'] = 'gray';
// @ts-expect-error unknown recipe fields are rejected
const extra: PresentationRecipeInput = { ...input, extra: true };
// @ts-expect-error frozen output is readonly
recipe.intent = 'neutral';
// @ts-expect-error frozen nested output is readonly
recipe.fill.tone = 'info';

void invalidIntent;
void invalidTone;
void invalidSurface;
void invalidFillMode;
void invalidEmphasis;
void invalidTextTone;
void extra;

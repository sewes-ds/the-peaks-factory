import {
  CONTROL_RECIPE_ENTRIES,
  supportedControlSurfaces,
} from './registry';

const entries = CONTROL_RECIPE_ENTRIES;
const surfaces = supportedControlSurfaces('navigation-open');

// @ts-expect-error registry inspection is readonly
entries[0] = entries[1];
// @ts-expect-error entry recipes are readonly
entries[0].recipe.fill.mode = 'solid';
// @ts-expect-error supported surface list is readonly
surfaces[0] = 'action-button';

void entries;
void surfaces;

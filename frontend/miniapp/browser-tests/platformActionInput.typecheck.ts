import type { GraphActionInstanceCommonInput } from '../src/foundation/graphProtocol';

const currentPlatformActionInput: GraphActionInstanceCommonInput = {
  instanceId: 'scenario-navigation',
  ariaLabel: 'Перейти',
};

const staleLegacyVisualInput: GraphActionInstanceCommonInput = {
  instanceId: 'scenario-navigation',
  ariaLabel: 'Перейти',
  // @ts-expect-error platform-mode instance input rejects legacy visual fields
  mainLine: 'S03-M01',
};

void currentPlatformActionInput;
void staleLegacyVisualInput;

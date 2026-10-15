import type {
  PresentationGraphBridgeView,
} from '../foundation/presentation';
import type {
  Section03ScreenProjection,
} from './presentation';
import {
  Section03Screen,
  type Section03ScreenProps,
} from './Section03Screen';

declare const screen: Section03ScreenProjection;
declare const view: PresentationGraphBridgeView;
const props: Section03ScreenProps = {
  screen,
  view,
  interactionPending: false,
};
const element = <Section03Screen {...props} />;

void element;

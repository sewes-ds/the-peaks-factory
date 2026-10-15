import { resolveControlPresentation } from '../controls';
import { resolveControlFeedback } from '../feedback';
import { resolveStatePresentation } from '../states';
import type {
  ActionButtonControlPresentation,
  CardStatePresentation,
  EntityRowStatePresentation,
  ListButtonControlPresentation,
  ListButtonStatePresentation,
  MessageStatePresentation,
  PresentationCardContentLine,
  PresentationCardLabeledLine,
  PresentationCardLine,
  SummaryLineStatePresentation,
} from './contracts';

const action = resolveControlPresentation({
  key: 'action-neutral',
  surface: 'action-button',
}) as ActionButtonControlPresentation;
const controlList = resolveControlPresentation({
  key: 'navigation-open',
  surface: 'list-button',
}) as ListButtonControlPresentation;
const stateList = resolveStatePresentation({
  key: 'state-info',
  surface: 'list-button',
}) as ListButtonStatePresentation;
const entity = resolveStatePresentation({
  key: 'state-info',
  surface: 'entity-row',
}) as EntityRowStatePresentation;
const card = resolveStatePresentation({
  key: 'state-info',
  surface: 'card',
}) as CardStatePresentation;
const summary = resolveStatePresentation({
  key: 'state-info',
  surface: 'summary-line',
}) as SummaryLineStatePresentation;
const message = resolveStatePresentation({
  key: 'state-info',
  surface: 'message',
}) as MessageStatePresentation;
const feedback = resolveControlFeedback({
  availability: 'enabled',
  preserveToneWhenDisabled: false,
});
const labeledCardLine: PresentationCardLabeledLine = {
  label: 'Label',
  value: 'Value',
};
const contentCardLine: PresentationCardContentLine = {
  content: 'Content only',
};
const cardLines: readonly PresentationCardLine[] = [
  contentCardLine,
  labeledCardLine,
];

void action;
void controlList;
void stateList;
void entity;
void card;
void summary;
void message;
void feedback;
void cardLines;

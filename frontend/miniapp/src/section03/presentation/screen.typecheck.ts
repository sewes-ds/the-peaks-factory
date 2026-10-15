import type {
  PresentationGraphBridgeProjection,
} from '../../foundation/presentation';
import {
  defineSection03ScreenProjection,
  type Section03ScreenProjection,
} from './screen';

declare const bridgeProjection: PresentationGraphBridgeProjection;
const screen: Section03ScreenProjection =
  defineSection03ScreenProjection({
    nodeId: 'S03-N01',
    ariaLabel: 'Main',
    bridgeProjection,
    slots: { fixedTop: [], scroll: [], fixedBottom: [] },
  });

void screen;

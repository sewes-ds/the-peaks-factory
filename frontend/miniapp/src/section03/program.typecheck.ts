import type { ApiClient } from '../foundation/apiClient';
import type {
  GraphActivationReadyState,
  GraphReadyNodeActionFactory,
} from '../foundation/graphRuntime';
import {
  SECTION03_AUDIT_REASON,
  createSection03Program,
  type Section03Program,
} from './program';
import {
  createSection03ScreenProjection,
} from './projection';

declare const apiClient: ApiClient;
declare const mainReady: GraphActivationReadyState<'S03-N01'>;
declare const listReady: GraphActivationReadyState<'S03-M01'>;
declare const confirmReady: GraphActivationReadyState<'S03-M03O'>;
declare const mainFactory:
  GraphReadyNodeActionFactory<Section03Program, 'S03-N01'>;
declare const listFactory:
  GraphReadyNodeActionFactory<Section03Program, 'S03-M01'>;
declare const confirmFactory:
  GraphReadyNodeActionFactory<Section03Program, 'S03-M03O'>;

const program = createSection03Program(apiClient);

mainFactory.presentation(
  'openMachines',
  { instanceId: 'main-machines', ariaLabel: 'open' },
  {},
);
listFactory.presentation(
  'openMachineRunning',
  { instanceId: 'machine-M-1', ariaLabel: 'open' },
  { machine_id: 'M-1' },
);
confirmFactory.business(
  'FINISH_DOWNTIME',
  { instanceId: 'finish-D-1', ariaLabel: 'finish' },
  { downtime_id: 'D-1', comment_finish: SECTION03_AUDIT_REASON },
);

createSection03ScreenProjection({
  nodeId: 'S03-N01',
  ready: mainReady,
  actionFactory: mainFactory,
});
createSection03ScreenProjection({
  nodeId: 'S03-M01',
  ready: listReady,
  actionFactory: listFactory,
});
createSection03ScreenProjection({
  nodeId: 'S03-M03O',
  ready: confirmReady,
  actionFactory: confirmFactory,
});

// @ts-expect-error main node cannot create list back action
mainFactory.presentation('back', { ariaLabel: 'back' }, {});
confirmFactory.business(
  'FINISH_DOWNTIME',
  { ariaLabel: 'finish' },
  // @ts-expect-error action event remains a closed scalar context
  { downtime_id: 'D-1', machine: { machine_id: 'M-1' } },
);
program.graph.nodes['S03-M03O'];
// @ts-expect-error Section03 graph has no additional node
program.graph.nodes['S03-M04'];

void program;

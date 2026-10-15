import type { GraphRuntimeActionDescriptor } from '../../graphRuntime';
import {
  definePresentationGraphExecutionPort,
  type PresentationGraphExecutionPort,
} from './port';

const descriptor: GraphRuntimeActionDescriptor = {
  kind: 'graph-runtime-action-descriptor',
  activationId: 1,
  nodeId: 'NODE',
  actionClass: 'presentation',
  actionId: 'open',
};
const port: PresentationGraphExecutionPort =
  definePresentationGraphExecutionPort({
    activationId: 1,
    nodeId: 'NODE',
    describe: (_action: object) => descriptor,
    execute: async (_action: object) => undefined,
  });

// @ts-expect-error frozen port is readonly
port.nodeId = 'OTHER';
// @ts-expect-error actions must be objects
port.describe('action');

void port;

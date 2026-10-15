import { SECTION03_ADDITIONAL_WORK_NODES } from './additionalWorks';
import { SECTION03_CORRECTION_NODES } from './corrections';
import { requireSection03Context, type Section03Context } from './context';
import { SECTION03_DOWNTIME_NODES } from './downtimes';
import { SECTION03_EMPLOYEE_NODES } from './employees';
import { SECTION03_NODE_IDS, type Section03NodeId } from './ids';
import { SECTION03_MACHINE_NODES } from './machines';
import { SECTION03_MAIN_NODES } from './main';
import { SECTION03_NOTIFICATION_NODES } from './notifications';
import { SECTION03_REPORT_NODES } from './reports';
import { SECTION03_SALARY_NODES } from './salary';
import type { Section03NodeDefinition } from './types';
import { resolveSection03ExplicitReportRange } from './reportDates';

const definitions = Object.freeze([
  ...SECTION03_MAIN_NODES,
  ...SECTION03_MACHINE_NODES,
  ...SECTION03_DOWNTIME_NODES,
  ...SECTION03_EMPLOYEE_NODES,
  ...SECTION03_ADDITIONAL_WORK_NODES,
  ...SECTION03_SALARY_NODES,
  ...SECTION03_CORRECTION_NODES,
  ...SECTION03_NOTIFICATION_NODES,
  ...SECTION03_REPORT_NODES,
]);

function createRegistry(): Readonly<Record<Section03NodeId, Section03NodeDefinition>> {
  const entries = new Map<Section03NodeId, Section03NodeDefinition>();
  for (const definition of definitions) {
    if (entries.has(definition.id)) throw new Error(`Duplicate Section 03 node definition: ${definition.id}`);
    entries.set(definition.id, definition);
  }
  for (const nodeId of SECTION03_NODE_IDS) {
    if (!entries.has(nodeId)) throw new Error(`Missing Section 03 node definition: ${nodeId}`);
  }
  if (entries.size !== SECTION03_NODE_IDS.length) {
    throw new Error('Section 03 node definition registry contains an extra node.');
  }
  return Object.freeze(Object.fromEntries(entries)) as Readonly<Record<Section03NodeId, Section03NodeDefinition>>;
}

export const SECTION03_NODE_REGISTRY = createRegistry();

export function validateSection03NodeContext(
  nodeId: Section03NodeId,
  context: Section03Context,
): void {
  requireSection03Context(nodeId, context, SECTION03_NODE_REGISTRY[nodeId].requiredContext);
  if (nodeId === 'S03-R13') {
    resolveSection03ExplicitReportRange(context.from_date!, context.to_date!);
  }
}

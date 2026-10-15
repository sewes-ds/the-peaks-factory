import type { Section03Context, Section03ContextKey } from './context';
import type { Section03NodeId } from './ids';

export type Section03Family =
  | 'main' | 'machines' | 'downtimes' | 'employees' | 'additional-works'
  | 'salary' | 'corrections' | 'notifications' | 'reports';

export type Section03LoaderKey =
  | 'main'
  | 'machines'
  | 'machine-card'
  | 'downtimes'
  | 'critical-downtime-types'
  | 'employees'
  | 'employee-card'
  | 'employee-completed-works'
  | 'employee-completed-work-card'
  | 'production-completed-operations'
  | 'additional-works'
  | 'additional-work-types'
  | 'salary-correction-context'
  | 'machine-completed-production-operations'
  | 'employee-salary'
  | 'employee-salary-history'
  | 'notifications';

export type Section03ProjectionKind =
  | 'menu' | 'list' | 'card' | 'form' | 'confirmation' | 'success';

export type Section03NodeDefinition = Readonly<{
  id: Section03NodeId;
  family: Section03Family;
  loader: Section03LoaderKey | null;
  requiredContext: readonly Section03ContextKey[];
  projection: Section03ProjectionKind;
  fixtureKey: string;
  failureBehavior: 'retry-and-back';
}>;

export function defineSection03Node(
  id: Section03NodeId,
  family: Section03Family,
  loader: Section03LoaderKey | null,
  requiredContext: readonly Section03ContextKey[],
  projection: Section03ProjectionKind,
): Section03NodeDefinition {
  return Object.freeze({
    id,
    family,
    loader,
    requiredContext: Object.freeze([...requiredContext]),
    projection,
    fixtureKey: `fixture:${id}`,
    failureBehavior: 'retry-and-back',
  });
}

export type Section03BackResult = Readonly<{
  nodeId: Section03NodeId;
  context: Section03Context;
}>;

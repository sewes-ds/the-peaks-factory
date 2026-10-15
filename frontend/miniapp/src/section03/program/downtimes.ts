import { defineSection03Node } from './types';

export const SECTION03_DOWNTIME_NODES = Object.freeze([
  defineSection03Node('S03-D01', 'downtimes', 'downtimes', [], 'list'),
  defineSection03Node('S03-D10', 'downtimes', 'critical-downtime-types', [], 'list'),
  defineSection03Node('S03-D11', 'downtimes', 'machines', ['downtime_type_id', 'downtime_type_name'], 'list'),
  defineSection03Node('S03-D12', 'downtimes', null, ['machine_id', 'downtime_type_id', 'downtime_type_name'], 'form'),
  defineSection03Node('S03-D13', 'downtimes', 'machine-card', ['machine_id', 'downtime_type_id', 'downtime_type_name', 'comment_start'], 'confirmation'),
]);

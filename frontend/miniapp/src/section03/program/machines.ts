import { defineSection03Node } from './types';

export const SECTION03_MACHINE_NODES = Object.freeze([
  defineSection03Node('S03-M01', 'machines', 'machines', [], 'list'),
  defineSection03Node('S03-M02', 'machines', 'machine-card', ['machine_id'], 'card'),
  defineSection03Node('S03-M03O', 'machines', 'machine-card', ['machine_id'], 'confirmation'),
  defineSection03Node('S03-M03C', 'machines', 'machine-card', ['machine_id', 'downtime_id'], 'form'),
  defineSection03Node('S03-M04C', 'machines', 'machine-card', ['machine_id', 'downtime_id', 'comment_finish'], 'confirmation'),
]);

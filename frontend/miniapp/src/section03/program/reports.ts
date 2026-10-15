import { defineSection03Node } from './types';

export const SECTION03_REPORT_NODES = Object.freeze([
  defineSection03Node('S03-R01', 'reports', null, [], 'menu'),
  defineSection03Node('S03-R10', 'reports', null, [], 'menu'),
  defineSection03Node('S03-R11', 'reports', null, [], 'form'),
  defineSection03Node('S03-R12', 'reports', null, ['from_date'], 'form'),
  defineSection03Node('S03-R13', 'reports', 'main', ['from_date', 'to_date'], 'confirmation'),
  defineSection03Node('S03-R14', 'reports', null, ['export_run_id'], 'success'),
]);

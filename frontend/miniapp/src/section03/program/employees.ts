import { defineSection03Node } from './types';

export const SECTION03_EMPLOYEE_NODES = Object.freeze([
  defineSection03Node('S03-E01', 'employees', 'employees', [], 'list'),
  defineSection03Node('S03-E02', 'employees', 'employee-card', ['employee_id'], 'card'),
  defineSection03Node('S03-E10', 'employees', 'employee-card', ['employee_id'], 'form'),
  defineSection03Node('S03-E11', 'employees', 'employee-card', ['employee_id', 'shift_finish_reason'], 'confirmation'),
  defineSection03Node('S03-E12', 'employees', 'employee-card', ['employee_id'], 'list'),
  defineSection03Node('S03-E13', 'employees', 'employee-card', ['employee_id', 'production_operation_id'], 'form'),
  defineSection03Node('S03-E14', 'employees', 'employee-card', ['employee_id', 'production_operation_id', 'quantity_produced'], 'confirmation'),
  defineSection03Node('S03-E16', 'employees', 'employee-card', ['employee_id'], 'confirmation'),
  defineSection03Node('S03-E17', 'employees', 'employee-card', ['employee_id', 'additional_work_id'], 'confirmation'),
  defineSection03Node('S03-E20', 'employees', null, ['employee_id'], 'menu'),
  defineSection03Node('S03-E21', 'employees', 'employee-completed-works', ['employee_id', 'period'], 'list'),
  defineSection03Node('S03-E22', 'employees', 'employee-completed-work-card', ['employee_id', 'period', 'work_type', 'operation_id'], 'card'),
]);

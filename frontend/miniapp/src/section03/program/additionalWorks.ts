import { defineSection03Node } from './types';

export const SECTION03_ADDITIONAL_WORK_NODES = Object.freeze([
  defineSection03Node('S03-AW01', 'additional-works', 'additional-works', [], 'list'),
  defineSection03Node('S03-AW10', 'additional-works', 'additional-works', ['additional_work_id'], 'card'),
  defineSection03Node('S03-AW11', 'additional-works', 'additional-works', ['additional_work_id'], 'confirmation'),
  defineSection03Node('S03-AW12', 'additional-works', 'additional-works', ['additional_work_id'], 'confirmation'),
  defineSection03Node('S03-AW20', 'additional-works', 'additional-works', ['additional_work_id'], 'card'),
  defineSection03Node('S03-AW21', 'additional-works', 'additional-works', ['additional_work_id'], 'confirmation'),
  defineSection03Node('S03-AW30', 'additional-works', 'additional-works', ['additional_work_id'], 'card'),
  defineSection03Node('S03-AW31', 'additional-works', 'additional-works', ['additional_work_id'], 'confirmation'),
  defineSection03Node('S03-AW40', 'additional-works', 'employees', [], 'list'),
  defineSection03Node('S03-AW41', 'additional-works', 'additional-work-types', ['employee_id', 'employee_full_name'], 'list'),
  defineSection03Node('S03-AW42', 'additional-works', 'additional-work-types', ['employee_id', 'employee_full_name', 'additional_work_type_id', 'additional_work_type_name'], 'confirmation'),
  defineSection03Node('S03-AW50', 'additional-works', 'additional-works', ['additional_work_id'], 'card'),
  defineSection03Node('S03-AW51', 'additional-works', null, ['additional_work_id'], 'form'),
  defineSection03Node('S03-AW52', 'additional-works', 'additional-works', ['additional_work_id', 'amount_uzs'], 'confirmation'),
  defineSection03Node('S03-AW53', 'additional-works', null, ['additional_work_id'], 'form'),
  defineSection03Node('S03-AW54', 'additional-works', 'additional-works', ['additional_work_id', 'without_accrual_reason'], 'confirmation'),
]);

import { defineSection03Node } from './types';

export const SECTION03_SALARY_NODES = Object.freeze([
  defineSection03Node('S03-SAL01', 'salary', 'employee-salary', ['employee_id'], 'card'),
  defineSection03Node('S03-SAL02', 'salary', 'employee-salary-history', ['employee_id'], 'list'),
]);

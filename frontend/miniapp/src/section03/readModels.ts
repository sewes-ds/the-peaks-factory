import type { Section03LoaderKey } from './program/types';
import {
  decodeManagerCompletedWorkCardResponse,
  decodeManagerCompletedWorksResponse,
  decodeManagerAdditionalWorkTypesAvailableResponse,
  decodeManagerAdditionalWorksResponse,
  decodeManagerEmployeeSalaryHistoryResponse,
  decodeManagerEmployeeSalaryResponse,
  decodeManagerEmployeeCardResponse,
  decodeManagerEmployeesResponse,
  decodeManagerMachinesResponse,
  decodeManagerOpenTasksResponse,
  decodeManagerSalaryCorrectionContextResponse,
  decodeManagerWorkplaceStateResponse,
  decodeManagerProductionCompletedOperationsResponse,
} from './contracts';

export type Section03ReadScalar = string | number | boolean | null;
export type Section03ReadValue = Section03ReadScalar | Section03ReadRecord | readonly Section03ReadValue[];
export interface Section03ReadRecord {
  readonly [key: string]: Section03ReadValue;
}

export class Section03ReadModelError extends Error {
  readonly path: string;

  constructor(path: string, expected: string) {
    super(`Invalid Section 03 read model at ${path}: expected ${expected}.`);
    this.name = 'Section03ReadModelError';
    this.path = path;
  }
}

function decodeValue(value: unknown, path: string): Section03ReadValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Section03ReadModelError(path, 'finite number');
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item, index) => decodeValue(item, `${path}[${index}]`)));
  if (typeof value !== 'object') throw new Section03ReadModelError(path, 'JSON value');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Section03ReadModelError(path, 'plain object');
  const output: Record<string, Section03ReadValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) throw new Section03ReadModelError(`${path}.${key}`, 'defined JSON value');
    output[key] = decodeValue(item, `${path}.${key}`);
  }
  return Object.freeze(output);
}

function record(value: unknown, path: string): Section03ReadRecord {
  const decoded = decodeValue(value, path);
  if (decoded === null || Array.isArray(decoded) || typeof decoded !== 'object') {
    throw new Section03ReadModelError(path, 'plain object');
  }
  return decoded as Section03ReadRecord;
}

function requireField(source: Section03ReadRecord, key: string, kind: 'array' | 'object' | 'string' | 'number'): void {
  const value = source[key];
  const valid = kind === 'array'
    ? Array.isArray(value)
    : kind === 'object'
      ? value !== null && typeof value === 'object' && !Array.isArray(value)
      : typeof value === kind;
  if (!valid) throw new Section03ReadModelError(`$.${key}`, kind);
}

function requireSection(source: Section03ReadRecord, screens: readonly string[]): void {
  if (source.section !== 'S03') throw new Section03ReadModelError('$.section', 'S03');
  if (typeof source.screen !== 'string' || !screens.includes(source.screen)) {
    throw new Section03ReadModelError('$.screen', screens.join(' | '));
  }
}

function requireAvailableActions(value: Section03ReadValue, path: string): void {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.length > 0)) {
    throw new Section03ReadModelError(path, 'array of action strings');
  }
}

function validateAvailableActions(value: Section03ReadValue, path = '$'): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateAvailableActions(item, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'available_actions') requireAvailableActions(item, `${path}.${key}`);
    else validateAvailableActions(item, `${path}.${key}`);
  }
}

export function decodeSection03ReadModel(loader: Section03LoaderKey, value: unknown): Section03ReadRecord {
  if (loader === 'main') {
    return decodeManagerWorkplaceStateResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'machines') {
    return decodeManagerMachinesResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'employees') {
    return decodeManagerEmployeesResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'employee-card') {
    return decodeManagerEmployeeCardResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'employee-completed-works') {
    return decodeManagerCompletedWorksResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'employee-completed-work-card') {
    return decodeManagerCompletedWorkCardResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'employee-salary') {
    return decodeManagerEmployeeSalaryResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'employee-salary-history') {
    return decodeManagerEmployeeSalaryHistoryResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'additional-works') {
    return decodeManagerAdditionalWorksResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'additional-work-types') {
    return decodeManagerAdditionalWorkTypesAvailableResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'salary-correction-context') {
    return decodeManagerSalaryCorrectionContextResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'production-completed-operations') {
    return decodeManagerProductionCompletedOperationsResponse(value) as unknown as Section03ReadRecord;
  }
  if (loader === 'notifications') {
    return decodeManagerOpenTasksResponse(value) as unknown as Section03ReadRecord;
  }
  const source = record(value, '$');
  if (loader === 'machine-card') {
    requireSection(source, ['S03-M02']);
    requireField(source, 'machine', 'object');
  } else if (loader === 'downtimes') {
    requireSection(source, ['S03-D01']);
    requireField(source, 'downtimes', 'array');
  } else if (loader === 'critical-downtime-types') {
    requireSection(source, ['S03-D10']);
    requireField(source, 'downtime_types', 'array');
  } else if (loader === 'machine-completed-production-operations') {
    requireSection(source, ['S03-CP12']);
    requireField(source, 'operations', 'array');
  } else {
    const exhaustive: never = loader;
    throw new Section03ReadModelError('$', `implemented loader ${exhaustive}`);
  }
  requireAvailableActions(source.available_actions, '$.available_actions');
  validateAvailableActions(source);
  return source;
}

export function section03ReadRecord(value: Section03ReadValue | undefined, path: string): Section03ReadRecord {
  if (value === undefined || value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Section03ReadModelError(path, 'object');
  }
  return value as Section03ReadRecord;
}

export function section03ReadArray(value: Section03ReadValue | undefined, path: string): readonly Section03ReadValue[] {
  if (!Array.isArray(value)) throw new Section03ReadModelError(path, 'array');
  return value;
}

export function section03ReadText(value: Section03ReadValue | undefined, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Section03ReadModelError(path, 'non-empty string');
  return value;
}

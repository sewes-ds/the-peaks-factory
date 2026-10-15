import artifactSource from './managerPresentationContract.generated.json';
import lockSource from './managerPresentationContract.lock.json';

export const SECTION03_BACKEND_PRESENTATION_FAMILIES = Object.freeze([
  'machine',
  'employee',
  'additional_work',
  'notification',
] as const);

export type Section03BackendPresentationFamily =
  typeof SECTION03_BACKEND_PRESENTATION_FAMILIES[number];

export type Section03BackendPresentationTuple =
  | Readonly<{
      family: 'machine' | 'employee';
      tuple: Readonly<{ ui_state: string; ui_variant: string }>;
    }>
  | Readonly<{
      family: 'additional_work';
      tuple: Readonly<{ status: string; ui_variant: string }>;
    }>
  | Readonly<{
      family: 'notification';
      tuple: Readonly<{
        task_kind: string;
        ui_color_token: string;
        ui_variant: string;
      }>;
    }>;

export const SECTION03_GENERATED_CONTRACT_ERROR_CODES = Object.freeze([
  'INVALID_GENERATED_CONTRACT',
  'STALE_GENERATED_CONTRACT',
  'INVALID_GENERATED_TUPLE',
  'DUPLICATE_GENERATED_TUPLE',
  'UNKNOWN_BACKEND_PRESENTATION_TUPLE',
] as const);

export type Section03GeneratedContractErrorCode =
  typeof SECTION03_GENERATED_CONTRACT_ERROR_CODES[number];

export class Section03GeneratedContractError extends Error {
  readonly code: Section03GeneratedContractErrorCode;

  constructor(code: Section03GeneratedContractErrorCode) {
    super(code);
    this.name = 'Section03GeneratedContractError';
    this.code = code;
    Object.freeze(this);
  }
}

type GeneratedContract = Readonly<{
  producerCommit: string;
  fingerprint: string;
  vectors: readonly Section03BackendPresentationTuple[];
}>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(
  value: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === fields.length &&
    keys.every((key, index) => key === [...fields].sort()[index]);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function family(value: unknown): value is Section03BackendPresentationFamily {
  return typeof value === 'string' &&
    SECTION03_BACKEND_PRESENTATION_FAMILIES.includes(
      value as Section03BackendPresentationFamily,
    );
}

function tupleFields(
  value: unknown,
  fields: readonly string[],
): value is Readonly<Record<string, string>> {
  if (!isPlainObject(value) || !exactFields(value, fields)) return false;
  return fields.every((field) => nonEmptyString(value[field]));
}

function vector(value: unknown): Section03BackendPresentationTuple {
  if (
    !isPlainObject(value) ||
    !exactFields(value, ['family', 'tuple']) ||
    !family(value.family)
  ) {
    throw new Section03GeneratedContractError(
      'INVALID_GENERATED_TUPLE',
    );
  }
  const fields = value.family === 'additional_work'
    ? ['status', 'ui_variant']
    : value.family === 'notification'
      ? ['task_kind', 'ui_color_token', 'ui_variant']
      : ['ui_state', 'ui_variant'];
  if (!tupleFields(value.tuple, fields)) {
    throw new Section03GeneratedContractError(
      'INVALID_GENERATED_TUPLE',
    );
  }
  return Object.freeze({
    family: value.family,
    tuple: Object.freeze({ ...value.tuple }),
  }) as Section03BackendPresentationTuple;
}

function tupleIdentity(value: Section03BackendPresentationTuple): string {
  const entries = Object.entries(value.tuple)
    .sort(([left], [right]) => left.localeCompare(right));
  return `${value.family}:${JSON.stringify(Object.fromEntries(entries))}`;
}

function contract(
  artifactInput: unknown,
  lockInput: unknown,
): GeneratedContract {
  if (
    !isPlainObject(artifactInput) ||
    !exactFields(artifactInput, [
      'schema_version',
      'contract_id',
      'vectors',
      'producer_commit',
      'fingerprint_algorithm',
      'fingerprint',
    ]) ||
    artifactInput.schema_version !== 1 ||
    artifactInput.contract_id !== 'manager-presentation-tuples-v1' ||
    !Array.isArray(artifactInput.vectors) ||
    artifactInput.fingerprint_algorithm !== 'sha256' ||
    !nonEmptyString(artifactInput.producer_commit) ||
    !/^[0-9a-f]{40}$/.test(artifactInput.producer_commit) ||
    !nonEmptyString(artifactInput.fingerprint) ||
    !/^[0-9a-f]{64}$/.test(artifactInput.fingerprint)
  ) {
    throw new Section03GeneratedContractError(
      'INVALID_GENERATED_CONTRACT',
    );
  }
  if (
    !isPlainObject(lockInput) ||
    !exactFields(lockInput, [
      'contract_id',
      'producer_commit',
      'fingerprint',
    ]) ||
    lockInput.contract_id !== artifactInput.contract_id ||
    lockInput.producer_commit !== artifactInput.producer_commit ||
    lockInput.fingerprint !== artifactInput.fingerprint
  ) {
    throw new Section03GeneratedContractError(
      'STALE_GENERATED_CONTRACT',
    );
  }
  const vectors = Object.freeze(artifactInput.vectors.map(vector));
  const identities = vectors.map(tupleIdentity);
  if (new Set(identities).size !== identities.length) {
    throw new Section03GeneratedContractError(
      'DUPLICATE_GENERATED_TUPLE',
    );
  }
  for (const required of SECTION03_BACKEND_PRESENTATION_FAMILIES) {
    if (!vectors.some((candidate) => candidate.family === required)) {
      throw new Section03GeneratedContractError(
        'INVALID_GENERATED_CONTRACT',
      );
    }
  }
  return Object.freeze({
    producerCommit: artifactInput.producer_commit,
    fingerprint: artifactInput.fingerprint,
    vectors,
  });
}

const generatedContract = contract(artifactSource, lockSource);

export const SECTION03_BACKEND_PRESENTATION_CONTRACT_META = Object.freeze({
  producerCommit: generatedContract.producerCommit,
  fingerprint: generatedContract.fingerprint,
  vectorCount: generatedContract.vectors.length,
});

export function decodeSection03BackendPresentationTuple(
  input: unknown,
): Section03BackendPresentationTuple {
  const candidate = vector(input);
  const identity = tupleIdentity(candidate);
  const canonical = generatedContract.vectors.find(
    (current) => tupleIdentity(current) === identity,
  );
  if (canonical === undefined) {
    throw new Section03GeneratedContractError(
      'UNKNOWN_BACKEND_PRESENTATION_TUPLE',
    );
  }
  return canonical;
}

export function section03GeneratedBackendPresentationVectors(): readonly Section03BackendPresentationTuple[] {
  return generatedContract.vectors;
}

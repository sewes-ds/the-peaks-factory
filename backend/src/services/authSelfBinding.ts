import { ApiError, mapPostgresError } from '../db/errors.js';
import type { DbPool } from '../db/pool.js';

export type ContactProofStatus = 'CONTACT_PROOF_REQUIRED' | 'CONTACT_PROOF_EXPIRED' | 'CONTACT_PROOF_READY';
type RawIdentifySelfBindingStatus =
  | 'PHONE_NOT_FOUND'
  | 'EMPLOYEE_INACTIVE'
  | 'EMPLOYEE_ALREADY_BOUND'
  | 'TELEGRAM_ALREADY_BOUND'
  | 'CONFIRM_EMPLOYEE';
export type IdentifySelfBindingStatus =
  | 'CONTACT_PROOF_REQUIRED'
  | 'CONTACT_PROOF_EXPIRED'
  | 'PHONE_NOT_FOUND'
  | 'EMPLOYEE_INACTIVE'
  | 'EMPLOYEE_ALREADY_BOUND'
  | 'TELEGRAM_ALREADY_BOUND'
  | 'CONFIRM_EMPLOYEE';

export type ConfirmSelfBindingStatus = 'BOUND' | 'BINDING_STATE_CHANGED' | 'BINDING_CONFLICT';

export type IdentifySelfBindingResult =
  | { status: Exclude<IdentifySelfBindingStatus, 'CONFIRM_EMPLOYEE'> }
  | {
      status: 'CONFIRM_EMPLOYEE';
      employee_id: string;
      full_name: string;
      telegram_contact_proof_id: string;
      phone_e164: string;
    };

type RawIdentifySelfBindingResult =
  | { status: Exclude<RawIdentifySelfBindingStatus, 'CONFIRM_EMPLOYEE'> }
  | {
      status: 'CONFIRM_EMPLOYEE';
      employee_id: string;
      full_name: string;
    };

export type ConfirmSelfBindingResult = {
  status: ConfirmSelfBindingStatus;
  employee_id: string | null;
};

type ConsumeTelegramContactProofResult =
  | { status: 'CONTACT_PROOF_REQUIRED' | 'CONTACT_PROOF_EXPIRED' }
  | { status: 'CONTACT_PROOF_READY'; telegram_contact_proof_id: string; phone_e164: string };

export async function consumeTelegramContactProof(
  pool: DbPool,
  telegramUserId: bigint
): Promise<ConsumeTelegramContactProofResult> {
  try {
    const result = await pool.query<{
      status: ContactProofStatus;
      telegram_contact_proof_id: string | null;
      phone_e164: string | null;
    }>(
      `
        select status, telegram_contact_proof_id::text, phone_e164
        from app.consume_telegram_contact_proof($1)
      `,
      [telegramUserId.toString()]
    );

    const row = result.rows[0];
    if (!row) {
      throw new ApiError(500, 'database_error', 'Database operation failed');
    }

    if (row.status !== 'CONTACT_PROOF_READY') {
      return { status: row.status };
    }

    if (!row.telegram_contact_proof_id || !row.phone_e164) {
      throw new ApiError(500, 'database_error', 'Database operation failed');
    }

    return {
      status: row.status,
      telegram_contact_proof_id: row.telegram_contact_proof_id,
      phone_e164: row.phone_e164
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw mapPostgresError(error);
  }
}

export async function identifyEmployeeForTelegramSelfBinding(
  pool: DbPool,
  phoneE164: string,
  telegramUserId: bigint
): Promise<RawIdentifySelfBindingResult> {
  try {
    const result = await pool.query<{
      status: RawIdentifySelfBindingStatus;
      employee_id: string | null;
      full_name: string | null;
    }>(
      `
        select status, employee_id::text, full_name
        from app.identify_employee_for_telegram_self_binding($1, $2)
      `,
      [phoneE164, telegramUserId.toString()]
    );

    const row = result.rows[0];
    if (!row) {
      throw new ApiError(500, 'database_error', 'Database operation failed');
    }

    if (row.status === 'CONFIRM_EMPLOYEE') {
      if (!row.employee_id || !row.full_name) {
        throw new ApiError(500, 'database_error', 'Database operation failed');
      }

      return {
        status: row.status,
        employee_id: row.employee_id,
        full_name: row.full_name
      };
    }

    return {
      status: row.status
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw mapPostgresError(error);
  }
}

export async function identifyEmployeeForTelegramSelfBindingWithProof(
  pool: DbPool,
  telegramUserId: bigint
): Promise<IdentifySelfBindingResult> {
  const proof = await consumeTelegramContactProof(pool, telegramUserId);

  if (proof.status !== 'CONTACT_PROOF_READY') {
    return { status: proof.status };
  }

  const identifyResult = await identifyEmployeeForTelegramSelfBinding(pool, proof.phone_e164, telegramUserId);

  if (identifyResult.status !== 'CONFIRM_EMPLOYEE') {
    return identifyResult;
  }

  return {
    ...identifyResult,
    telegram_contact_proof_id: proof.telegram_contact_proof_id,
    phone_e164: proof.phone_e164
  };
}

export async function confirmEmployeeTelegramSelfBinding(
  pool: DbPool,
  employeeId: string,
  phoneE164: string,
  telegramUserId: bigint,
  telegramUsername: string | undefined
): Promise<ConfirmSelfBindingResult> {
  try {
    const result = await pool.query<{
      status: ConfirmSelfBindingStatus;
      employee_id: string | null;
    }>(
      `
        select status, employee_id::text
        from app.confirm_employee_telegram_self_binding($1, $2, $3, $4)
      `,
      [employeeId, phoneE164, telegramUserId.toString(), telegramUsername ?? null]
    );

    const row = result.rows[0];
    if (!row) {
      throw new ApiError(500, 'database_error', 'Database operation failed');
    }

    return row;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw mapPostgresError(error);
  }
}

export async function finalizeTelegramContactProof(
  pool: DbPool,
  telegramContactProofId: string,
  telegramUserId: bigint
): Promise<string> {
  try {
    const result = await pool.query<{
      telegram_contact_proof_id: string;
    }>(
      `
        select app.finalize_telegram_contact_proof($1, $2)::text as telegram_contact_proof_id
      `,
      [telegramContactProofId, telegramUserId.toString()]
    );

    const row = result.rows[0];
    if (!row?.telegram_contact_proof_id) {
      throw new ApiError(500, 'database_error', 'Database operation failed');
    }

    return row.telegram_contact_proof_id;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw mapPostgresError(error);
  }
}

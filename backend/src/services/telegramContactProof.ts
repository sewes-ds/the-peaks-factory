import { ApiError, mapPostgresError } from '../db/errors.js';
import type { DbPool } from '../db/pool.js';

export type RecordTelegramContactProofInput = {
  telegramUserId: bigint;
  phoneE164: string;
  telegramUsername?: string;
  botUpdateId: bigint;
  botMessageId: bigint | null;
};

export async function recordTelegramContactProof(
  pool: DbPool,
  input: RecordTelegramContactProofInput
): Promise<string> {
  try {
    const result = await pool.query<{ telegram_contact_proof_id: string }>(
      `
        select app.record_telegram_contact_proof($1, $2, $3, $4, $5)::text as telegram_contact_proof_id
      `,
      [
        input.telegramUserId.toString(),
        input.phoneE164,
        input.telegramUsername ?? null,
        input.botUpdateId.toString(),
        input.botMessageId?.toString() ?? null
      ]
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

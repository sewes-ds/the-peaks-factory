import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const domainStateSource = readFileSync('src/readModels/domainState.ts', 'utf8');
const typesSource = readFileSync('src/readModels/types.ts', 'utf8');
const sharedQueriesSource = readFileSync('src/readModels/sharedQueries.ts', 'utf8');

describe('salary read-model runtime contract', () => {
  it('keeps optional correction and reversal fields nullable without changing required UZS fields from numeric DTO values', () => {
    expect(sharedQueriesSource).toContain('nullif(coalesce(sum(salary_correction_uzs + production_correction_uzs), 0), 0)::text as corrections_uzs');
    expect(sharedQueriesSource).toContain('nullif(coalesce(sum(reversal_uzs), 0), 0)::text as reversals_uzs');
    expect(domainStateSource).toContain("corrections_uzs: row.corrections_uzs === null ? null : toDtoUzsAmount(row.corrections_uzs, 'months[].corrections_uzs')");
    expect(domainStateSource).toContain("reversals_uzs: row.reversals_uzs === null ? null : toDtoUzsAmount(row.reversals_uzs, 'months[].reversals_uzs')");
    expect(typesSource).toContain('corrections_uzs: number | null;');
    expect(typesSource).toContain('reversals_uzs: number | null;');
    expect(typesSource).toContain('total_uzs: number;');
    expect(typesSource).toContain('production_uzs: number;');
    expect(typesSource).toContain('additional_work_uzs: number;');
  });
});
